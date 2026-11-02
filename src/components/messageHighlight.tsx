import React, { createContext, useContext, useEffect } from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { createKeyedStore, KeyedStore, useKeyedValue } from '../store'

/**
 * Which message is flashing, the highlight after jumping to a quoted message. Each row reads
 * its own token, so a flash wakes the row it lands on and the one it leaves.
 */
export interface MessageHighlightStore {
  subscribe: (listener: () => void) => () => void
  /** The flash count for this message, 0 when it is not flashing. */
  getToken: (messageId: string | number) => number
  highlight: (messageId: string | number) => void
  dispose: () => void
  /** @internal The flash token by message id, read by each row. */
  tokens: KeyedStore<string | number, number>
}

/** Covers the jump to the message plus the flash itself. */
const HIGHLIGHT_LIFETIME_MS = 2000

export function createMessageHighlightStore (): MessageHighlightStore {
  const tokens = createKeyedStore<string | number, number>()
  let counter = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  return {
    subscribe: tokens.subscribe,
    getToken: messageId => tokens.get(messageId) ?? 0,
    highlight: messageId => {
      counter += 1
      tokens.keys().forEach(id => {
        if (id !== messageId)
          tokens.delete(id)
      })
      tokens.set(messageId, counter)
      // Kept a while, so a row that only mounts once the list has scrolled to it still flashes.
      clearTimeout(timer)
      timer = setTimeout(tokens.clear, HIGHLIGHT_LIFETIME_MS)
    },
    dispose: () => {
      clearTimeout(timer)
    },
    tokens,
  }
}

export const MessageHighlightContext = createContext<MessageHighlightStore | null>(null)

/** The flash count for this message (0 when it is not flashing, or outside a `Chat`). */
export function useMessageHighlightToken (messageId: string | number | undefined): number {
  const store = useContext(MessageHighlightContext)
  return useKeyedValue(store?.tokens, messageId) ?? 0
}

// A jumped-to message stays highlighted for 1000ms, then fades out over 300ms.
const HIGHLIGHT_HOLD_MS = 1000
const HIGHLIGHT_FADE_MS = 300
// The selected background is 0x280a90f0: the accent at 0x28 / 0xff.
const HIGHLIGHT_OPACITY = 0x28 / 0xff

/** Shows at once, holds, then fades out - restarted by every new token. */
const useHighlightFade = (token: number, peak: number) => {
  const opacity = useSharedValue(peak)

  useEffect(() => {
    opacity.value = peak
    opacity.value = withDelay(
      HIGHLIGHT_HOLD_MS,
      withTiming(0, { duration: HIGHLIGHT_FADE_MS, easing: Easing.linear })
    )
  }, [token, opacity, peak])

  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}

/**
 * The band across the whole row behind a highlighted message. It shows at once and
 * fades out. Mounted only while its message is flashing, so the rest of the list carries no
 * shared value for it. `Message` passes `colors.selectionBackground`, which carries its own
 * alpha, at `opacity` 1; the default draws a plain accent at 0x28 alpha.
 */
export const HighlightOverlay = ({ token, color, opacity = HIGHLIGHT_OPACITY }: { token: number, color: string, opacity?: number }) => {
  const style = useHighlightFade(token, opacity)

  return (
    <Animated.View
      testID='message-highlight'
      pointerEvents='none'
      style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]}
    />
  )
}

/**
 * The bubble's own part of the flash: it swaps to its selected color for as long as
 * the row band shows.
 */
export const BubbleHighlightTint = ({ token, color, cornerStyle }: { token: number, color: string, cornerStyle: StyleProp<ViewStyle> }) => {
  const style = useHighlightFade(token, 1)

  return (
    <Animated.View
      testID='bubble-highlight'
      pointerEvents='none'
      style={[StyleSheet.absoluteFill, { backgroundColor: color }, cornerStyle, style]}
    />
  )
}
