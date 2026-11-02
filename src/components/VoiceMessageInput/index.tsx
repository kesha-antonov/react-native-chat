import React, { forwardRef } from 'react'

import { RecordButton } from '../RecordButton'
import { isVoiceResumeAvailable, isVoiceTrimAvailable } from '../voiceEditing'
import { VoiceMessageInputHandle, VoiceMessageInputProps } from './types'
import { useVoiceTake } from './useVoiceTake'

export { formatElapsed } from './formatElapsed'
export { RecordedVoicePreview } from './RecordedVoicePreview'
export type { RecordedVoicePreviewProps } from './RecordedVoicePreview'
export { isVoiceRecordingAvailable } from './recorder'
export type {
  VoiceMessageInputHandle,
  VoiceMessageInputProps,
  VoiceRecordingPreview,
  VoiceRecordingState
} from './types'

/**
 * Hold-to-record voice notes. Hold the mic to record, slide left
 * to cancel, slide up to lock for hands-free recording, or release to send. A
 * locked take can be paused into a preview to replay before sending. A
 * take of `minDurationMs` or less is discarded.
 *
 * This component owns the recorder; the button and its gesture are
 * `RecordButton`, and the bar - timer, "slide to cancel", the preview - is
 * drawn by the InputToolbar via `onStateChange`, so it can span the full
 * width of the input row. Only mounted when expo-audio is available, so its
 * hooks always run in a stable order.
 */
function VoiceMessageInputInner (
  { config, onSend, onStateChange, onTap, hint, onQuickRelease, slideProgressValue, onExit }: VoiceMessageInputProps,
  ref: React.Ref<VoiceMessageInputHandle>
) {
  const {
    phase,
    meter,
    labels,
    preview,
    isViewOnce,
    toggleViewOnce,
    start,
    stopTake,
    setIsLocked,
    resume,
    sendPreview,
    onSlideProgress,
  } = useVoiceTake({ config, onSend, onStateChange }, ref)

  return (
    <RecordButton
      mode='voice'
      phase={phase}
      levelStore={meter.level}
      onTap={onTap}
      onStart={() => start()}
      onFinish={cancelled => stopTake(cancelled ? 'cancel' : 'send')}
      onLock={() => setIsLocked(true)}
      onPause={() => stopTake('preview')}
      onResume={preview && isVoiceResumeAvailable() ? resume : undefined}
      pauseHint={isVoiceTrimAvailable() ? labels.pauseToTrimOrReplay : null}
      onSend={preview ? sendPreview : () => stopTake('send')}
      onSlideProgress={onSlideProgress}
      slideProgressValue={slideProgressValue}
      onExit={onExit}
      hint={hint}
      onQuickRelease={onQuickRelease}
      onToggleViewOnce={config?.isViewOnceEnabled ? toggleViewOnce : undefined}
      isViewOnce={isViewOnce}
    />
  )
}

export const VoiceMessageInput = forwardRef(VoiceMessageInputInner)
