import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { ClipPath, Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/*
 * The chat-list placeholder:
 * - rows of 72 + 1, each a 28-radius avatar 10 in, a name bar 76..148 x 16..24 and a message
 *   bar 76..268 x 38..46, both with radius 4, and a date bar 50..12 in from the right;
 * - one vertical gradient over all of them, 600 tall, stops `[shape, highlight, highlight, shape]`
 *   at `[0, 0.4, 0.6, 1]`;
 * - moving down `height / 400` per ms from -1200 to twice the height, then starting over.
 */
const ROW = 72 + 1
const AVATAR_R = 28
const GRADIENT = 600

export interface ChatListShimmerColors {
  /** `listSelector`: the bars themselves, as a color and its alpha (svg stops take them apart). */
  shape: string
  shapeOpacity: number
  /** `actionBarDefaultSubmenuBackground`: the band that sweeps over them. */
  highlight: string
}

/** Day: `#0F000000` bars, a white band. Dark Blue: `#14E6F7FF` bars, a `#283848` band. */
export const SHIMMER_COLORS: Record<'light' | 'dark', ChatListShimmerColors> = {
  light: { shape: '#000000', shapeOpacity: 0x0f / 255, highlight: '#FFFFFF' },
  dark: { shape: '#E6F7FF', shapeOpacity: 0x14 / 255, highlight: '#283848' },
}

export function ChatListShimmer ({ colors }: { colors: ChatListShimmerColors }) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const offset = useSharedValue(-GRADIENT * 2)

  useEffect(() => {
    if (!size.height)
      return
    const distance = size.height * 2 + GRADIENT * 2
    const duration = (distance * 400) / size.height
    offset.value = -GRADIENT * 2
    offset.value = withRepeat(withTiming(size.height * 2, { duration, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(offset)
  }, [size.height, offset])

  const bandProps = useAnimatedProps(() => ({ y: offset.value }))
  // The bars outside the band, in the plain shape color (the gradient clamps to it), drawn
  // around the band rather than under it so its translucent ends do not double up.
  const aboveProps = useAnimatedProps(() => ({ height: Math.max(0, offset.value) }))
  const belowProps = useAnimatedProps(() => ({ y: Math.max(0, offset.value + GRADIENT) }))

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
  }

  const rows = Math.ceil(size.height / ROW) + 1
  const { width } = size

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents='none' testID='chat-list-shimmer'>
      {width > 0 && (
        <Svg width={width} height={size.height}>
          <Defs>
            <LinearGradient id='flicker' x1='0' y1='0' x2='0' y2='1'>
              <Stop offset='0' stopColor={colors.shape} stopOpacity={colors.shapeOpacity} />
              <Stop offset='0.4' stopColor={colors.highlight} />
              <Stop offset='0.6' stopColor={colors.highlight} />
              <Stop offset='1' stopColor={colors.shape} stopOpacity={colors.shapeOpacity} />
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
            <AnimatedRect animatedProps={aboveProps} x={0} y={0} width={width} fill={colors.shape} fillOpacity={colors.shapeOpacity} />
            <AnimatedRect animatedProps={belowProps} x={0} width={width} height={size.height + GRADIENT * 2} fill={colors.shape} fillOpacity={colors.shapeOpacity} />
            <AnimatedRect animatedProps={bandProps} x={0} width={width} height={GRADIENT} fill='url(#flicker)' />
          </G>
        </Svg>
      )}
    </View>
  )
}
