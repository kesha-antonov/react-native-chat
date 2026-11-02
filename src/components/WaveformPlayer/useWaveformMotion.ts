import { useEffect, useState } from 'react'
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// Bars of a just-sent note grow left to right
// over 600ms after a 125ms delay, eased out-quint.
const APPEAR_DELAY_MS = 125
const APPEAR_MS = 600
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
// The loading shimmer: 1.6 widths of travel every 270ms of
// `t^0.75`, which comes to one sweep about every 430ms, and it
// fades out over 150ms once the file is ready.
const SWEEP_MS = 432
const LOADING_FADE_MS = 150

/**
 * The waveform's two animations: the loading shimmer that sweeps over the bars, and the
 * grow-in of a just-sent note's bars.
 */
export const useWaveformMotion = ({
  isShimmering,
  appearOnMount,
  hasLevels,
}: {
  isShimmering: boolean
  appearOnMount: boolean
  hasLevels: boolean
}) => {
  const loading = useSharedValue(0)
  const sweep = useSharedValue(0)
  const [isSweepMounted, setIsSweepMounted] = useState(false)

  const appear = useSharedValue(appearOnMount ? 0 : 1)
  const [isAppearing, setIsAppearing] = useState(appearOnMount)

  useEffect(() => {
    if (isShimmering) {
      setIsSweepMounted(true)
      loading.set(withTiming(1, { duration: LOADING_FADE_MS }))
      sweep.set(0)
      sweep.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.poly(0.75) }), -1, false))
      return
    }

    loading.set(withTiming(0, { duration: LOADING_FADE_MS }, finished => {
      if (!finished)
        return

      cancelAnimation(sweep)
      runOnJS(setIsSweepMounted)(false)
    }))
  }, [isShimmering, loading, sweep])

  // Bars of a just-sent note grow in once there is a waveform to grow.
  useEffect(() => {
    if (!appearOnMount || !hasLevels || appear.get() !== 0)
      return

    appear.set(withDelay(
      APPEAR_DELAY_MS,
      withTiming(1, { duration: APPEAR_MS, easing: EASE_OUT_QUINT }, finished => {
        if (finished)
          runOnJS(setIsAppearing)(false)
      })
    ))
  }, [appearOnMount, hasLevels, appear])

  useEffect(() => () => {
    cancelAnimation(appear)
    cancelAnimation(sweep)
    cancelAnimation(loading)
  }, [appear, sweep, loading])

  return { loading, sweep, isSweepMounted, appear, isAppearing }
}
