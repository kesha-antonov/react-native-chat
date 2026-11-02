import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { Easing, FadeIn, FadeOut, Keyframe, LayoutAnimationConfig, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Actions, ActionsProps } from './Actions'
import { AttachmentButton, resolveAttachments } from './attachments/AttachmentButton'
import { getAttachmentTabs } from './attachments/buildMessages'
import { AttachmentsProps, AttachmentTab } from './attachments/types'
import { AttachmentAction } from './components/AttachmentSheet'
import { useChatOverlay } from './components/ChatOverlay'
import { useComposerPanels } from './components/composerPanels'
import { GlassSurface } from './components/GlassSurface'
import { Icon } from './components/Icon'
import { EmojiIcon, TrashIcon } from './components/MediaControls'
import { RecordButton, RecordExitReason, useRecordSlideDistance } from './components/RecordButton'
import { CANCEL_LINGER_MS, RecordingBar } from './components/RecordingBar'
import { getLastRecordMode, setLastRecordMode } from './components/recordingFeedback'
import { createRecordingMeter, RecordingMeterContext } from './components/recordingMeter'
import { ReplyPreview, ReplyPreviewProps } from './components/ReplyPreview'
import { useVideoNoteSession } from './components/VideoNoteCapture'
import { VideoRecordButton, isVideoRecordingAvailable } from './components/VideoRecordButton'
import { isVisionCameraNativeReady } from './components/visionCamera'
import {
  RecordedVoicePreview,
  VoiceMessageInput,
  VoiceMessageInputHandle,
  VoiceMessageInputProps,
  VoiceRecordingState,
  formatElapsed,
  isVoiceRecordingAvailable,
} from './components/VoiceMessageInput'
import { Composer, ComposerProps } from './Composer'
import { EmojiKeyboardPanel, EmojiKeyboardProps, resolveEmojiKeyboard, useEmojiKeyboard } from './emoji/EmojiKeyboard'
import { TextSelection, deleteBackward, insertText } from './emoji/textEditing'
import { useIsRTL } from './hooks/useIsRTL'
import { useLabels } from './hooks/useLabels'
import { useTheme, useThemedStyles } from './hooks/useTheme'
import { AudioRecordingProps, IMessage, ReplyMessage, VideoRecordingProps } from './Models'
import { Send, SendProps } from './Send'
import { ChatTheme } from './Theme'
import { renderComponentOrElement } from './utils'

export type { ReplyPreviewProps } from './components/ReplyPreview'

/** How long a record-button tooltip stays up. */
const HINT_DURATION_MS = 3000

// Pausing a take morphs the record circle into the preview pill
// (`RecordCircle.transformToSeekbar`): over 580ms (voice) or 490ms (video) it
// swells for 38% of the time, shrinks to a dot for 25%, then stretches into
// the pill for the last 37%. The circle plays the first two steps; the pill
// plays the stretch out of the button's corner, and the reverse on resume.
const easeBoth = Easing.bezier(0.42, 0, 0.58, 1)
const STRETCH_FROM_SCALE_X = 0.06
const STRETCH_FROM_SCALE_Y = 0.45

const makeStretchIn = (totalMs: number) => () => {
  'worklet'
  const delay = totalMs * 0.63
  const duration = totalMs * 0.37
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scaleX: STRETCH_FROM_SCALE_X }, { scaleY: STRETCH_FROM_SCALE_Y }],
    },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: duration * 0.4 })),
      transform: [
        { scaleX: withDelay(delay, withTiming(1, { duration, easing: easeBoth })) },
        { scaleY: withDelay(delay, withTiming(1, { duration, easing: easeBoth })) },
      ],
    },
  }
}
const voiceStretchIn = makeStretchIn(580)
const videoStretchIn = makeStretchIn(490)

/** Resuming folds the pill back into the button before the circle returns. */
const STRETCH_OUT_MS = 200
const stretchOut = () => {
  'worklet'
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scaleX: 1 }, { scaleY: 1 }],
    },
    animations: {
      opacity: withDelay(STRETCH_OUT_MS * 0.6, withTiming(0, { duration: STRETCH_OUT_MS * 0.4 })),
      transform: [
        { scaleX: withTiming(STRETCH_FROM_SCALE_X, { duration: STRETCH_OUT_MS, easing: easeBoth }) },
        { scaleY: withTiming(STRETCH_FROM_SCALE_Y, { duration: STRETCH_OUT_MS, easing: easeBoth }) },
      ],
    },
  }
}

// The composer's controls leave as a take starts and come back after it:
// over 150ms decelerate the
// emoji button scales to nothing, the attach button shrinks to half while it
// slides 30 towards the record button, and the text slides 20 the same way,
// all fading. Coming back, the icons grow back in over 150ms and the text
// fades in over 200ms - 200 / 150ms after a send, 700 / 300ms after a cancel.
const DECELERATE = Easing.out(Easing.quad)
const CONTROLS_MS = 150
const TEXT_IN_MS = 200
const ATTACH_SHIFT = 30
const TEXT_SHIFT = 20
const RETURN_DELAYS = {
  send: { icons: 200, text: 150 },
  cancel: { icons: 700, text: 300 },
}

const emojiOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0 }], easing: DECELERATE },
}).duration(CONTROLS_MS)
const makeAttachOut = (shift: number) => new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateX: shift }, { scale: 0.5 }], easing: DECELERATE },
}).duration(CONTROLS_MS)
const attachOut = makeAttachOut(ATTACH_SHIFT)
const attachOutRTL = makeAttachOut(-ATTACH_SHIFT)
const makeTextOut = (shift: number) => new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }] },
  100: { opacity: 0, transform: [{ translateX: shift }], easing: DECELERATE },
}).duration(CONTROLS_MS)
const textOut = makeTextOut(TEXT_SHIFT)
const textOutRTL = makeTextOut(-TEXT_SHIFT)

/** The way back in, waiting out whatever of the delay has not passed yet. */
// Read once, as the field comes back, and kept in state from then on: the delays are only
// read when the field's parts mount.
const elapsedSince = (at: number) => Date.now() - at

const makeReturn = (delays: { icons: number, text: number }, attachShift: number) => ({
  emoji: new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: DECELERATE },
  }).duration(CONTROLS_MS).delay(delays.icons),
  attach: new Keyframe({
    0: { opacity: 0, transform: [{ translateX: attachShift }, { scale: 0.5 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }], easing: DECELERATE },
  }).duration(CONTROLS_MS).delay(delays.icons),
  text: FadeIn.duration(TEXT_IN_MS).delay(delays.text),
})

// The mic and the send button swap by scaling one to 0.1 while the other grows from it,
// over 220ms on EASE_OUT_QUINT.
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
const SWAP_MS = 220
const swapIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.1 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT_QUINT },
}).duration(SWAP_MS)
const swapOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.1 }], easing: EASE_OUT_QUINT },
}).duration(SWAP_MS)
// The emoji button's smile <-> keyboard morph, a short crossfade standing in for a ~300ms Lottie.
const EMOJI_ICON_SWAP = { duration: 200, easing: Easing.out(Easing.quad) }
// The paperclip steps aside while there is text: half size and transparent over 100ms.
const ATTACH_HIDE = { duration: 100 }

export interface InputToolbarProps<TMessage extends IMessage> {
  actions?: AttachmentAction[]
  actionSheetOptionTintColor?: string
  containerStyle?: StyleProp<ViewStyle>
  primaryStyle?: StyleProp<ViewStyle>
  renderAccessory?: (props: InputToolbarProps<TMessage>) => React.ReactNode
  renderActions?: (props: ActionsProps) => React.ReactNode
  renderSend?: (props: SendProps<TMessage>) => React.ReactNode
  renderComposer?: (props: ComposerProps) => React.ReactNode
  onPressActionButton?: () => void
  icon?: () => React.ReactNode
  wrapperStyle?: StyleProp<ViewStyle>
  /** Reply message to show in preview */
  replyMessage?: ReplyMessage | null
  /** Callback to clear reply */
  onClearReply?: () => void
  /** The message being edited; shows the "Editing" banner instead of the reply one. */
  editMessage?: ReplyMessage | null
  /** Called when the editing banner is closed. */
  onCancelEdit?: () => void
  /** Custom render for reply preview */
  renderReplyPreview?: (props: ReplyPreviewProps) => React.ReactNode
  /** Style for reply preview container */
  replyPreviewContainerStyle?: StyleProp<ViewStyle>
  /** Style for reply preview text */
  replyPreviewTextStyle?: StyleProp<TextStyle>
  /**
   * Hold-to-record voice notes. On by default when the optional `expo-audio` is
   * installed; `false` turns them off, an object configures them.
   */
  audioRecording?: boolean | AudioRecordingProps
  /**
   * Round video notes. On by default when `react-native-vision-camera` is installed; `false`
   * turns them off. `{ isEnabled: true }` also offers the system camera (`expo-image-picker`)
   * when vision-camera is missing.
   */
  videoRecording?: boolean | VideoRecordingProps
  /** Force-show the send button even when the composer is empty */
  isSendButtonAlwaysVisible?: boolean
  /** Current composer text (used to swap the send button for the mic button) */
  text?: string
  /** Props for the composer's `TextInput`, forwarded from `Chat`. */
  textInputProps?: ComposerProps['textInputProps']
  /**
   * Called when the emoji button is pressed, instead of opening the built-in emoji keyboard.
   * Passing it shows the button even with `emojiKeyboard={false}`.
   */
  onPressEmoji?: () => void
  /**
   * The built-in emoji keyboard the emoji button opens in the system keyboard's place. On by
   * default; `false` hides the button (unless `onPressEmoji` is set).
   */
  emojiKeyboard?: boolean | EmojiKeyboardProps
  /**
   * The built-in attachment menu behind the paperclip. On by default (each tab shows when its
   * optional peer is installed); `false` hides the paperclip. `actions`, `onPressActionButton`
   * and `renderActions` take precedence.
   */
  attachments?: boolean | AttachmentsProps<TMessage>
  /**
   * Whether the composer accepts multiple lines. `true` (default) keeps the
   * return key inserting a newline; `false` turns it into Send.
   */
  isMultiline?: boolean
}

type OnSend<TMessage extends IMessage> = (
  message: Partial<TMessage> | Partial<TMessage>[],
  shouldResetInputToolbar: boolean
) => void

// The composer's caret, kept for the emoji keyboard. The setter goes into the composer props
// handed to a custom `renderComposer`, which is called during render; behind a hook it is not
// mistaken for a ref read there - it only ever runs from the input's selection event.
function useSelectionTracker () {
  const selectionRef = useRef<TextSelection | null>(null)
  const getSelection = useCallback(() => selectionRef.current, [])
  const rememberSelection = useCallback((selection: TextSelection) => {
    selectionRef.current = selection
  }, [])
  return { getSelection, rememberSelection }
}

export function InputToolbar<TMessage extends IMessage = IMessage> (
  props: InputToolbarProps<TMessage>
) {
  const {
    renderActions,
    onPressActionButton,
    renderComposer,
    renderSend,
    renderAccessory,
    actions,
    actionSheetOptionTintColor,
    icon,
    wrapperStyle,
    containerStyle,
    replyMessage,
    onClearReply,
    editMessage,
    onCancelEdit,
    renderReplyPreview: renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  } = props

  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const isRTL = useIsRTL()
  const labels = useLabels()

  // The built-in emoji keyboard, unless the app handles the button itself.
  const emojiConfig = props.onPressEmoji ? null : resolveEmojiKeyboard(props.emojiKeyboard)
  const textInputRef = (props.textInputProps as { ref?: React.RefObject<{ focus?: () => void } | null> } | undefined)?.ref
  const focusComposer = () => {
    textInputRef?.current?.focus?.()
  }
  const emoji = useEmojiKeyboard({
    isEnabled: !!emojiConfig,
    focusComposer,
    defaultHeight: theme.emojiKeyboard.defaultHeight,
  })

  // The message list closes the panel on a tap.
  const composerPanels = useComposerPanels()
  const closeEmoji = emoji.close
  useEffect(() => {
    composerPanels?.setCloser(closeEmoji)
    return () => composerPanels?.setCloser(null)
  }, [composerPanels, closeEmoji])

  // Edits go through the composer's own change handler, so they work whether the app controls
  // `text` or not. Kept in refs, as several taps can land before the next render.
  const textRef = useRef(props.text ?? '')
  const { getSelection, rememberSelection } = useSelectionTracker()
  const onChangeTextRef = useRef(props.textInputProps?.onChangeText)
  const text = props.text ?? ''
  const onChangeText = props.textInputProps?.onChangeText
  useLayoutEffect(() => {
    textRef.current = text
    onChangeTextRef.current = onChangeText
  })

  const applyEdit = useCallback((edit: { text: string, selection: TextSelection }) => {
    textRef.current = edit.text
    rememberSelection(edit.selection)
    onChangeTextRef.current?.(edit.text)
  }, [rememberSelection])
  const insertEmoji = useCallback((value: string) => {
    applyEdit(insertText(textRef.current, value, getSelection()))
  }, [applyEdit, getSelection])
  const deleteBackwardInComposer = useCallback(() => {
    applyEdit(deleteBackward(textRef.current, getSelection()))
  }, [applyEdit, getSelection])


  // The island floats 9 above the home indicator (`INPUT_BUBBLE_BOTTOM`), and 9 above the
  // keyboard once it covers the indicator: the inset fades out with the keyboard's progress.
  const keyboard = useReanimatedKeyboardAnimation()
  const noKeyboard = useSharedValue(0)
  // Guarded for mocks that return nothing.
  const keyboardHeight = keyboard?.height ?? noKeyboard
  const bottomInset = insets.bottom
  const bottomGap = theme.spacing.inputToolbarPaddingV
  // The emoji panel covers the indicator just as the keyboard does.
  const emojiOpen = emoji.open
  // Driven by how much of the inset the keyboard actually covers, not by its progress: a
  // floating or split keyboard on Android (or a hardware keyboard's suggestion strip) reports
  // full progress at a height of 0-ish, and the toolbar then dropped onto the gesture bar.
  const insetStyle = useAnimatedStyle(() => {
    const covered = bottomInset > 0 ? Math.min(1, Math.max(0, -keyboardHeight.value / bottomInset)) : 1
    return {
      paddingBottom: bottomGap + bottomInset * (1 - Math.min(1, Math.max(covered, emojiOpen.value))),
    }
  })

  const containerStyles = useMemo(() => [
    styles.container,
    insetStyle,
    containerStyle,
  ], [styles, insetStyle, containerStyle])

  const primaryStyles = useMemo(() => [
    styles.primary,
    isRTL && styles.rowReverse,
    props.primaryStyle,
  ], [styles, isRTL, props.primaryStyle])

  const fieldGroupStyles = useMemo(() => [
    styles.fieldGroup,
    isRTL && styles.rowReverse,
  ], [styles, isRTL])

  // The built-in attachment menu, behind the paperclip when no legacy `actions` are given.
  const attachmentsProp = props.attachments
  const attachmentsConfig = useMemo(() => resolveAttachments<TMessage>(attachmentsProp), [attachmentsProp])
  const requestedTabs = attachmentsConfig?.tabs
  const hasAttachments = !!attachmentsConfig
  // Keyed by the tab list, not its identity: an inline array would rebuild the menu every render.
  const requestedTabsId = requestedTabs?.join(',')
  const attachmentTabs = useMemo(() => {
    if (!hasAttachments)
      return []
    return getAttachmentTabs(requestedTabsId === undefined
      ? undefined
      : requestedTabsId.split(',').filter(Boolean) as AttachmentTab[])
  }, [hasAttachments, requestedTabsId])
  const onSendProp = (props as { onSend?: OnSend<TMessage> }).onSend
  const onSendForAttachments = useCallback((messages: Partial<TMessage>[], shouldReset: boolean) => {
    onSendProp?.(messages, shouldReset)
  }, [onSendProp])

  const actionsFragment = useMemo(() => {
    const actionsProps = {
      onPressActionButton,
      actions,
      actionSheetOptionTintColor,
      icon,
      wrapperStyle,
      containerStyle,
    }

    if (renderActions)
      return renderComponentOrElement(renderActions, actionsProps)

    if (onPressActionButton || actions?.length)
      return <Actions {...actionsProps} />

    if (attachmentsConfig && attachmentTabs.length > 0)
      return (
        <AttachmentButton<TMessage>
          tabs={attachmentTabs}
          config={attachmentsConfig}
          onSend={onSendForAttachments}
          onOpen={closeEmoji}
          icon={icon}
          wrapperStyle={wrapperStyle}
        />
      )

    return null
  }, [
    renderActions,
    onPressActionButton,
    actions,
    actionSheetOptionTintColor,
    icon,
    wrapperStyle,
    containerStyle,
    attachmentsConfig,
    attachmentTabs,
    onSendForAttachments,
    closeEmoji,
  ])

  const emojiShown = useSharedValue(0)
  useEffect(() => {
    emojiShown.value = withTiming(emoji.isOpen ? 1 : 0, EMOJI_ICON_SWAP)
  }, [emoji.isOpen, emojiShown])
  const smileIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - emojiShown.value,
    transform: [{ scale: 1 - 0.5 * emojiShown.value }],
  }))
  const keyboardIconStyle = useAnimatedStyle(() => ({
    opacity: emojiShown.value,
    transform: [{ scale: 0.5 + 0.5 * emojiShown.value }],
  }))

  const onPressEmoji = props.onPressEmoji
  const toggleEmoji = emoji.toggle
  const isEmojiOpen = emoji.isOpen
  const emojiFragment = useMemo(() => {
    if (!onPressEmoji && !emojiConfig)
      return null

    const size = styles.insetColor.fontSize
    const color = styles.insetColor.color
    return (
      <Pressable
        onPress={onPressEmoji ?? toggleEmoji}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={isEmojiOpen ? labels.keyboardButton : labels.emojiButton}
        style={styles.insetCell}
      >
        <Animated.View style={smileIconStyle}>
          <Icon name='emoji' color={color} size={size} fallback={<EmojiIcon color={color} size={size} />} />
        </Animated.View>
        {emojiConfig && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.centered, keyboardIconStyle]} pointerEvents='none'>
            <Icon name='keyboard' color={color} size={size} fallback={<Text style={[styles.keyboardFallback, { color }]}>{'⌨'}</Text>} />
          </Animated.View>
        )}
      </Pressable>
    )
  }, [onPressEmoji, emojiConfig, toggleEmoji, isEmojiOpen, labels, styles, smileIconStyle, keyboardIconStyle])

  const onComposerFocus = emoji.onComposerFocus
  const composerFragment = useMemo(() => {
    const textInputProps = props.textInputProps
    // The composer reports its caret, so an emoji lands where it is, and its focus, which
    // brings the system keyboard back in the emoji panel's place.
    const composerProps = {
      ...props,
      textInputProps: {
        ...textInputProps,
        onFocus: (event: Parameters<NonNullable<NonNullable<ComposerProps['textInputProps']>['onFocus']>>[0]) => {
          onComposerFocus()
          textInputProps?.onFocus?.(event)
        },
        onSelectionChange: (event: Parameters<NonNullable<NonNullable<ComposerProps['textInputProps']>['onSelectionChange']>>[0]) => {
          rememberSelection(event.nativeEvent.selection)
          textInputProps?.onSelectionChange?.(event)
        },
      },
    } as ComposerProps

    if (renderComposer)
      return renderComponentOrElement(renderComposer, composerProps)

    return <Composer {...composerProps} />
  }, [renderComposer, props, onComposerFocus, rememberSelection])

  const sendFragment = useMemo(() => {
    if (renderSend)
      return renderComponentOrElement(renderSend, props)

    return <Send {...props} />
  }, [renderSend, props])

  // onSend is forwarded from Chat at runtime; it isn't part of the public
  // InputToolbarProps surface, so read it through a typed cast.
  const onSend = (props as { onSend?: OnSend<TMessage> }).onSend

  // Recording state is owned by VoiceMessageInput (it holds the recorder) and
  // by the video session; both report up here so the bar - timer, "slide to
  // cancel", CANCEL once locked, the paused take's preview - can span the full
  // input row.
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    active: false, locked: false, elapsed: 0, cancelArmed: false, levels: [], preview: null,
  })
  // The running time and loudness of a take, ticking ten times a second: the timer and the
  // record button read them from here, so a tick does not re-render the composer.
  const [meter] = useState(createRecordingMeter)
  // The voice input reports its whole state on every tick; only a change in what the bar
  // shows (not the time or the level) is worth a render here.
  const updateVoiceState = useCallback((next: VoiceRecordingState) => {
    setVoiceState(prev =>
      prev.active === next.active &&
      prev.locked === next.locked &&
      prev.cancelArmed === next.cancelArmed &&
      prev.preview === next.preview
        ? prev
        : next
    )
  }, [])
  const voiceRef = useRef<VoiceMessageInputHandle>(null)
  const trimVoicePreview = useCallback((start: number, end: number) => {
    voiceRef.current?.trim(start, end)
  }, [])
  // The record button's cancel slide on the UI thread, so "slide to cancel"
  // can follow the circle without a render per frame.
  const slideProgress = useSharedValue(1)
  const slideDistance = useRecordSlideDistance()

  // The record button when the composer is empty,
  // otherwise the send button.
  const hasText = !!props.text?.trim()

  const attachShown = useSharedValue(hasText ? 0 : 1)
  useEffect(() => {
    attachShown.value = withTiming(hasText ? 0 : 1, ATTACH_HIDE)
  }, [hasText, attachShown])
  const attachStyle = useAnimatedStyle(() => ({
    opacity: attachShown.value,
    transform: [{ scale: 0.5 + 0.5 * attachShown.value }],
  }))
  const canRecord = !hasText && !props.isSendButtonAlwaysVisible
  // Voice and round video notes turn on by themselves once their peers are installed; `false`
  // (or `isEnabled: false`) turns either off. The system-camera fallback is a different control
  // (a camera button that opens another app), so it stays behind an explicit `isEnabled: true`.
  const audioConfig = typeof props.audioRecording === 'object' ? props.audioRecording : undefined
  const videoConfig = typeof props.videoRecording === 'object' ? props.videoRecording : undefined
  const isVoiceEnabled = props.audioRecording !== false && audioConfig?.isEnabled !== false && isVoiceRecordingAvailable
  const showVoice = isVoiceEnabled && canRecord
  const isVideoAllowed = props.videoRecording !== false && videoConfig?.isEnabled !== false
  const isVideoForced = props.videoRecording === true || videoConfig?.isEnabled === true
  const showVideo = isVideoAllowed && (isVideoForced ? isVideoRecordingAvailable : isVisionCameraNativeReady)
  // A round note recorded straight from the record button. Needs
  // vision-camera's native module; without it video falls back to the system
  // camera behind a tap-to-open button.
  const isVideoHoldEnabled = showVideo && isVisionCameraNativeReady

  // Voice and video share one right-slot control: a single tap
  // switches which one it is, a hold records. Only offered when both are
  // available - with just one, that control has nothing to toggle to. The
  // choice is remembered across chats.
  const [recordMode, setRecordMode] = useState<'voice' | 'video'>(getLastRecordMode)
  const canToggleMode = showVoice && showVideo
  const mode = canToggleMode ? recordMode : (isVoiceEnabled ? 'voice' : 'video')

  const videoSession = useVideoNoteSession<TMessage>({ config: videoConfig, onSend, elapsedStore: meter.elapsed })

  // The camera preview is drawn over the message list by `Chat`; outside a
  // Chat it falls back to sitting above the toolbar.
  const setOverlay = useChatOverlay()
  const videoOverlay = videoSession.overlay
  useEffect(() => {
    setOverlay?.(videoOverlay)
  }, [setOverlay, videoOverlay])
  useEffect(() => () => setOverlay?.(null), [setOverlay])

  // Voice and video share the recording bar.
  const isVideoTake = videoSession.isActive
  const recording = isVideoTake
    ? {
      active: !videoSession.preview,
      locked: videoSession.isLocked,
    }
    : voiceState
  const voicePreview = isVideoTake ? null : voiceState.preview ?? null
  const videoPreview = isVideoTake ? videoSession.preview : null
  const isPreviewing = !!voicePreview || !!videoPreview
  const isRecordingActive = recording.active
  const isTakeInProgress = isRecordingActive || isPreviewing

  // A take replaces the field, so the emoji panel goes with it.
  useEffect(() => {
    if (isTakeInProgress)
      closeEmoji()
  }, [isTakeInProgress, closeEmoji])

  // A cancelled take keeps the bar up a moment for the trash can, then the
  // composer comes back (`recordDeleteImageView`).
  const [isCancelLingering, setIsCancelLingering] = useState(false)
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRecordingActiveRef = useRef(isRecordingActive)
  useLayoutEffect(() => {
    isRecordingActiveRef.current = isRecordingActive
  })
  const startCancelLinger = useCallback(() => {
    // Only a bar that is showing has anything to animate out.
    if (!isRecordingActiveRef.current)
      return

    if (lingerTimerRef.current)
      clearTimeout(lingerTimerRef.current)
    setIsCancelLingering(true)
    lingerTimerRef.current = setTimeout(() => {
      lingerTimerRef.current = null
      setIsCancelLingering(false)
    }, CANCEL_LINGER_MS)
  }, [])

  // How and when the last take ended, for the composer's way back in.
  const [lastExit, setLastExit] = useState<{ reason: 'send' | 'cancel', at: number }>({ reason: 'cancel', at: 0 })

  const onRecordExit = useCallback((reason: RecordExitReason) => {
    if (reason !== 'preview')
      setLastExit({ reason, at: Date.now() })
    if (reason === 'cancel')
      startCancelLinger()
  }, [startCancelLinger])

  // A new take over a lingering bar takes the bar back.
  useEffect(() => {
    if (!isRecordingActive || !lingerTimerRef.current)
      return

    clearTimeout(lingerTimerRef.current)
    lingerTimerRef.current = null
    setIsCancelLingering(false)
  }, [isRecordingActive])
  useEffect(() => () => {
    if (lingerTimerRef.current)
      clearTimeout(lingerTimerRef.current)
  }, [])

  // The composer comes back with a fade only after a take, not on first mount.
  const [hasHadTake, setHasHadTake] = useState(false)
  if (isTakeInProgress && !hasHadTake)
    setHasHadTake(true)

  // A tooltip over the record button: after a mode switch, or after a tap on a
  // single-mode button.
  const [recordHint, setRecordHint] = useState<string | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showRecordHint = useCallback((hint: string) => {
    if (hintTimerRef.current)
      clearTimeout(hintTimerRef.current)
    setRecordHint(hint)
    hintTimerRef.current = setTimeout(() => setRecordHint(null), HINT_DURATION_MS)
  }, [])
  useEffect(() => () => {
    if (hintTimerRef.current)
      clearTimeout(hintTimerRef.current)
  }, [])

  // Read through a ref so the callback stays stable: it is the record button's
  // `onTap`, and a new identity would rebuild the gesture mid-hold.
  const isTakeInProgressRef = useRef(isTakeInProgress)
  const labelsRef = useRef(labels)
  useLayoutEffect(() => {
    isTakeInProgressRef.current = isTakeInProgress
    labelsRef.current = labels
  })

  const toggleRecordMode = useCallback(() => {
    // Never switch under a take in progress.
    if (isTakeInProgressRef.current)
      return

    setRecordMode(current => {
      const next = current === 'voice' ? 'video' : 'voice'
      setLastRecordMode(next)
      showRecordHint(next === 'voice'
        ? labelsRef.current.holdToRecordAudioSwitch
        : labelsRef.current.holdToRecordVideoSwitch)
      return next
    })
  }, [showRecordHint])

  const onVoiceQuickRelease = useCallback(() => {
    showRecordHint(labelsRef.current.holdToRecordAudioOnly)
  }, [showRecordHint])

  const onVideoQuickRelease = useCallback(() => {
    showRecordHint(labelsRef.current.holdToRecordVideoOnly)
  }, [showRecordHint])

  const cancelRecording = useCallback(() => {
    setLastExit({ reason: 'cancel', at: Date.now() })
    startCancelLinger()
    if (videoSession.isActive)
      videoSession.finish(true)
    else
      voiceRef.current?.cancel()
  }, [videoSession, startCancelLinger])

  const rightControl = useMemo(() => {
    // A take keeps its button until it ends, whatever the composer shows.
    if (isVideoTake || (isVideoHoldEnabled && mode === 'video' && canRecord))
      return (
        <RecordButton
          mode='video'
          phase={videoSession.buttonPhase}
          isCapturing={videoSession.isCapturing}
          onTap={canToggleMode ? toggleRecordMode : undefined}
          onStart={videoSession.start}
          onFinish={videoSession.finish}
          onLock={videoSession.lock}
          onPause={videoSession.pause}
          onSend={videoSession.send}
          onToggleViewOnce={videoSession.toggleViewOnce}
          isViewOnce={videoSession.isViewOnce}
          slideProgressValue={slideProgress}
          onExit={onRecordExit}
          hint={recordHint}
          onQuickRelease={canToggleMode ? undefined : onVideoQuickRelease}
        />
      )

    if (showVoice && mode === 'voice')
      return (
        <RecordingMeterContext.Provider value={meter}>
          <VoiceMessageInput
            ref={voiceRef}
            config={audioConfig}
            onSend={onSend as VoiceMessageInputProps['onSend']}
            onStateChange={updateVoiceState}
            onTap={canToggleMode ? toggleRecordMode : undefined}
            slideProgressValue={slideProgress}
            onExit={onRecordExit}
            hint={recordHint}
            onQuickRelease={canToggleMode ? undefined : onVoiceQuickRelease}
          />
        </RecordingMeterContext.Provider>
      )

    // Video through the system camera: a tap-to-open button in the same slot.
    if (canToggleMode && mode === 'video')
      return (
        <VideoRecordButton<TMessage>
          config={videoConfig}
          onSend={onSend}
          onTap={toggleRecordMode}
          variant='round'
        />
      )

    return sendFragment
  }, [
    isVideoTake,
    isVideoHoldEnabled,
    mode,
    canRecord,
    videoSession,
    canToggleMode,
    toggleRecordMode,
    slideProgress,
    onRecordExit,
    recordHint,
    onVideoQuickRelease,
    showVoice,
    audioConfig,
    onSend,
    onVoiceQuickRelease,
    videoConfig,
    sendFragment,
    meter,
    updateVoiceState,
  ])

  // Which control the right slot holds; a change swaps them with the scale morph above.
  const rightControlKind = isVideoTake || (isVideoHoldEnabled && mode === 'video' && canRecord)
    ? 'video'
    : showVoice && mode === 'voice'
      ? 'voice'
      : canToggleMode && mode === 'video'
        ? 'camera'
        : 'send'

  // Inset camera button inside the field, for the system-camera fallback when
  // video is the only mode. With vision-camera the camera takes the record
  // button's slot instead.
  const videoFragment = useMemo(() => {
    if (!showVideo || canToggleMode || isVideoHoldEnabled)
      return null

    return <VideoRecordButton<TMessage> config={videoConfig} onSend={onSend} />
  }, [showVideo, canToggleMode, isVideoHoldEnabled, videoConfig, onSend])

  const accessoryFragment = useMemo(() => {
    if (!renderAccessory)
      return null

    return renderComponentOrElement(renderAccessory, props)
  }, [renderAccessory, props])

  const handleClearReply = useCallback(() => {
    onClearReply?.()
  }, [onClearReply])

  const handleCancelEdit = useCallback(() => {
    onCancelEdit?.()
  }, [onCancelEdit])

  const replyPreviewFragment = useMemo(() => {
    const isEditing = !!editMessage
    const previewMessage = editMessage ?? replyMessage
    if (!previewMessage)
      return null

    const replyPreviewProps: ReplyPreviewProps = {
      replyMessage: previewMessage,
      onClearReply: isEditing ? handleCancelEdit : handleClearReply,
      mode: isEditing ? 'edit' : 'reply',
      containerStyle: replyPreviewContainerStyle,
      textStyle: replyPreviewTextStyle,
    }

    if (renderReplyPreviewProp)
      return renderComponentOrElement(renderReplyPreviewProp, replyPreviewProps)

    // Keyed by mode, so switching between replying and editing plays the banner in again.
    return <ReplyPreview key={isEditing ? 'edit' : 'reply'} {...replyPreviewProps} />
  }, [
    replyMessage,
    editMessage,
    handleClearReply,
    handleCancelEdit,
    renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  ])

  // Only a take ever takes the field away, so only then do its parts animate.
  const canTakeAway = showVoice || isVideoHoldEnabled
  const isFieldShown = !isPreviewing && !isRecordingActive && !isCancelLingering
  // Computed as the field comes back; `entering` is only read on mount. A
  // cancel has usually spent most of its delay on the lingering bar already.
  const [returnAnimations, setReturnAnimations] = useState<ReturnType<typeof makeReturn> | null>(null)
  const [wasFieldShown, setWasFieldShown] = useState(true)
  if (isFieldShown !== wasFieldShown) {
    setWasFieldShown(isFieldShown)
    if (isFieldShown) {
      const { reason, at } = lastExit
      const passed = elapsedSince(at)
      const delays = RETURN_DELAYS[reason]
      setReturnAnimations(makeReturn({
        icons: Math.max(0, delays.icons - passed),
        text: Math.max(0, delays.text - passed),
      }, reason === 'cancel' ? (isRTL ? -ATTACH_SHIFT : ATTACH_SHIFT) : 0))
    }
  }
  const returning = hasHadTake ? returnAnimations : null

  return (
    <>
      <Animated.View style={containerStyles}>
        {!setOverlay && videoOverlay && (
          <View style={styles.detachedOverlay} pointerEvents='box-none'>
            {videoOverlay}
          </View>
        )}
        <View style={[styles.islandRow, isRTL && styles.rowReverse]}>
          <View style={styles.island}>
            <GlassSurface color={theme.colors.inputBackground} borderColor={theme.colors.inputFieldBorder} style={styles.islandSurface} />
            {replyPreviewFragment}
            <View style={primaryStyles}>
              {isPreviewing
                ? (
              // A paused take: delete on the left, the take in the middle, send
              // in the record button's slot (`recordedAudioPanel`).
                  <View style={[styles.recordingBar, styles.previewBar, isRTL && styles.rowReverse]}>
                    {/* The delete button pops in once the circle has shrunk away. */}
                    <Animated.View entering={ZoomIn.delay(150).duration(150)}>
                      <Pressable
                        style={styles.recTrash}
                        hitSlop={8}
                        onPress={cancelRecording}
                        accessibilityRole='button'
                        accessibilityLabel='delete recording'
                      >
                        <Icon
                          name='trash'
                          color={styles.recTrashColor.color}
                          size={20}
                          fallback={<TrashIcon color={styles.recTrashColor.color} size={20} />}
                        />
                      </Pressable>
                    </Animated.View>
                    <Animated.View
                      entering={voicePreview ? voiceStretchIn : videoStretchIn}
                      exiting={stretchOut}
                      // The pill grows out of the record button's side.
                      style={[styles.previewContent, { transformOrigin: isRTL ? 'left center' : 'right center' }]}
                    >
                      {voicePreview
                        ? (
                          <RecordedVoicePreview
                            key={voicePreview.uri}
                            preview={voicePreview}
                            onTrim={trimVoicePreview}
                          />
                        )
                        : (
                          <View style={styles.videoPreviewPill}>
                            <Text style={styles.videoPreviewTime}>{formatElapsed(videoPreview?.durationMs ?? 0)}</Text>
                          </View>
                        )}
                    </Animated.View>
                  </View>
                )
                : isRecordingActive || isCancelLingering
                  ? (
                    <RecordingBar
                      elapsed={meter.elapsed}
                      isLocked={isRecordingActive && recording.locked}
                      isBlinking={!isVideoTake || videoSession.isCapturing}
                      isCancelled={!isRecordingActive}
                      slideProgress={slideProgress}
                      slideDistance={slideDistance}
                      onCancel={cancelRecording}
                    />
                  )
                  : (
                    <Animated.View
                      style={fieldGroupStyles}
                      // The pill itself only fades; its parts move on their own.
                      entering={hasHadTake ? FadeIn.duration(CONTROLS_MS) : undefined}
                      exiting={canTakeAway ? FadeOut.duration(CONTROLS_MS) : undefined}
                    >
                      {emojiFragment && (
                        <Animated.View entering={returning?.emoji} exiting={canTakeAway ? emojiOut : undefined}>
                          {emojiFragment}
                        </Animated.View>
                      )}
                      <Animated.View
                        style={[
                          styles.composerSlot,
                          !emojiFragment && (isRTL ? styles.composerSlotEndInset : styles.composerSlotStartInset),
                          !actionsFragment && !videoFragment && (isRTL ? styles.composerSlotStartInset : styles.composerSlotEndInset),
                        ]}
                        entering={returning?.text}
                        exiting={canTakeAway ? (isRTL ? textOutRTL : textOut) : undefined}
                      >
                        {composerFragment}
                      </Animated.View>
                      {actionsFragment && (
                        <Animated.View entering={returning?.attach} exiting={canTakeAway ? (isRTL ? attachOutRTL : attachOut) : undefined}>
                          <Animated.View style={attachStyle} pointerEvents={hasText ? 'none' : 'auto'}>
                            {actionsFragment}
                          </Animated.View>
                        </Animated.View>
                      )}
                      {videoFragment}
                    </Animated.View>
                  )}
            </View>
          </View>
          <LayoutAnimationConfig skipEntering>
            <Animated.View key={rightControlKind} style={styles.rightSlot} entering={swapIn} exiting={swapOut}>
              {rightControl}
            </Animated.View>
          </LayoutAnimationConfig>
        </View>
        {accessoryFragment}
      </Animated.View>
      {emojiConfig && (
        <EmojiKeyboardPanel
          controller={emoji}
          config={emojiConfig}
          onSelect={insertEmoji}
          onBackspace={deleteBackwardInComposer}
        />
      )}
    </>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Camera preview when the toolbar is used outside a Chat: a tall square
  // above the toolbar instead of the message-list overlay.
  detachedOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 420,
  },
  // The composer is a floating island over the wallpaper: 7 from the sides, 9 above
  // the bottom inset; the band around it stays transparent.
  container: {
    backgroundColor: theme.colors.inputBarBackground,
    paddingTop: 4,
    paddingLeft: theme.spacing.screenEdge.left,
    paddingRight: theme.spacing.screenEdge.right,
  },
  // The island itself: a 44 capsule (radius 22) that grows upward with the text and holds the
  // reply banner on top. It does not clip, so the record button can grow out of it.
  // The send / record button sits outside the field's capsule, in its own 44 cell to the right.
  islandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  island: {
    flex: 1,
    minHeight: theme.composer.minHeight,
    borderRadius: theme.radii.inputField,
  },
  islandSurface: {
    borderRadius: theme.radii.inputField,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // positioned parent for the voice recorder's overlay bar
    position: 'relative',
  },
  // Mirrors `primary`/`fieldGroup`/`recordingBar` for RTL. All three space their
  // children with `gap` rather than manual margins, so reversing direction is
  // enough - no per-child left/right swap needed.
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  // The paused take's bar, sized like the field so the row height does not jump.
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: theme.composer.fieldPaddingH,
  },
  // Locked state: a real delete target (44pt) instead of a text link.
  recTrash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTrashColor: {
    color: theme.colors.error,
  },
  previewBar: {
    gap: 6,
    paddingHorizontal: 0,
  },
  previewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The paused round take's length, in the same pill as the voice preview.
  videoPreviewPill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.accent,
  },
  videoPreviewTime: {
    fontSize: 12,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  // Everything sits inside the island now, so the field group draws nothing of its own:
  // [emoji 44] [text] [attach 44], with the send/mic cell after it.
  fieldGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  // A row, so a custom composer's `flex: 1` still means width, as it did
  // directly in the field group.
  composerSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 4,
  },
  // With no emoji button the text starts 14 in; with no paperclip it ends 8 short of the send cell.
  composerSlotStartInset: {
    marginLeft: 12,
  },
  composerSlotEndInset: {
    marginRight: 8,
  },
  // The emoji button's 44 cell.
  insetCell: {
    width: 44,
    height: theme.composer.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    alignSelf: 'flex-end',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardFallback: {
    fontSize: 22,
  },
  // Carries inset icon color + size (kept out of JSX): `glass_defaultIcon`.
  insetColor: {
    color: theme.colors.composerIcon,
    fontSize: 26,
  },
})
