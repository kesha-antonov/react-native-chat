import React from 'react'
import { View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { barStyles } from './styles'

/** A static row of bars, or a flat seek line when there is no waveform. */
export const Bars = ({ heights, color, width }: { heights: number[], color: string, width?: number }) => (
  <View style={[barStyles.row, width != null && { width }]}>
    {heights.length
      ? heights.map((height, index) => (
        // Heights and color are per-bar runtime values, so they stay inline.
        <View key={index} style={[barStyles.bar, { height, backgroundColor: color }]} />
      ))
      : <View style={[barStyles.line, { backgroundColor: color }]} />}
  </View>
)

export const AppearingBar = ({
  index,
  count,
  height,
  color,
  appear,
}: {
  index: number
  count: number
  height: number
  color: string
  appear: SharedValue<number>
}) => {
  // Each bar takes its own 1/count slice of the animation, from 1 tall, so
  // the waveform sweeps in left to right.
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, appear.value * count - index))
    return { height: 1 + (height - 1) * t }
  })

  return <Animated.View style={[barStyles.bar, { backgroundColor: color }, style]} />
}

/**
 * A band of the played color clipped to a window over the bars, moved by the
 * loading sweep. Stands in for a linear-gradient shader: two nested
 * bands of different widths approximate a soft falloff.
 */
export const SweepBand = ({
  heights,
  color,
  width,
  sweep,
  loading,
  bandFraction,
  opacity,
}: {
  heights: number[]
  color: string
  width: number
  sweep: SharedValue<number>
  loading: SharedValue<number>
  bandFraction: number
  opacity: number
}) => {
  const bandStyle = useAnimatedStyle(() => {
    // The band's centre runs from -0.4 to 1.2 widths, so the
    // sweep enters and leaves fully off the bars.
    const centre = (-0.4 + 1.6 * sweep.value) * width
    return {
      left: centre - (bandFraction * width) / 2,
      width: bandFraction * width,
      opacity: opacity * loading.value,
    }
  })
  const innerStyle = useAnimatedStyle(() => {
    const centre = (-0.4 + 1.6 * sweep.value) * width
    return { left: -(centre - (bandFraction * width) / 2) }
  })

  return (
    <Animated.View pointerEvents='none' style={[barStyles.clip, bandStyle]}>
      <Animated.View style={[barStyles.clipContent, innerStyle]}>
        <Bars heights={heights} color={color} width={width} />
      </Animated.View>
    </Animated.View>
  )
}
