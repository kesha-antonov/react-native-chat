import { useCallback, useRef } from 'react'
import { SharedValue, cancelAnimation } from 'react-native-reanimated'

import { getAudioApi } from '../../optional'

// Optional waveform engine. Resolved through the optional-peer registry (`src/optional`) so the bundle
// works whether or not the consumer installed `react-native-audio-api`.
const audioApi = getAudioApi()

/** @deprecated Use `getChatCapabilities().waveform`. */
export const isWaveformAvailable = !!audioApi?.AudioContext

// One audio context for every note, made on the first play. Each `AudioContext` starts its own
// worklet runtime, which blocks the JS thread for a few hundred milliseconds, so one per bubble
// made a chat with a couple of voice notes open seconds late.
let sharedContext: any = null
export const getAudioContext = () => {
  if (!sharedContext && audioApi?.AudioContext)
    sharedContext = new audioApi.AudioContext()
  return sharedContext
}

/** Decodes without a context when the library can (`decodeAudioData` on the module). */
// The compiler cannot yet lower `?.`, `??` or a ternary inside a `try`, so the
// expressions that need one are kept out here.
export const stopSourceNode = (source: any) => {
  try {
    source?.stop?.()
  } catch {
    // already stopped
  }
}

export const bufferDuration = (buffer: any, fallback: number | undefined): number => buffer.duration ?? fallback ?? 0

export const decodeAudio = (source: string | ArrayBuffer): Promise<any> => {
  if (typeof audioApi?.decodeAudioData === 'function')
    return audioApi.decodeAudioData(source)
  const ctx = getAudioContext()
  // `decodeAudioDataSource` is the name in older react-native-audio-api releases.
  return typeof ctx.decodeAudioData === 'function' ? ctx.decodeAudioData(source) : ctx.decodeAudioDataSource(source)
}

/**
 * The refs a note's source (download + decode) and its playback share: the decoded buffer, the
 * running source node, the length, and the timer that keeps the bars on the audio clock.
 */
export const useAudioEngine = (progress: SharedValue<number>, durationProp: number | undefined) => {
  const bufferRef = useRef<any>(null)
  const sourceRef = useRef<any>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(durationProp ?? 0)
  // A tap on play before a local file has decoded starts it once it has.
  const pendingPlayRef = useRef(false)
  // The latest `playFrom`, for the decode effect and the playlist, which are set up before it.
  const playFromRef = useRef<(fraction: number) => void>(() => {})

  const stopRaf = useCallback(() => {
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
    cancelAnimation(progress)
  }, [progress])

  // Whichever source is running when called, not the one that was when an effect was set up.
  const stopRunningSource = useCallback(() => {
    stopSourceNode(sourceRef.current)
  }, [])

  return { bufferRef, sourceRef, tickTimerRef, durationRef, pendingPlayRef, playFromRef, stopRaf, stopRunningSource }
}
