import React, { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated'

import { useComposerPanels } from '../components/composerPanels'
import { GlassSurface } from '../components/GlassSurface'
import { RecordingBar } from '../components/RecordingBar'
import { VideoRecordButton } from '../components/VideoRecordButton'
import { EmojiKeyboardPanel, resolveEmojiKeyboard, useEmojiKeyboard } from '../emoji/EmojiKeyboard'
import { useIsRTL } from '../hooks/useIsRTL'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { swapIn, swapOut } from './animations'
import { FieldGroup, useAttachStyle } from './FieldGroup'
import { useAccessoryFragment, useComposerFragment, useReplyPreviewFragment, useSendFragment } from './fragments'
import { resolveRecordingOptions } from './recordingOptions'
import { createStyles } from './styles'
import { TakePreviewBar } from './TakePreviewBar'
import { InputToolbarProps, OnSend } from './types'
import { useActionsFragment } from './useActionsFragment'
import { useComposerEditing } from './useComposerEditing'
import { useEmojiButton } from './useEmojiButton'
import { useKeyboardInset } from './useKeyboardInset'
import { useRecordMode } from './useRecordMode'
import { useRecordTake } from './useRecordTake'
import { useReturnAnimations } from './useReturnAnimations'
import { useRightControl } from './useRightControl'

export type { ReplyPreviewProps } from '../components/ReplyPreview'
export type { InputToolbarProps } from './types'

export function InputToolbar<TMessage extends IMessage = IMessage> (
  props: InputToolbarProps<TMessage>
) {
  const { containerStyle } = props

  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const isRTL = useIsRTL()

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

  const { rememberSelection, insertEmoji, deleteBackwardInComposer } =
    useComposerEditing(props.text ?? '', props.textInputProps?.onChangeText)

  // The emoji panel covers the indicator just as the keyboard does.
  const insetStyle = useKeyboardInset(emoji.open, props.bottomInset)

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

  const actionsFragment = useActionsFragment(props, closeEmoji)

  const emojiFragment = useEmojiButton({
    onPressEmoji: props.onPressEmoji,
    emojiConfig,
    isEmojiOpen: emoji.isOpen,
    toggleEmoji: emoji.toggle,
  })

  const composerFragment = useComposerFragment(props, emoji.onComposerFocus, rememberSelection)

  // onSend is forwarded from Chat at runtime; it isn't part of the public
  // InputToolbarProps surface, so read it through a typed cast.
  const onSend = (props as { onSend?: OnSend<TMessage> }).onSend

  // The record button when the composer is empty,
  // otherwise the send button.
  const hasText = !!props.text?.trim()
  const attachStyle = useAttachStyle(hasText)

  const {
    canRecord,
    audioConfig,
    videoConfig,
    isVoiceEnabled,
    showVoice,
    showVideo,
    isVideoHoldEnabled,
    canToggleMode,
  } = resolveRecordingOptions(props, hasText)

  // With no voice or video note to record, an empty composer would leave the send button's slot
  // blank: the button stays instead, disabled until there is something to send.
  const isSendAlwaysVisible = props.isSendButtonAlwaysVisible ?? (!isVoiceEnabled && !showVideo)
  const sendFragment = useSendFragment(props, isSendAlwaysVisible)

  const take = useRecordTake<TMessage>({ videoConfig, onSend, closeEmoji })
  const {
    meter,
    videoSession,
    setOverlay,
    videoOverlay,
    isVideoTake,
    recording,
    voicePreview,
    videoPreview,
    isPreviewing,
    isRecordingActive,
    isCancelLingering,
    hasHadTake,
    cancelRecording,
  } = take

  const { mode, recordHint, toggleRecordMode, onVoiceQuickRelease, onVideoQuickRelease } =
    useRecordMode({ canToggleMode, isVoiceEnabled, isTakeInProgress: take.isTakeInProgress })

  const { rightControl, kind: rightControlKind } = useRightControl<TMessage>({
    mode,
    canRecord,
    canToggleMode,
    showVoice,
    isVideoHoldEnabled,
    audioConfig,
    videoConfig,
    isVideoTake,
    videoSession,
    voiceRef: take.voiceRef,
    meter,
    updateVoiceState: take.updateVoiceState,
    slideProgress: take.slideProgress,
    onRecordExit: take.onRecordExit,
    recordHint,
    toggleRecordMode,
    onVoiceQuickRelease,
    onVideoQuickRelease,
    onSend,
    sendFragment,
  })

  // Inset camera button inside the field, for the system-camera fallback when
  // video is the only mode. With vision-camera the camera takes the record
  // button's slot instead.
  const videoFragment = useMemo(() => {
    if (!showVideo || canToggleMode || isVideoHoldEnabled)
      return null

    return <VideoRecordButton<TMessage> config={videoConfig} onSend={onSend} />
  }, [showVideo, canToggleMode, isVideoHoldEnabled, videoConfig, onSend])

  const accessoryFragment = useAccessoryFragment(props)
  const replyPreviewFragment = useReplyPreviewFragment(props)

  // Only a take ever takes the field away, so only then do its parts animate.
  const canTakeAway = showVoice || isVideoHoldEnabled
  const isFieldShown = !isPreviewing && !isRecordingActive && !isCancelLingering
  const returning = useReturnAnimations({ isFieldShown, lastExit: take.lastExit, hasHadTake, isRTL })

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
                  <TakePreviewBar
                    voicePreview={voicePreview}
                    videoPreview={videoPreview}
                    onDelete={cancelRecording}
                    onTrimVoice={take.trimVoicePreview}
                  />
                )
                : isRecordingActive || isCancelLingering
                  ? (
                    <RecordingBar
                      elapsed={meter.elapsed}
                      isLocked={isRecordingActive && recording.locked}
                      isBlinking={!isVideoTake || videoSession.isCapturing}
                      isCancelled={!isRecordingActive}
                      slideProgress={take.slideProgress}
                      slideDistance={take.slideDistance}
                      onCancel={cancelRecording}
                    />
                  )
                  : (
                    <FieldGroup
                      emojiFragment={emojiFragment}
                      composerFragment={composerFragment}
                      actionsFragment={actionsFragment}
                      videoFragment={videoFragment}
                      attachStyle={attachStyle}
                      hasText={hasText}
                      hasHadTake={hasHadTake}
                      canTakeAway={canTakeAway}
                      returning={returning}
                    />
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
