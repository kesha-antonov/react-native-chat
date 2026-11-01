import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, Keyframe, ZoomIn, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Actions, ActionsProps } from './Actions'
import { AttachmentAction } from './components/AttachmentSheet'
import { useChatOverlay } from './components/ChatOverlay'
import { Icon } from './components/Icon'
import { EmojiIcon, TrashIcon } from './components/MediaControls'
import { RecordButton, RecordExitReason, useRecordSlideDistance } from './components/RecordButton'
import { CANCEL_LINGER_MS, RecordingBar } from './components/RecordingBar'
import { getLastRecordMode, setLastRecordMode } from './components/recordingFeedback'
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
import { useIsRTL } from './hooks/useIsRTL'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
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

// The composer's controls leave as a take starts and come back after it
// (`ChatActivityEnterView.updateRecordInterface`): over 150ms decelerate the
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
  /** Telegram-style hold-to-record voice messages (needs optional expo-audio) */
  audioRecording?: AudioRecordingProps
  /** Record-and-send video messages (needs optional expo-image-picker) */
  videoRecording?: VideoRecordingProps
  /** Force-show the send button even when the composer is empty */
  isSendButtonAlwaysVisible?: boolean
  /** Current composer text (used to swap the send button for the mic button) */
  text?: string
  /** Show an emoji button inset on the left of the field; called on press. */
  onPressEmoji?: () => void
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
  const insets = useSafeAreaInsets()
  const isRTL = useIsRTL()

  const containerStyles = useMemo(() => [
    styles.container,
    // Pad for the home indicator so the field doesn't kiss it (no-op when the
    // keyboard covers the inset).
    { paddingBottom: insets.bottom },
    containerStyle,
  ], [styles, insets.bottom, containerStyle])

  const primaryStyles = useMemo(() => [
    styles.primary,
    isRTL && styles.rowReverse,
    props.primaryStyle,
  ], [styles, isRTL, props.primaryStyle])

  const fieldGroupStyles = useMemo(() => [
    styles.fieldGroup,
    isRTL && styles.rowReverse,
  ], [styles, isRTL])

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

    return null
  }, [
    renderActions,
    onPressActionButton,
    actions,
    actionSheetOptionTintColor,
    icon,
    wrapperStyle,
    containerStyle,
  ])

  const emojiFragment = useMemo(() => {
    if (!props.onPressEmoji)
      return null

    const size = styles.insetColor.fontSize
    return (
      <Pressable
        onPress={props.onPressEmoji}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel='emoji'
        style={styles.inset}
      >
        <Icon name='emoji' color={styles.insetColor.color} size={size} fallback={<EmojiIcon color={styles.insetColor.color} size={size} />} />
      </Pressable>
    )
  }, [props.onPressEmoji, styles])

  const composerFragment = useMemo(() => {
    const composerProps = props as ComposerProps

    if (renderComposer)
      return renderComponentOrElement(renderComposer, composerProps)

    return <Composer {...composerProps} />
  }, [renderComposer, props])

  const sendFragment = useMemo(() => {
    if (renderSend)
      return renderComponentOrElement(renderSend, props)

    return <Send {...props} />
  }, [renderSend, props])

  // onSend is forwarded from Chat at runtime; it isn't part of the public
  // InputToolbarProps surface, so read it through a typed cast.
  const onSend = (props as { onSend?: OnSend<TMessage> }).onSend

  const labels = useLabels()

  // Recording state is owned by VoiceMessageInput (it holds the recorder) and
  // by the video session; both report up here so the bar - timer, "slide to
  // cancel", CANCEL once locked, the paused take's preview - can span the full
  // input row, as in Telegram.
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    active: false, locked: false, elapsed: 0, cancelArmed: false, levels: [], preview: null,
  })
  const voiceRef = useRef<VoiceMessageInputHandle>(null)
  const trimVoicePreview = useCallback((start: number, end: number) => {
    voiceRef.current?.trim(start, end)
  }, [])
  // The record button's cancel slide on the UI thread, so "slide to cancel"
  // can follow the circle without a render per frame.
  const slideProgress = useSharedValue(1)
  const slideDistance = useRecordSlideDistance()

  // Telegram-style swap: the record button when the composer is empty,
  // otherwise the send button.
  const hasText = !!props.text?.trim()
  const canRecord = !hasText && !props.isSendButtonAlwaysVisible
  const isVoiceEnabled = !!props.audioRecording?.isEnabled && isVoiceRecordingAvailable
  const showVoice = isVoiceEnabled && canRecord
  const showVideo = !!props.videoRecording?.isEnabled && isVideoRecordingAvailable
  // A round note recorded straight from the record button. Needs
  // vision-camera's native module; without it video falls back to the system
  // camera behind a tap-to-open button.
  const isVideoHoldEnabled = showVideo && isVisionCameraNativeReady

  // Telegram shares one right-slot control between voice and video: a single tap
  // switches which one it is, a hold records. Only offered when both are
  // available - with just one, that control has nothing to toggle to. The
  // choice is remembered, as Telegram keeps `currentModeVideo`.
  const [recordMode, setRecordMode] = useState<'voice' | 'video'>(getLastRecordMode)
  const canToggleMode = showVoice && showVideo
  const mode = canToggleMode ? recordMode : (isVoiceEnabled ? 'voice' : 'video')

  const videoSession = useVideoNoteSession<TMessage>({ config: props.videoRecording, onSend })

  // The camera preview is drawn over the message list by `Chat`; outside a
  // Chat it falls back to sitting above the toolbar.
  const setOverlay = useChatOverlay()
  const videoOverlay = videoSession.overlay
  useEffect(() => {
    setOverlay?.(videoOverlay)
  }, [setOverlay, videoOverlay])
  useEffect(() => () => setOverlay?.(null), [setOverlay])

  // Voice and video share the recording bar, as they do in Telegram.
  const isVideoTake = videoSession.isActive
  const recording = isVideoTake
    ? {
      active: !videoSession.preview,
      locked: videoSession.isLocked,
      elapsed: videoSession.elapsed,
    }
    : voiceState
  const voicePreview = isVideoTake ? null : voiceState.preview ?? null
  const videoPreview = isVideoTake ? videoSession.preview : null
  const isPreviewing = !!voicePreview || !!videoPreview
  const isRecordingActive = recording.active
  const isTakeInProgress = isRecordingActive || isPreviewing

  // A cancelled take keeps the bar up a moment for the trash can, then the
  // composer comes back (`recordDeleteImageView`).
  const [isCancelLingering, setIsCancelLingering] = useState(false)
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRecordingActiveRef = useRef(isRecordingActive)
  isRecordingActiveRef.current = isRecordingActive
  const lastElapsedRef = useRef(0)
  if (isRecordingActive)
    lastElapsedRef.current = recording.elapsed

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
  const lastExitRef = useRef<{ reason: 'send' | 'cancel', at: number }>({ reason: 'cancel', at: 0 })

  const onRecordExit = useCallback((reason: RecordExitReason) => {
    if (reason !== 'preview')
      lastExitRef.current = { reason, at: Date.now() }
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
  const hasHadTakeRef = useRef(false)
  if (isTakeInProgress)
    hasHadTakeRef.current = true

  // A tooltip over the record button: after a mode switch, or after a tap on a
  // single-mode button (`ChatActivity.showVoiceHint`).
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
  isTakeInProgressRef.current = isTakeInProgress
  const labelsRef = useRef(labels)
  labelsRef.current = labels

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
    lastExitRef.current = { reason: 'cancel', at: Date.now() }
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
        <VoiceMessageInput
          ref={voiceRef}
          config={props.audioRecording}
          onSend={onSend as VoiceMessageInputProps['onSend']}
          onStateChange={setVoiceState}
          onTap={canToggleMode ? toggleRecordMode : undefined}
          slideProgressValue={slideProgress}
          onExit={onRecordExit}
          hint={recordHint}
          onQuickRelease={canToggleMode ? undefined : onVoiceQuickRelease}
        />
      )

    // Video through the system camera: a tap-to-open button in the same slot.
    if (canToggleMode && mode === 'video')
      return (
        <VideoRecordButton<TMessage>
          config={props.videoRecording}
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
    props.audioRecording,
    onSend,
    onVoiceQuickRelease,
    props.videoRecording,
    sendFragment,
  ])

  // Inset camera button inside the field, for the system-camera fallback when
  // video is the only mode. With vision-camera the camera takes the record
  // button's slot instead, as Telegram's does.
  const videoFragment = useMemo(() => {
    if (!showVideo || canToggleMode || isVideoHoldEnabled)
      return null

    return <VideoRecordButton<TMessage> config={props.videoRecording} onSend={onSend} />
  }, [showVideo, canToggleMode, isVideoHoldEnabled, props.videoRecording, onSend])

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
  const returnRef = useRef<ReturnType<typeof makeReturn> | null>(null)
  const wasFieldShownRef = useRef(true)
  if (isFieldShown && !wasFieldShownRef.current) {
    const { reason, at } = lastExitRef.current
    const passed = Date.now() - at
    const delays = RETURN_DELAYS[reason]
    returnRef.current = makeReturn({
      icons: Math.max(0, delays.icons - passed),
      text: Math.max(0, delays.text - passed),
    }, reason === 'cancel' ? (isRTL ? -ATTACH_SHIFT : ATTACH_SHIFT) : 0)
  }
  wasFieldShownRef.current = isFieldShown
  const returning = hasHadTakeRef.current ? returnRef.current : null

  return (
    <View style={containerStyles}>
      {!setOverlay && videoOverlay && (
        <View style={styles.detachedOverlay} pointerEvents='box-none'>
          {videoOverlay}
        </View>
      )}
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
                elapsed={isRecordingActive ? recording.elapsed : lastElapsedRef.current}
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
                entering={hasHadTakeRef.current ? FadeIn.duration(CONTROLS_MS) : undefined}
                exiting={canTakeAway ? FadeOut.duration(CONTROLS_MS) : undefined}
              >
                {emojiFragment && (
                  <Animated.View entering={returning?.emoji} exiting={canTakeAway ? emojiOut : undefined}>
                    {emojiFragment}
                  </Animated.View>
                )}
                <Animated.View
                  style={styles.composerSlot}
                  entering={returning?.text}
                  exiting={canTakeAway ? (isRTL ? textOutRTL : textOut) : undefined}
                >
                  {composerFragment}
                </Animated.View>
                {actionsFragment && (
                  <Animated.View entering={returning?.attach} exiting={canTakeAway ? (isRTL ? attachOutRTL : attachOut) : undefined}>
                    {actionsFragment}
                  </Animated.View>
                )}
                {videoFragment}
              </Animated.View>
            )}
        {rightControl}
      </View>
      {accessoryFragment}
    </View>
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
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.inputBarBackground,
    borderTopColor: theme.colors.separator,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: theme.spacing.inputToolbarPaddingV,
    paddingLeft: theme.spacing.screenEdge.left,
    paddingRight: theme.spacing.screenEdge.right,
    gap: theme.spacing.screenEdge.left,
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
  // The field is the bar: one rounded pill holding the inset controls + the
  // text field. Only the send/mic button lives outside it.
  fieldGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: theme.composer.fieldPaddingH,
    gap: 6,
    borderRadius: theme.radii.inputField,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
  },
  // A row, so a custom composer's `flex: 1` still means width, as it did
  // directly in the field group.
  composerSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inset: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  // Carries inset icon color + size (kept out of JSX).
  insetColor: {
    color: theme.colors.incomingMeta,
    fontSize: theme.composer.insetIconSize,
  },
})
