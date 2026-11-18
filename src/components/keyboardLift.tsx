import React, { createContext, useContext } from 'react'
import { StyleSheet } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { SharedValue, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated'

/**
 * How the keyboard lifts the chat (#36). Nothing is laid out again as the keyboard moves: the
 * composer, and whatever sits on the list's bottom edge, ride up on a transform, and the list
 * lifts its own content natively (`KeyboardAwareLegendList`), so the rows above the composer stay
 * there in every frame.
 *
 * `offset` is how much of the keyboard's height does not reach the chat: the space between the
 * chat's bottom edge and the screen's, plus the home indicator's inset, which the composer keeps
 * as padding and lets the keyboard cover. The keyboard lifts the chat by `max(0, keyboard - offset)`.
 *
 * An in-app panel in the keyboard's place (the emoji keyboard) asks for its own lift in `panel`,
 * and the chat rides on the larger of the two, so trading the keyboard for the panel moves
 * nothing. The list lifts its content by the keyboard natively. While something takes the
 * keyboard's place it `hold`s the list's keyboard padding where it is (`freeze`), and the list
 * follows the lift through `extra` instead; the hold ends when `panel` drops back to 0.
 */
export interface KeyboardLift {
  offset: number
  /** How far the composer and the list's bottom edge are lifted. */
  lift: SharedValue<number>
  /** The lift an in-app panel asks for; written by the panel. */
  panel: SharedValue<number>
  /** The keyboard's own lift, `max(0, keyboard - offset)`. */
  keyboardLift: SharedValue<number>
  /** The keyboard lift the list's padding is held at, or -1. */
  held: SharedValue<number>
  /** Added to the list's padding: the rest of the lift. */
  extra: SharedValue<number>
  /** Holds the list's keyboard padding and scroll while `held`. */
  freeze: SharedValue<boolean>
}

export const KeyboardLiftContext = createContext<KeyboardLift | null>(null)

export function useKeyboardLiftContext () {
  return useContext(KeyboardLiftContext)
}

/** The lift for a chat whose keyboard-free space below it is `offset`. */
export function useKeyboardLift (offset: number): KeyboardLift {
  const keyboard = useReanimatedKeyboardAnimation()
  const noKeyboard = useSharedValue(0)
  // Guarded for mocks that return nothing.
  const keyboardHeight = keyboard?.height ?? noKeyboard
  const panel = useSharedValue(0)
  const held = useSharedValue(-1)
  const keyboardLift = useDerivedValue(() => Math.max(0, -keyboardHeight.value - offset))
  const lift = useDerivedValue(() => Math.max(keyboardLift.value, panel.value))
  const extra = useDerivedValue(() => lift.value - (held.value >= 0 ? held.value : keyboardLift.value))
  const freeze = useDerivedValue(() => held.value >= 0)
  // Whatever held the padding is gone: the keyboard is back in its place, or nothing is lifted.
  useAnimatedReaction(
    () => panel.value,
    (current, previous) => {
      if (current === 0 && previous != null && previous > 0 && held.get() >= 0)
        held.set(-1)
    }
  )
  return { offset, lift, panel, keyboardLift, held, extra, freeze }
}

/**
 * Takes the keyboard's place as it leaves: the list's padding stays where the keyboard put it and
 * `panel` carries the lift from there. Call before `panel` rises above 0.
 */
export function holdKeyboardLift (keyboardLift: KeyboardLift) {
  keyboardLift.held.set(keyboardLift.keyboardLift.get())
}

/** A transform that moves a view up with the keyboard; none outside a chat. */
export function useKeyboardLiftStyle () {
  const context = useKeyboardLiftContext()
  const none = useSharedValue(0)
  const lift = context?.lift ?? none
  return useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }))
}

/** Lays its children over the parent, moved up with the keyboard; touches pass through. */
export function KeyboardLiftedOverlay ({ children }: { children: React.ReactNode }) {
  const style = useKeyboardLiftStyle()
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents='box-none'>
      {children}
    </Animated.View>
  )
}

/** Moves its children up with the keyboard, in place in the layout. */
export function KeyboardLifted ({ children, style }: { children: React.ReactNode, style?: React.ComponentProps<typeof Animated.View>['style'] }) {
  const liftStyle = useKeyboardLiftStyle()
  return (
    <Animated.View style={[style, liftStyle]} collapsable={false}>
      {children}
    </Animated.View>
  )
}

/**
 * Cuts its children off at the composer's top edge as the keyboard lifts it, with no layout: the
 * clip moves up with the keyboard and its content moves back down by as much, so the rows stay
 * put and only what would show under and around the lifted composer is hidden - the list still
 * reaches down to where the composer sits with the keyboard closed.
 */
export function KeyboardLiftClip ({ children }: { children: React.ReactNode }) {
  const context = useKeyboardLiftContext()
  const none = useSharedValue(0)
  const lift = context?.lift ?? none
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }))
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }))
  if (!context)
    return children
  return (
    <Animated.View style={[styles.clip, clipStyle]} collapsable={false}>
      <Animated.View style={[styles.fill, contentStyle]} collapsable={false}>
        {children}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
})
