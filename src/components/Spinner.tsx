import React, { useEffect } from 'react'
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { getSvg } from '../optional'
import { arcPath } from './RadialProgress'

const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedPath: any = svg?.Path ? Animated.createAnimatedComponent(svg.Path) : null

/*
 * The indeterminate spinner: an arc that turns once every 2s while its length breathes in
 * 500ms phases. Rising, it grows 4 -> 270 degrees, accelerating; then it jumps 270 degrees
 * ahead and shrinks back to 4 from behind, decelerating.
 */
const ROTATION_MS = 2000
const PHASE_MS = 500
/** Four rise/fall cycles bring the 270-degree jumps back to a whole turn (4 x 270 = 3 x 360). */
const PERIOD_MS = 4000

/** The arc's start angle and signed sweep `ms` into the animation. */
export const spinnerFrame = (ms: number) => {
  'worklet'
  const cycle = Math.floor(ms / (PHASE_MS * 2))
  const inCycle = ms - cycle * PHASE_MS * 2
  const isRising = inCycle < PHASE_MS
  const t = (isRising ? inCycle : inCycle - PHASE_MS) / PHASE_MS
  const offset = (360 * ms) / ROTATION_MS + 270 * cycle + (isRising ? 0 : 270)
  // `AccelerateInterpolator` is t^2, `DecelerateInterpolator` 1 - (1 - t)^2.
  const sweep = isRising ? 4 + 266 * t * t : 4 - 270 * (1 - t) * (1 - t)
  return { start: offset % 360, sweep }
}

export interface SpinnerProps {
  /** Diameter of the arc (`setSize`). */
  size: number
  color: string
  /** Stroke width; 3 by default. */
  strokeWidth?: number
  style?: StyleProp<ViewStyle>
}

/** The indeterminate arc spinner. Falls back to the system spinner without react-native-svg. */
export function Spinner ({ size, color, strokeWidth = 3, style }: SpinnerProps) {
  const time = useSharedValue(0)

  useEffect(() => {
    time.value = 0
    time.value = withRepeat(withTiming(PERIOD_MS, { duration: PERIOD_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(time)
  }, [time])

  const half = size / 2
  // The arc is drawn on the size-diameter circle, half the stroke spilling outside it.
  const box = size + strokeWidth
  const centre = box / 2
  const animatedProps = useAnimatedProps(() => {
    const frame = spinnerFrame(time.value)
    return { d: arcPath(centre, centre, half, half, frame.start, frame.sweep) || 'M0 0' }
  })

  if (!Svg || !AnimatedPath)
    return (
      <View style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, style]}>
        <ActivityIndicator color={color} size='small' />
      </View>
    )

  return (
    <View accessibilityRole='progressbar' style={[{ width: box, height: box }, style]}>
      <Svg width={box} height={box}>
        <AnimatedPath
          animatedProps={animatedProps}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          fill='none'
        />
      </Svg>
    </View>
  )
}
