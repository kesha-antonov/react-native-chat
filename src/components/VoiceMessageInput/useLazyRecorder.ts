import { useCallback, useEffect, useMemo, useRef } from 'react'

import { expoAudio, platformRecordingOptions, releaseRecorder } from './recorder'

/** The expo-audio recorder, built on first use and released with the component. */
export function useLazyRecorder () {
  // Metering drives the halo and the preview waveform, so it has to be
  // switched on with the preset - it is off by default.
  const recorderOptions = useMemo(
    () => ({ ...expoAudio.RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }),
    []
  )
  // The recorder is built on the first take, not when the composer mounts: creating the native
  // recorder cost about 30ms of every chat opening, for a feature most chats never use.
  const recorderRef = useRef<any>(null)
  const getRecorder = useCallback(() => {
    if (!recorderRef.current)
      recorderRef.current = new expoAudio.AudioModule.AudioRecorder(platformRecordingOptions(recorderOptions))
    return recorderRef.current
  }, [recorderOptions])
  useEffect(() => () => {
    releaseRecorder(recorderRef.current)
    recorderRef.current = null
  }, [])

  return { recorderOptions, recorderRef, getRecorder }
}
