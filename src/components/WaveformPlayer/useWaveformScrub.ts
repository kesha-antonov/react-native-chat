import { Dispatch, RefObject, SetStateAction, useCallback, useLayoutEffect, useRef } from 'react'
import { useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import { SharedValue, cancelAnimation, runOnJS, useSharedValue } from 'react-native-reanimated'

import { DRAG_SLOP } from '../voiceWaveform'

interface WaveformScrubOptions {
  isViewOnce: boolean
  progress: SharedValue<number>
  isDragging: SharedValue<boolean>
  trackWidthSV: SharedValue<number>
  durationRef: RefObject<number>
  togglePlayback: () => void
  commitSeek: (fraction: number) => void
  setShownProgress: Dispatch<SetStateAction<number>>
}

/** The waveform's tap-to-toggle and drag-to-seek gesture. */
export const useWaveformScrub = ({
  isViewOnce,
  progress,
  isDragging,
  trackWidthSV,
  durationRef,
  togglePlayback,
  commitSeek,
  setShownProgress,
}: WaveformScrubOptions) => {
  const dragStart = useSharedValue(0)

  // The gesture is built once; it reaches the latest handlers through refs.
  const toggleRef = useRef(togglePlayback)
  const commitSeekRef = useRef(commitSeek)
  useLayoutEffect(() => {
    toggleRef.current = togglePlayback
    commitSeekRef.current = commitSeek
  })
  const onWaveformTap = useCallback(() => toggleRef.current(), [])
  const onWaveformDragEnd = useCallback((fraction: number) => commitSeekRef.current(fraction), [])

  // While dragging, the time follows the finger;
  // only a new whole second re-renders.
  const onWaveformDrag = useCallback((fraction: number) => {
    const duration = durationRef.current
    setShownProgress(prev =>
      duration > 0 && Math.floor(prev * duration) === Math.floor(fraction * duration) ? prev : fraction
    )
  }, [durationRef, setShownProgress])

  // A tap toggles playback, like a tap on the button (a release that never started dragging). A drag only
  // starts past a 0.2cm slop, and must stay horizontal, or it fights
  // the message list. The drag is relative: the progress moves by the finger's
  // travel rather than jumping to where it went down.
  const waveformPan = usePanGesture({
    // A view-once note can never be scrubbed.
    enabled: !isViewOnce,
    activeOffsetX: [-DRAG_SLOP, DRAG_SLOP],
    failOffsetY: [-12, 12],
    testID: 'voice-waveform-pan',
    onActivate: () => {
      isDragging.set(true)
      cancelAnimation(progress)
      dragStart.set(progress.get())
    },
    onUpdate: event => {
      const width = trackWidthSV.get()
      if (width <= 0)
        return

      progress.set(Math.max(0, Math.min(1, dragStart.get() + event.translationX / width)))
      runOnJS(onWaveformDrag)(progress.get())
    },
    onDeactivate: () => {
      runOnJS(onWaveformDragEnd)(progress.get())
    },
    onFinalize: () => {
      isDragging.set(false)
    },
  })
  const waveformTap = useTapGesture({
    maxDistance: DRAG_SLOP,
    testID: 'voice-waveform-tap',
    onDeactivate: event => {
      if (!event.canceled)
        runOnJS(onWaveformTap)()
    },
  })
  return useCompetingGestures(waveformPan, waveformTap)
}
