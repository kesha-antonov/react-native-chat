import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '../hooks/useTheme'
import { getSvg } from '../optional'

const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedRect: any = svg?.Rect ? Animated.createAnimatedComponent(svg.Rect) : null

/*
 * The loading placeholder: rows of 72 + 1, each a 28-radius avatar 10 in, a name bar
 * 76..148 x 16..24, a message bar 76..268 x 38..46 (radius 4) and a date bar 50..12 in from
 * the right. One vertical band, 600 tall, sweeps down over all of them at `height / 400` per ms.
 * Without react-native-svg the bars pulse instead.
 */
const ROW = 72 + 1
const AVATAR_R = 28
const GRADIENT = 600

export function ChatListShimmer () {
  const colors = useTheme().chatList
  const [size, setSize] = useState({ width: 0, height: 0 })
  const offset = useSharedValue(-GRADIENT * 2)
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (!size.height)
      return
    if (!Svg) {
      pulse.value = withRepeat(withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true)
      return () => cancelAnimation(pulse)
    }
    const distance = size.height * 2 + GRADIENT * 2
    const duration = (distance * 400) / size.height
    offset.value = -GRADIENT * 2
    offset.value = withRepeat(withTiming(size.height * 2, { duration, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(offset)
  }, [size.height, offset, pulse])

  const bandProps = useAnimatedProps(() => ({ y: offset.value }))
  // The bars outside the band, drawn around it rather than under it so its translucent ends do
  // not double up.
  const aboveProps = useAnimatedProps(() => ({ height: Math.max(0, offset.value) }))
  const belowProps = useAnimatedProps(() => ({ y: Math.max(0, offset.value + GRADIENT) }))
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
  }

  const rows = Math.ceil(size.height / ROW) + 1
  const { width } = size

  if (!Svg) {
    const bar = { backgroundColor: colors.shimmer, opacity: colors.shimmerOpacity }
    return (
      <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents='none' testID='chat-list-shimmer'>
        <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
          {Array.from({ length: rows }, (_, index) => (
            <View key={index} style={[styles.row, { top: index * ROW }]}>
              <View style={[styles.avatar, bar]} />
              <View style={[styles.name, bar]} />
              <View style={[styles.message, bar]} />
              <View style={[styles.date, bar]} />
            </View>
          ))}
        </Animated.View>
      </View>
    )
  }

  const { Defs, LinearGradient, Stop, ClipPath, G, Circle, Rect } = svg
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents='none' testID='chat-list-shimmer'>
      {width > 0 && (
        <Svg width={width} height={size.height}>
          <Defs>
            <LinearGradient id='flicker' x1='0' y1='0' x2='0' y2='1'>
              <Stop offset='0' stopColor={colors.shimmer} stopOpacity={colors.shimmerOpacity} />
              <Stop offset='0.4' stopColor={colors.shimmerHighlight} />
              <Stop offset='0.6' stopColor={colors.shimmerHighlight} />
              <Stop offset='1' stopColor={colors.shimmer} stopOpacity={colors.shimmerOpacity} />
            </LinearGradient>
            <ClipPath id='rows'>
              {Array.from({ length: rows }, (_, index) => {
                const top = index * ROW
                return (
                  <G key={index}>
                    <Circle cx={10 + AVATAR_R} cy={top + ROW / 2} r={AVATAR_R} />
                    <Rect x={76} y={top + 16} width={72} height={8} rx={4} />
                    <Rect x={76} y={top + 38} width={192} height={8} rx={4} />
                    <Rect x={width - 50} y={top + 16} width={38} height={8} rx={4} />
                  </G>
                )
              })}
            </ClipPath>
          </Defs>
          <G clipPath='url(#rows)'>
            <AnimatedRect animatedProps={aboveProps} x={0} y={0} width={width} fill={colors.shimmer} fillOpacity={colors.shimmerOpacity} />
            <AnimatedRect animatedProps={belowProps} x={0} width={width} height={size.height + GRADIENT * 2} fill={colors.shimmer} fillOpacity={colors.shimmerOpacity} />
            <AnimatedRect animatedProps={bandProps} x={0} width={width} height={GRADIENT} fill='url(#flicker)' />
          </G>
        </Svg>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
  },
  avatar: {
    position: 'absolute',
    left: 10,
    top: ROW / 2 - AVATAR_R,
    width: AVATAR_R * 2,
    height: AVATAR_R * 2,
    borderRadius: AVATAR_R,
  },
  name: {
    position: 'absolute',
    left: 76,
    top: 16,
    width: 72,
    height: 8,
    borderRadius: 4,
  },
  message: {
    position: 'absolute',
    left: 76,
    top: 38,
    width: 192,
    height: 8,
    borderRadius: 4,
  },
  date: {
    position: 'absolute',
    right: 12,
    top: 16,
    width: 38,
    height: 8,
    borderRadius: 4,
  },
})
