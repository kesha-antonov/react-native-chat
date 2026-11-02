import { Platform } from 'react-native'

import { getExpoAudio, hasVoiceRecording } from '../../optional'
import { METERING_FLOOR_DB } from './constants'

// Optional recorder. Resolved through the optional-peer registry (`src/optional`) so the bundle works
// whether or not the consumer installed `expo-audio` (Metro treats
// try/catch-wrapped requires as optional dependencies).
export const expoAudio = getExpoAudio()

/** @deprecated Use `getChatCapabilities().voiceRecording`. */
export const isVoiceRecordingAvailable = hasVoiceRecording()

/** Map an expo-audio metering value (dB) onto a 0..1 bar height. */
export const normalizeMetering = (db: number | undefined) => {
  if (db == null || !Number.isFinite(db))
    return 0

  const clamped = Math.max(METERING_FLOOR_DB, Math.min(0, db))
  return (clamped - METERING_FLOOR_DB) / -METERING_FLOOR_DB
}

/** The message field a view-once take adds (`IMessage.isViewOnce`). */
export const viewOnceFields = (isViewOnce: boolean) => (isViewOnce ? { isViewOnce: true } : null)

// The three best-effort native calls below live at module level because the compiler cannot
// lower an optional chain inside a `try`, and so would skip the whole component.
export const releaseRecorder = (recorder: any) => {
  try {
    recorder?.release?.()
  } catch {
    // already released
  }
}

export const stopRecorderQuietly = (recorder: any) => {
  try {
    const stopped = recorder?.stop() as unknown as Promise<void> | undefined
    stopped?.catch?.(() => {})
  } catch {
    // already stopped
  }
}

// Leaves the audio session as we found it. Recording puts iOS into
// PlayAndRecord, which routes playback to the quiet receiver; not restoring it
// makes every voice note played afterwards sound muffled.
export const releaseAudioSession = () => {
  try {
    expoAudio.setAudioModeAsync?.({ allowsRecording: false, playsInSilentMode: true })
  } catch {
    // best-effort; the session is not worth failing a send over
  }
}

/**
 * expo-audio's recording options for this platform, as `useAudioRecorder` builds them before
 * creating its recorder (`createRecordingOptions`, which the package does not export).
 */
export const platformRecordingOptions = (options: any) => {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  }
  if (Platform.OS === 'ios' || Platform.OS === 'android')
    return { ...common, directory: options.directory, fileName: options.fileName, ...options[Platform.OS] }
  return { ...common, ...options.web }
}
