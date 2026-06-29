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
  size?: number
}

/**
 * A minimal clock-outline icon for the "pending" (sending) state, replacing the
 * old "🕓" emoji. The hands rotate continuously while the message is sending,
 * mirroring Telegram's spinning clock. Respects the system reduce-motion
 * setting (the hands simply hold still).
 */
export const PendingClock = ({ color, size = 11 }: PendingClockProps) => {
  const styles = useMemo(() => createClockStyles(color, size), [color, size])
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1,
      false
    )

    return () => cancelAnimation(rotation)
  }, [rotation])

  const handsStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <View style={styles.face}>
      <Animated.View style={[styles.hands, StyleSheet.absoluteFill, handsStyle]}>
        <View style={styles.minuteHand} />
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
  const hand = Math.max(1, Math.round(size * 0.09))

  return StyleSheet.create({
    face: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderColor: color,
      borderWidth: hand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hands: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    minuteHand: {
      position: 'absolute',
      width: hand,
      height: size * 0.32,
      backgroundColor: color,
      bottom: '50%',
    },
    hourHand: {
      position: 'absolute',
      height: hand,
      width: size * 0.24,
      backgroundColor: color,
      left: '50%',
    },
  })
}
