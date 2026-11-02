import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  interpolateColor,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'

import { getSvg } from '../optional'

const svg = getSvg()
const Svg: any = svg ? svg.default ?? svg.Svg : null
const Path: any = svg?.Path
const AnimatedPath: any = Path ? Animated.createAnimatedComponent(Path) : null

/**
 * The bubble tail, drawn in a
 * box whose origin is one point inside the body's bottom corner: the body's edge runs down to
 * 11pt above its bottom, a concave arc (an ellipse 13 wide and 20 tall, 6dp `smallRad`) curls
 * out to the tip 5.4pt beyond the body, and the bottom edge runs straight back. The first
 * column overlaps the body so no seam shows between the two.
 */
export const TAIL_WIDTH = 6
const TAIL_BOX_WIDTH = TAIL_WIDTH + 1
const TAIL_HEIGHT = 11
const TAIL_PATH = 'M0 0 L1 0 A6.5 10 0 0 0 6.708 9.925 L6.4 11 L0 11 Z'
// The 1px drop under the bubble continues under the tail.
const TAIL_SHADOW_PATH = 'M0 1 L1 1 A6.5 10 0 0 0 6.708 10.925 L6.4 12 L0 12 Z'

/** What a bubble needs to show its slice of a gradient fixed to the message list. */
export interface BubbleGradientStore {
  /** The list's scroll offset, live: the bubbles' gradient and tails follow it every frame. */
  scrolledY: SharedValue<number>
  listHeight: SharedValue<number>
  /**
   * One row's place in list content coordinates, by message id; undefined until the list has
   * placed it. One shared value per message, so a row that moves re-runs its own bubble's
   * worklets and no other's.
   */
  cellLayout: (messageId: string) => SharedValue<{ y: number, height: number } | undefined>
  /** Holds the row's entry while the bubble is mounted; returns the release. */
  retainCell?: (messageId: string) => () => void
  isInverted: boolean
}

export const BubbleGradientContext = createContext<BubbleGradientStore | null>(null)

interface TailProps {
  /** The side of the screen the tail points to. */
  side: 'left' | 'right'
  color: string
  shadowColor?: string
  /** Overrides `color` from the UI thread (a bubble sliding through a screen-fixed gradient). */
  animatedColor?: SharedValue<string>
}

const mirrorStyle: ViewStyle = { transform: [{ scaleX: -1 }] }

const SvgTail = ({ side, color, shadowColor, animatedColor }: TailProps) => {
  const animatedProps = useAnimatedProps(() => ({ fill: animatedColor ? animatedColor.value : color }))

  return (
    <View
      pointerEvents='none'
      style={[styles.tail, side === 'right' ? styles.tailRight : styles.tailLeft, side === 'left' && mirrorStyle]}
    >
      <Svg width={TAIL_BOX_WIDTH} height={TAIL_HEIGHT + 1} viewBox={`0 0 ${TAIL_BOX_WIDTH} ${TAIL_HEIGHT + 1}`}>
        {!!shadowColor && shadowColor !== 'transparent' && <Path d={TAIL_SHADOW_PATH} fill={shadowColor} />}
        {animatedColor
          ? <AnimatedPath d={TAIL_PATH} animatedProps={animatedProps} />
          : <Path d={TAIL_PATH} fill={color} />}
      </Svg>
    </View>
  )
}

// Without react-native-svg the curl becomes a straight-edged wedge drawn with borders.
const ViewTail = ({ side, color, animatedColor }: TailProps) => {
  const colorStyle = useAnimatedStyle(() => {
    const value = animatedColor ? animatedColor.value : color
    return side === 'right' ? { borderLeftColor: value } : { borderRightColor: value }
  })

  return (
    <Animated.View
      pointerEvents='none'
      style={[
        styles.tail,
        side === 'right' ? styles.tailRight : styles.tailLeft,
        side === 'right' ? styles.wedgeRight : styles.wedgeLeft,
        side === 'right' ? { borderLeftColor: color } : { borderRightColor: color },
        animatedColor && colorStyle,
      ]}
    />
  )
}

/** The curled tail at the bottom corner of the last bubble in a run. */
export const BubbleTail = (props: TailProps) => {
  if (Svg && Path) {
    if (props.animatedColor)
      return <SvgTail {...props} />

    return <StaticSvgTail {...props} />
  }

  if (props.animatedColor)
    return <ViewTail {...props} />

  return <StaticViewTail {...props} />
}

// The common case carries no shared value and no worklet: most tails never change color.
const StaticSvgTail = ({ side, color, shadowColor }: TailProps) => (
  <View
    pointerEvents='none'
    style={[styles.tail, side === 'right' ? styles.tailRight : styles.tailLeft, side === 'left' && mirrorStyle]}
  >
    <Svg width={TAIL_BOX_WIDTH} height={TAIL_HEIGHT + 1} viewBox={`0 0 ${TAIL_BOX_WIDTH} ${TAIL_HEIGHT + 1}`}>
      {!!shadowColor && shadowColor !== 'transparent' && <Path d={TAIL_SHADOW_PATH} fill={shadowColor} />}
      <Path d={TAIL_PATH} fill={color} />
    </Svg>
  </View>
)

const StaticViewTail = ({ side, color }: TailProps) => (
  <View
    pointerEvents='none'
    style={[
      styles.tail,
      side === 'right' ? styles.tailRight : styles.tailLeft,
      side === 'right' ? styles.wedgeRight : styles.wedgeLeft,
      side === 'right' ? { borderLeftColor: color } : { borderRightColor: color },
    ]}
  />
)

/** A CSS gradient, top to bottom, with the stops spread evenly. */
export const linearGradientStyle = (stops: string[]): ViewStyle => {
  const last = Math.max(1, stops.length - 1)
  const css = `linear-gradient(to bottom, ${stops.map((stop, i) => `${stop} ${Math.round((i / last) * 1000) / 10}%`).join(', ')})`
  return { backgroundImage: css, experimental_backgroundImage: css } as ViewStyle
}

interface GradientBackgroundProps {
  stops: string[]
  mode: 'screen' | 'bubble'
  messageId: string | number
  /** Space under the bubble inside its list cell (the gap to the next row). */
  bottomGap: number
  /** The body's corner radii, so the fill is clipped like the bubble. */
  cornerStyle: StyleProp<ViewStyle>
  /** Draw the tail on this side, sampling the gradient at the bubble's bottom. */
  tailSide?: 'left' | 'right'
}

const TAIL_COLOR_STEPS = 20

const evenStops = (count: number) => {
  const last = Math.max(1, count - 1)
  return Array.from({ length: count }, (_, i) => i / last)
}

/**
 * The outgoing gradient: one vertical gradient spans
 * the message list, and each bubble paints the slice behind it, so a bubble shifts from
 * purple to blue as it scrolls and two bubbles read as one ramp. Each bubble holds a
 * list-tall gradient and slides it by its own position, from the cell layout and the scroll
 * offset - no measuring on the UI thread.
 */
const ScreenGradientBackground = ({ stops, messageId, bottomGap, cornerStyle, tailSide, store }: GradientBackgroundProps & { store: BubbleGradientStore }) => {
  const { scrolledY, listHeight, isInverted } = store
  const cellLayout = useMemo(() => store.cellLayout(String(messageId)), [store, messageId])
  const { retainCell } = store
  useEffect(() => retainCell?.(String(messageId)), [retainCell, messageId])
  const positions = evenStops(stops.length)

  // The gradient slides with the scroll on every frame, so it is one worklet that computes the
  // bubble's bottom edge (in points from the top of the list) and the layer's offset together:
  // a derived value in between doubled the per-bubble, per-frame work, which on Android cost
  // about a third more dropped frames in a fling.
  const layerStyle = useAnimatedStyle(() => {
    const layout = cellLayout.value
    const height = listHeight.value > 0 ? listHeight.value : 800
    const bottom = !layout
      ? height / 2
      : isInverted
        ? height + scrolledY.value - layout.y - bottomGap
        : layout.y + layout.height - bottomGap - scrolledY.value
    return {
      height,
      transform: [{ translateY: height - bottom }],
    }
  })

  // The tail samples the gradient at the bubble's bottom, live. Its colour snaps to one of
  // TAIL_COLOR_STEPS along the gradient: the tail is an SVG path, and redrawing it on every frame
  // of a fling cost Android more than the whole sliding gradient. Snapped, it is redrawn only when
  // its colour actually changes (Reanimated skips unchanged props), and a 6pt tail does not show
  // the steps.
  const tailColor = useDerivedValue(() => {
    const layout = cellLayout.value
    const height = listHeight.value
    if (!layout || height <= 0)
      return stops[stops.length - 1]
    const bottom = isInverted
      ? height + scrolledY.value - layout.y - bottomGap
      : layout.y + layout.height - bottomGap - scrolledY.value
    const fraction = Math.round(Math.min(1, Math.max(0, bottom / height)) * TAIL_COLOR_STEPS) / TAIL_COLOR_STEPS
    return interpolateColor(fraction, positions, stops) as string
  })

  return (
    <>
      <View pointerEvents='none' style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: stops[stops.length - 1] }, cornerStyle]}>
        <Animated.View style={[styles.layer, linearGradientStyle(stops), layerStyle]} />
      </View>
      {tailSide && <BubbleTail side={tailSide} color={stops[stops.length - 1]} animatedColor={tailColor} />}
    </>
  )
}

/** The gradient behind an outgoing bubble: screen-fixed inside a chat list, else per bubble. */
export const GradientBubbleBackground = (props: GradientBackgroundProps) => {
  const store = useContext(BubbleGradientContext)

  if (props.mode === 'screen' && store)
    return <ScreenGradientBackground {...props} store={store} />

  return (
    <>
      <View
        pointerEvents='none'
        style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: props.stops[props.stops.length - 1] }, linearGradientStyle(props.stops), props.cornerStyle]}
      />
      {props.tailSide && <BubbleTail side={props.tailSide} color={props.stops[props.stops.length - 1]} />}
    </>
  )
}

const styles = StyleSheet.create({
  tail: {
    position: 'absolute',
    bottom: 0,
    width: TAIL_BOX_WIDTH,
    height: TAIL_HEIGHT + 1,
    marginBottom: -1,
  },
  tailRight: {
    right: -TAIL_WIDTH,
  },
  tailLeft: {
    left: -TAIL_WIDTH,
  },
  wedgeRight: {
    width: 0,
    height: 0,
    marginBottom: 0,
    right: -TAIL_WIDTH,
    borderTopWidth: TAIL_HEIGHT,
    borderTopColor: 'transparent',
    borderLeftWidth: TAIL_WIDTH,
  },
  wedgeLeft: {
    width: 0,
    height: 0,
    marginBottom: 0,
    left: -TAIL_WIDTH,
    borderTopWidth: TAIL_HEIGHT,
    borderTopColor: 'transparent',
    borderRightWidth: TAIL_WIDTH,
  },
  clip: {
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
})
