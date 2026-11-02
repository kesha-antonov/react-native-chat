import React, { useMemo } from 'react'
import { SharedValue } from 'react-native-reanimated'

import { RecordButton, RecordExitReason } from '../components/RecordButton'
import { RecordingMeter, RecordingMeterContext } from '../components/recordingMeter'
import { VideoNoteSession } from '../components/VideoNoteCapture'
import { VideoRecordButton } from '../components/VideoRecordButton'
import {
  VoiceMessageInput,
  VoiceMessageInputHandle,
  VoiceMessageInputProps,
  VoiceRecordingState,
} from '../components/VoiceMessageInput'
import { AudioRecordingProps, IMessage, VideoRecordingProps } from '../Models'
import { OnSend } from './types'

interface UseRightControlOptions<TMessage extends IMessage> {
  mode: 'voice' | 'video'
  canRecord: boolean
  canToggleMode: boolean
  showVoice: boolean
  isVideoHoldEnabled: boolean
  audioConfig: AudioRecordingProps | undefined
  videoConfig: VideoRecordingProps | undefined
  isVideoTake: boolean
  videoSession: VideoNoteSession
  voiceRef: React.RefObject<VoiceMessageInputHandle | null>
  meter: RecordingMeter
  updateVoiceState: (state: VoiceRecordingState) => void
  slideProgress: SharedValue<number>
  onRecordExit: (reason: RecordExitReason) => void
  recordHint: string | null
  toggleRecordMode: () => void
  onVoiceQuickRelease: () => void
  onVideoQuickRelease: () => void
  onSend: OnSend<TMessage> | undefined
  sendFragment: React.ReactNode
}

/**
 * The control in the record button's slot: the round note's or the voice note's record
 * button, the system camera's button, or send. `kind` names which, so a change swaps them.
 */
export function useRightControl<TMessage extends IMessage> ({
  mode,
  canRecord,
  canToggleMode,
  showVoice,
  isVideoHoldEnabled,
  audioConfig,
  videoConfig,
  isVideoTake,
  videoSession,
  voiceRef,
  meter,
  updateVoiceState,
  slideProgress,
  onRecordExit,
  recordHint,
  toggleRecordMode,
  onVoiceQuickRelease,
  onVideoQuickRelease,
  onSend,
  sendFragment,
}: UseRightControlOptions<TMessage>) {
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
    voiceRef,
  ])

  // Which control the right slot holds; a change swaps them with the scale morph (`swapIn`, `swapOut`).
  const kind = isVideoTake || (isVideoHoldEnabled && mode === 'video' && canRecord)
    ? 'video'
    : showVoice && mode === 'voice'
      ? 'voice'
      : canToggleMode && mode === 'video'
        ? 'camera'
        : 'send'

  return { rightControl, kind }
}
