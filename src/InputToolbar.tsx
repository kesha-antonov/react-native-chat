import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Actions, ActionsProps } from './Actions'
import { AttachmentAction } from './components/AttachmentSheet'
import { Icon } from './components/Icon'
import { ChevronIcon, EmojiIcon } from './components/MediaControls'
import { ReplyPreview, ReplyPreviewProps } from './components/ReplyPreview'
import { VideoRecordButton, isVideoRecordingAvailable } from './components/VideoRecordButton'
import {
  VoiceMessageInput,
  VoiceMessageInputHandle,
  VoiceMessageInputProps,
  VoiceRecordingState,
  formatElapsed,
  isVoiceRecordingAvailable,
} from './components/VoiceMessageInput'
import { Composer, ComposerProps } from './Composer'
import { useLabels } from './hooks/useLabels'
import { useThemedStyles } from './hooks/useTheme'
import { AudioRecordingProps, IMessage, ReplyMessage, VideoRecordingProps } from './Models'
import { Send, SendProps } from './Send'
import { ChatTheme } from './Theme'
import { renderComponentOrElement } from './utils'

export type { ReplyPreviewProps } from './components/ReplyPreview'

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
    renderReplyPreview: renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  } = props

  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  const containerStyles = useMemo(() => [
    styles.container,
    // Pad for the home indicator so the field doesn't kiss it (no-op when the
    // keyboard covers the inset).
    { paddingBottom: insets.bottom },
    containerStyle,
  ], [styles, insets.bottom, containerStyle])

  const primaryStyles = useMemo(() => [
    styles.primary,
    props.primaryStyle,
  ], [styles, props.primaryStyle])

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

  // Recording state is owned by VoiceMessageInput (it holds the recorder + the
  // gesture); it reports up here so the bar - timer on the left, pulsating
  // "slide to cancel" hint across the field - can span the full input row.
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    active: false, locked: false, elapsed: 0, cancelArmed: false,
  })
  const voiceRef = useRef<VoiceMessageInputHandle>(null)
  const recPulse = useSharedValue(0)

  useEffect(() => {
    if (voiceState.active) {
      recPulse.value = withRepeat(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        -1,
        true
      )
    } else {
      cancelAnimation(recPulse)
      recPulse.value = 0
    }
  }, [voiceState.active, recPulse])

  const recDotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(recPulse.value, [0, 1], [1, 0.25]),
  }))
  const recHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(recPulse.value, [0, 1], [1, 0.5]),
  }))

  // Telegram-style swap: mic when the composer is empty and voice recording is
  // enabled/available, otherwise the send button.
  const hasText = !!props.text?.trim()
  const showVoice =
    !!props.audioRecording?.isEnabled &&
    isVoiceRecordingAvailable &&
    !hasText &&
    !props.isSendButtonAlwaysVisible

  const rightControl = useMemo(() => {
    if (showVoice)
      return (
        <VoiceMessageInput
          ref={voiceRef}
          config={props.audioRecording}
          onSend={onSend as VoiceMessageInputProps['onSend']}
          onStateChange={setVoiceState}
        />
      )

    return sendFragment
  }, [showVoice, props.audioRecording, onSend, sendFragment])

  // Inset camera button for video messages, shown when enabled and a camera
  // backend (vision-camera or expo-image-picker) is installed.
  const videoFragment = useMemo(() => {
    if (!props.videoRecording?.isEnabled || !isVideoRecordingAvailable)
      return null

    return <VideoRecordButton<TMessage> config={props.videoRecording} onSend={onSend} />
  }, [props.videoRecording, onSend])

  const accessoryFragment = useMemo(() => {
    if (!renderAccessory)
      return null

    return renderComponentOrElement(renderAccessory, props)
  }, [renderAccessory, props])

  const handleClearReply = useCallback(() => {
    onClearReply?.()
  }, [onClearReply])

  const replyPreviewFragment = useMemo(() => {
    if (!replyMessage)
      return null

    const replyPreviewProps: ReplyPreviewProps = {
      replyMessage,
      onClearReply: handleClearReply,
      containerStyle: replyPreviewContainerStyle,
      textStyle: replyPreviewTextStyle,
    }

    if (renderReplyPreviewProp)
      return renderComponentOrElement(renderReplyPreviewProp, replyPreviewProps)

    return <ReplyPreview {...replyPreviewProps} />
  }, [
    replyMessage,
    handleClearReply,
    renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  ])

  return (
    <View style={containerStyles}>
      {replyPreviewFragment}
      <View style={primaryStyles}>
        {voiceState.active
          ? (
            <View style={styles.recordingBar}>
              <Animated.View style={[styles.recDot, recDotStyle]} />
              <Text style={styles.recTimer}>{formatElapsed(voiceState.elapsed)}</Text>
              {voiceState.locked
                ? (
                  <Pressable
                    style={styles.recCancelWrap}
                    hitSlop={8}
                    onPress={() => voiceRef.current?.cancel()}
                    accessibilityRole='button'
                    accessibilityLabel='cancel recording'
                  >
                    <Text style={styles.recCancelText}>{labels.cancel}</Text>
                  </Pressable>
                )
                : (
                  <Animated.View style={[styles.recHintWrap, recHintStyle]} pointerEvents='none'>
                    <ChevronIcon color={styles.recHintColor.color} size={14} direction='left' />
                    <Text style={[styles.recHint, voiceState.cancelArmed && styles.recHintArmed]}>
                      {labels.slideToCancel}
                    </Text>
                  </Animated.View>
                )}
            </View>
          )
          : (
            <View style={styles.fieldGroup}>
              {emojiFragment}
              {composerFragment}
              {actionsFragment}
              {videoFragment}
            </View>
          )}
        {rightControl}
      </View>
      {accessoryFragment}
    </View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.inputBarBackground,
    borderTopColor: theme.colors.separator,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.screenEdge,
    gap: theme.spacing.screenEdge,
    // positioned parent for the voice recorder's overlay bar
    position: 'relative',
  },
  // While recording, the field is replaced by a bar: a blinking red dot and the
  // timer on the left, then the pulsating "slide to cancel" hint (or a Cancel
  // button once locked). Sized like the field so the row height does not jump.
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: theme.composer.fieldPaddingH,
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.error,
  },
  recTimer: {
    marginLeft: 8,
    fontSize: 15,
    color: theme.colors.inputText,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
  },
  recHintWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recHint: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  recHintArmed: {
    color: theme.colors.error,
  },
  // Carries the chevron color through the StyleSheet so it stays themed.
  recHintColor: {
    color: theme.colors.placeholder,
  },
  recCancelWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  recCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.error,
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
