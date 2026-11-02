import { isVideoRecordingAvailable } from '../components/VideoRecordButton'
import { isVisionCameraNativeReady } from '../components/visionCamera'
import { isVoiceRecordingAvailable } from '../components/VoiceMessageInput'
import { IMessage } from '../Models'
import { InputToolbarProps } from './types'

/** Which of voice and video notes the toolbar offers, and how. */
export function resolveRecordingOptions<TMessage extends IMessage> (
  props: InputToolbarProps<TMessage>,
  hasText: boolean
) {
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
  const canToggleMode = showVoice && showVideo

  return {
    canRecord,
    audioConfig,
    videoConfig,
    isVoiceEnabled,
    showVoice,
    showVideo,
    isVideoHoldEnabled,
    canToggleMode,
  }
}
