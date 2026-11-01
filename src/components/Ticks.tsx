import React, { useEffect, useMemo } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface CheckProps {
  color: string
  size: number
  style?: StyleProp<ViewStyle>
}

/**
 * A single checkmark drawn with two borders rotated 45deg - no SVG dependency.
 * Replaces the old literal "✓" glyph so the tick is crisp at any size and color.
 */
const Check = ({ color, size, style }: CheckProps) => {
  const styles = useMemo(() => createCheckStyles(color, size), [color, size])
  return <View style={[styles.check, style]} />
}

export interface TicksProps {
  /** Render a double check (delivered / read) instead of a single check (sent). */
  double?: boolean
  color: string
  /** Visual height of a single check; defaults to 9. */
  size?: number
}

/**
 * Telegram-style delivery ticks: one check = sent, double check = delivered/read.
 * Color the read state with the accent (or a brighter shade on colored bubbles).
 */
export const Ticks = ({ double = false, color, size = 9 }: TicksProps) => {
  const styles = useMemo(() => createTicksStyles(size), [size])

  return (
    <View style={styles.row}>
      <Check color={color} size={size} />
      {double && <Check color={color} size={size} style={styles.secondCheck} />}
    </View>
  )
}

export interface PendingClockProps {
  color: string
  /** Face diameter; Telegram's is 12 (`MsgClockDrawable.getIntrinsicWidth`). */
  size?: number
}

/*
 * Telegram's sending clock, `ui/Components/MsgClockDrawable.java`: a 1-wide ring of radius
 * `size / 2 - 0.5` with two round-capped hands from the centre. The minute hand (3 long,
 * pointing up) turns once every 1.5s, the hour hand (2.3 long, pointing right) once every
 * 4.5s (`rotateTime`, `rotateHourTime`, `:40-50`).
 */
export const CLOCK_MINUTE_MS = 1500
export const CLOCK_HOUR_MS = CLOCK_MINUTE_MS * 3
const STROKE = 1

const useTurn = (duration: number) => {
  const rotation = useSharedValue(0)
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1,
      false
    )
    return () => cancelAnimation(rotation)
  }, [rotation, duration])
  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))
}

/**
 * Telegram's animated sending clock. Respects the system reduce-motion setting (the hands
 * then hold still).
 */
export const PendingClock = ({ color, size = 12 }: PendingClockProps) => {
  const styles = useMemo(() => createClockStyles(color, size), [color, size])
  const minuteStyle = useTurn(CLOCK_MINUTE_MS)
  const hourStyle = useTurn(CLOCK_HOUR_MS)

  return (
    <View testID='pending-clock' style={styles.box}>
      <View style={styles.face} />
      <Animated.View style={[StyleSheet.absoluteFill, minuteStyle]}>
        <View style={styles.minuteHand} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, hourStyle]}>
        <View style={styles.hourHand} />
      </Animated.View>
    </View>
  )
}

const createCheckStyles = (color: string, size: number) => {
  const thickness = Math.max(1.5, Math.round(size * 0.16))

  return StyleSheet.create({
    check: {
      width: size * 0.55,
      height: size,
      borderColor: color,
      borderRightWidth: thickness,
      borderBottomWidth: thickness,
      transform: [{ rotate: '45deg' }],
    },
  })
}

const createTicksStyles = (size: number) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: size + 2,
  },
  secondCheck: {
    marginLeft: -size * 0.35,
  },
})

const createClockStyles = (color: string, size: number) => {
  const centre = size / 2
  // The ring is stroked on radius `size / 2 - 0.5`, so it fills the box exactly.
  const minute = 3
  const hour = 2.3
  return StyleSheet.create({
    box: {
      width: size,
      height: size,
    },
    face: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: size,
      height: size,
      borderRadius: centre,
      borderColor: color,
      borderWidth: STROKE,
    },
    // Each hand runs from the centre, its round caps reaching half the stroke past both ends.
    minuteHand: {
      position: 'absolute',
      left: centre - STROKE / 2,
      top: centre - minute - STROKE / 2,
      width: STROKE,
      height: minute + STROKE,
      borderRadius: STROKE / 2,
      backgroundColor: color,
    },
    hourHand: {
      position: 'absolute',
      left: centre - STROKE / 2,
      top: centre - STROKE / 2,
      width: hour + STROKE,
      height: STROKE,
      borderRadius: STROKE / 2,
      backgroundColor: color,
    },
  })
}
