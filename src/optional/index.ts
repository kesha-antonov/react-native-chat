/**
 * The one place optional peer dependencies are resolved.
 *
 * Policy: a feature turns on by itself when its peer is installed and hides when it is not.
 * Each getter keeps a literal `require('pkg')` inside its own `try`, in the same function -
 * Metro needs exactly that to treat the import as optional and not fail the build when the
 * package is absent -
 * and resolves on first use, not when the library is imported. The result (the module, or
 * `null`) is memoized, so a missing peer costs one failed lookup per app run.
 */
import { Platform } from 'react-native'

const cache = new Map<string, any>()

// `load` must hold its own `try { return require('pkg') } catch {}`: Metro marks a dependency
// optional only when the `try` encloses the `require` inside the same function, so a `try`
// up here around a callback would not count and a missing package would fail the build.
const resolve = (name: string, load: () => any): any => {
  if (!cache.has(name))
    cache.set(name, load() ?? null)

  return cache.get(name)
}

export const getExpoAudio = (): any => resolve('expo-audio', () => {
  try {
    return require('expo-audio')
  } catch {
    return null
  }
})
export const getExpoVideo = (): any => resolve('expo-video', () => {
  try {
    return require('expo-video')
  } catch {
    return null
  }
})
export const getExpoBlur = (): any => resolve('expo-blur', () => {
  try {
    return require('expo-blur')
  } catch {
    return null
  }
})
export const getExpoHaptics = (): any => resolve('expo-haptics', () => {
  try {
    return require('expo-haptics')
  } catch {
    return null
  }
})
export const getExpoImagePicker = (): any => resolve('expo-image-picker', () => {
  try {
    return require('expo-image-picker')
  } catch {
    return null
  }
})
export const getExpoDevice = (): any => resolve('expo-device', () => {
  try {
    return require('expo-device')
  } catch {
    return null
  }
})
export const getExpoFileSystem = (): any => resolve('expo-file-system', () => {
  try {
    return require('expo-file-system')
  } catch {
    return null
  }
})
export const getAudioApi = (): any => resolve('react-native-audio-api', () => {
  try {
    return require('react-native-audio-api')
  } catch {
    return null
  }
})
export const getSvg = (): any => resolve('react-native-svg', () => {
  try {
    return require('react-native-svg')
  } catch {
    return null
  }
})
export const getStreamdown = (): any => resolve('react-native-streamdown', () => {
  try {
    return require('react-native-streamdown')
  } catch {
    return null
  }
})
export const getTrueSheet = (): any => resolve('@lodev09/react-native-true-sheet', () => {
  try {
    return require('@lodev09/react-native-true-sheet')
  } catch {
    return null
  }
})
export const getFlashList = (): any => resolve('@shopify/flash-list', () => {
  try {
    return require('@shopify/flash-list')
  } catch {
    return null
  }
})
// vision-camera 5 creates its native `CameraFactory` while it loads, so a JS package without the
// native module behind it throws here and counts as not installed.
export const getVisionCamera = (): any => resolve('react-native-vision-camera', () => {
  try {
    return require('react-native-vision-camera')
  } catch {
    return null
  }
})

/** Writes plain text to the system clipboard. */
export interface ClipboardAdapter {
  setString: (text: string) => void
}

/**
 * The first clipboard that resolves: `expo-clipboard`, then
 * `@react-native-clipboard/clipboard`, then the browser's on web, then the one React Native
 * still ships (read through its own module path, as `require('react-native').Clipboard` logs
 * a deprecation warning on every app that touches it).
 */
export const getClipboard = (): ClipboardAdapter | null => resolve('clipboard', () => {
  const expoClipboard = resolve('expo-clipboard', () => {
    try {
      return require('expo-clipboard')
    } catch {
      return null
    }
  })
  if (expoClipboard?.setStringAsync)
    return {
      setString: (text: string) => {
        expoClipboard.setStringAsync(text)?.catch?.(() => {})
      },
    }

  const communityModule = resolve('@react-native-clipboard/clipboard', () => {
    try {
      return require('@react-native-clipboard/clipboard')
    } catch {
      return null
    }
  })
  const community = communityModule?.default ?? communityModule
  if (community?.setString)
    return { setString: (text: string) => community.setString(text) }

  if (Platform.OS === 'web') {
    const webClipboard = (globalThis as any).navigator?.clipboard
    if (webClipboard?.writeText)
      return {
        setString: (text: string) => {
          webClipboard.writeText(text)?.catch?.(() => {})
        },
      }
    return null
  }

  const coreModule = resolve('react-native-clipboard-core', () => {
    try {
      return require('react-native/Libraries/Components/Clipboard/Clipboard')
    } catch {
      return null
    }
  })
  const core = coreModule?.default ?? coreModule
  if (core?.setString)
    return { setString: (text: string) => core.setString(text) }

  return null
})

/**
 * Forget every resolved module. Only for tests that swap a peer's mock between cases;
 * an app never needs it.
 * @internal
 */
export const resetOptionalModules = () => cache.clear()

/** Which optional features this install can offer, from the peers that resolve. */
export interface ChatCapabilities {
  /** Haptic ticks on long-press, recording and swipe-to-reply (`expo-haptics`). */
  haptics: boolean
  /** The "Copy" message action (`expo-clipboard` or `@react-native-clipboard/clipboard`). */
  clipboard: boolean
  /** Blurred backdrop behind the context menu and the round video recorder (`expo-blur`). */
  blur: boolean
  /** Lucide icons and the vector rings / morphs (`react-native-svg`). */
  svg: boolean
  /** Inline voice and audio playback (`expo-audio`). */
  audioPlayback: boolean
  /** Voice note waveforms, resume and trim (`react-native-audio-api`). */
  waveform: boolean
  /** Hold-to-record voice notes (`expo-audio`). */
  voiceRecording: boolean
  /** Inline video and round video note playback (`expo-video`). */
  videoPlayback: boolean
  /** In-chat round video capture (`react-native-vision-camera` 5). */
  roundVideoCapture: boolean
  /** Any video recording: in-chat capture, or the system camera (`expo-image-picker`). */
  videoRecording: boolean
  /** Rich streaming markdown (`react-native-streamdown`). */
  markdown: boolean
  /** Native bottom sheet for attachments (`@lodev09/react-native-true-sheet`). */
  nativeSheet: boolean
  /** The FlashList list engine (`@shopify/flash-list`). */
  flashList: boolean
}

export const hasHaptics = () => !!getExpoHaptics()?.impactAsync
export const hasBlur = () => !!getExpoBlur()?.BlurView
export const hasClipboard = () => !!getClipboard()
export const hasAudioPlayback = () => {
  const audio = getExpoAudio()
  return !!(audio?.useAudioPlayer && audio?.useAudioPlayerStatus)
}
export const hasVoiceRecording = () => {
  const audio = getExpoAudio()
  return !!(audio?.useAudioRecorder && audio?.RecordingPresets && audio?.AudioModule)
}
export const hasVideoPlayback = () => {
  const video = getExpoVideo()
  return !!(video?.VideoView && video?.useVideoPlayer)
}
export const hasRoundVideoCapture = () => {
  const camera = getVisionCamera()
  return !!(camera?.Camera && camera?.useVideoOutput && camera?.VisionCamera)
}

/**
 * Which optional features the installed peers allow. Resolves each peer on the first call, so
 * call it when you need it (e.g. to build UI that matches the chat's), not at import time.
 *
 * ```ts
 * const { clipboard, voiceRecording } = getChatCapabilities()
 * ```
 */
export function getChatCapabilities (): ChatCapabilities {
  const svg = getSvg()
  const roundVideoCapture = hasRoundVideoCapture()
  return {
    haptics: hasHaptics(),
    clipboard: hasClipboard(),
    blur: hasBlur(),
    svg: !!((svg?.default ?? svg?.Svg) && svg?.Path),
    audioPlayback: hasAudioPlayback(),
    waveform: !!getAudioApi()?.AudioContext,
    voiceRecording: hasVoiceRecording(),
    videoPlayback: hasVideoPlayback(),
    roundVideoCapture,
    videoRecording: roundVideoCapture || !!getExpoImagePicker()?.launchCameraAsync,
    markdown: !!(getStreamdown()?.Streamdown ?? getStreamdown()?.default),
    nativeSheet: !!getTrueSheet()?.TrueSheet,
    flashList: !!getFlashList()?.FlashList,
  }
}
