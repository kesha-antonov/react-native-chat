import React, { useEffect, useRef, useState } from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

// Telegram's `CounterView` timings: in 220ms with an overshoot, out 150ms, a change 430ms.
const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const x = t - 1
  return x * x * ((tension + 1) * x + tension) + 1
}
const IN = { duration: 220, easing: overshoot(2) }
const DEFAULT_EASING = Easing.bezierFn(0.25, 0.1, 0.25, 1)
const OUT = { duration: 150, easing: DEFAULT_EASING }
const CHANGE = { duration: 430, easing: DEFAULT_EASING }
const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1)
const EASE_IN = Easing.bezierFn(0.42, 0, 1, 1)
// How far a digit travels as it rolls in or out.
const ROLL = 13

const format = (count: number) => count > 99 ? '99+' : String(count)

interface Shown {
  current: number
  previous: number
  isIncrement: boolean
}

export interface PageDownCounterProps {
  count: number
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

/**
 * The unread counter on the scroll-to-bottom button (Telegram's `CounterView`, reversed): it
 * pops in and shrinks away, and a new number rolls in over the old one, downwards as it counts
 * up, with a small bump.
 */
export function PageDownCounter ({ count, style, textStyle }: PageDownCounterProps) {
  const [shown, setShown] = useState<Shown>({ current: count, previous: count, isIncrement: true })
  const appear = useSharedValue(count > 0 ? 1 : 0)
  const change = useSharedValue(1)
  const previousCountRef = useRef(count)

  useEffect(() => {
    const previous = previousCountRef.current
    previousCountRef.current = count
    if (previous === count)
      return

    if (count === 0) {
      appear.value = withTiming(0, OUT, isFinished => {
        if (isFinished)
          runOnJS(setShown)({ current: 0, previous: 0, isIncrement: false })
      })
      return
    }

    if (previous === 0) {
      setShown({ current: count, previous: count, isIncrement: true })
      appear.value = 0
      appear.value = withTiming(1, IN)
      return
    }

    setShown({ current: count, previous, isIncrement: count > previous })
    change.value = 0
    change.value = withTiming(1, CHANGE)
  }, [count, appear, change])

  const isIncrement = shown.isIncrement
  const pillStyle = useAnimatedStyle(() => {
    const p = change.value
    const bump = !isIncrement || p >= 1
      ? 0
      : 0.1 * (p <= 0.5 ? EASE_OUT(p * 2) : EASE_IN(1 - (p - 0.5) * 2))
    return { transform: [{ scale: appear.value * (1 + bump) }] }
  })

  // Reversed, as on the pagedown button: counting up rolls the digits down.
  const direction = isIncrement ? -1 : 1
  const newStyle = useAnimatedStyle(() => {
    const half = Math.min(1, change.value * 2)
    return { opacity: half, transform: [{ translateY: direction * ROLL * (1 - half) }] }
  })
  const oldStyle = useAnimatedStyle(() => {
    const half = Math.min(1, change.value * 2)
    return { opacity: 1 - half, transform: [{ translateY: -direction * ROLL * half }] }
  })

  if (shown.current === 0 && count === 0)
    return null

  const isChanging = shown.previous !== shown.current
  return (
    <Animated.View style={[style, styles.clip, pillStyle]} testID='GC_SCROLL_TO_BOTTOM_COUNTER'>
      <Animated.View style={newStyle}>
        <Text style={textStyle} numberOfLines={1}>{format(shown.current)}</Text>
      </Animated.View>
      {isChanging && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, oldStyle]} pointerEvents='none'>
          <Text style={textStyle} numberOfLines={1}>{format(shown.previous)}</Text>
        </Animated.View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
