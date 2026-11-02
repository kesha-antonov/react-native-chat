import { useEffect } from 'react'
import { devHint } from '../logging'
import { getExpoImagePicker, hasRoundVideoCapture, hasVoiceRecording } from '../optional'

// Hints for a feature that was asked for but cannot work without its optional peer.
const isRequested = (config: boolean | { isEnabled?: boolean } | undefined) =>
  config === true || (typeof config === 'object' && config.isEnabled === true)

export function useOptionalPeerHints (
  audioRecording: boolean | { isEnabled?: boolean } | undefined,
  videoRecording: boolean | { isEnabled?: boolean } | undefined
) {
  const isAudioRecordingRequested = isRequested(audioRecording)
  const isVideoRecordingRequested = isRequested(videoRecording)
  useEffect(() => {
    if (isAudioRecordingRequested && !hasVoiceRecording())
      devHint('voice-recording-peer', 'Chat: `audioRecording.isEnabled` is set but `expo-audio` is not installed - the mic button is hidden')
  }, [isAudioRecordingRequested])
  useEffect(() => {
    if (isVideoRecordingRequested && !hasRoundVideoCapture() && !getExpoImagePicker()?.launchCameraAsync)
      devHint('video-recording-peer', 'Chat: `videoRecording.isEnabled` is set but neither `react-native-vision-camera` nor `expo-image-picker` is installed - the camera button is hidden')
  }, [isVideoRecordingRequested])
}
