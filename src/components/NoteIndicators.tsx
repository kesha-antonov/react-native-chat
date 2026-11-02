import React, { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

/** Cross-scales the unread dot and the playing bars over 150ms. */
export const INDICATOR_MS = 150

/**
 * `entering` for an indicator that appears in place: none on the first render,
 * so a row does not animate as it scrolls into view.
 */
export const useEnteringAfterMount = () => {
  // State, not a ref: the returned value is render output. The one extra render after mount
  // changes only `entering` on a view that is already mounted, which Reanimated ignores.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])
  return isMounted ? ZoomIn.duration(INDICATOR_MS) : undefined
}

export const indicatorExiting = ZoomOut.duration(INDICATOR_MS)

/**
 * The unread dot beside a note's length. It shrinks away when the note
 * is played rather than vanishing.
 */
export function UnreadDot ({ isVisible, color, size = 6 }: { isVisible: boolean, color: string, size?: number }) {
  const entering = useEnteringAfterMount()
  if (!isVisible)
    return null

  return (
    <Animated.View
      entering={entering}
      exiting={indicatorExiting}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  )
}

// The playing indicator: three bars, each bouncing on its own
// period from its own phase, frozen while the note is paused.
const BARS = [
  { phase: 0.47, period: 300 },
  { phase: 0, period: 310 },
  { phase: 0.32, period: 320 },
]
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_MAX = 8
const BAR_TRAVEL = 7

const PlayingBar = ({ phase, period, isAnimating, color }: { phase: number, period: number, isAnimating: boolean, color: string }) => {
  // 0 is a full bar, 1 a stub.
  const value = useSharedValue(phase)

  useEffect(() => {
    if (!isAnimating) {
      cancelAnimation(value)
      return
    }

    // Finish the current leg up, then bounce for as long as it plays.
    // Always animated: with the system's Reduce Motion on, Reanimated would
    // hold the bars still and they would not read as "playing".
    value.value = withSequence(
      withTiming(1, { duration: (1 - value.value) * period, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      withRepeat(
        withTiming(0, { duration: period, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        -1,
        true,
        undefined,
        ReduceMotion.Never
      )
    )
    return () => cancelAnimation(value)
  }, [isAnimating, period, value])

  const style = useAnimatedStyle(() => ({
    height: BAR_MAX - BAR_TRAVEL * value.value,
  }))

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
}

/** The playing bars that replace the unread dot once a round note is heard. */
export function PlayingBars ({ isAnimating, color }: { isAnimating: boolean, color: string }) {
  const entering = useEnteringAfterMount()

  return (
    <Animated.View entering={entering} exiting={indicatorExiting} style={styles.bars}>
      {BARS.map(bar => (
        <PlayingBar key={bar.period} {...bar} isAnimating={isAnimating} color={color} />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bars: {
    width: BARS.length * BAR_WIDTH + (BARS.length - 1) * BAR_GAP,
    height: BAR_MAX,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
  },
})
