import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

/**
 * Which message is flashing, Telegram's highlight after jumping to a quoted message. Rows read
 * it through `useSyncExternalStore`, so a flash re-renders only the row it lands on.
 */
export interface MessageHighlightStore {
  subscribe: (listener: () => void) => () => void
  /** The flash count for this message, 0 when it is not flashing. */
  getToken: (messageId: string | number) => number
  highlight: (messageId: string | number) => void
  dispose: () => void
}

/** Covers the jump to the message plus the flash itself. */
const HIGHLIGHT_LIFETIME_MS = 2000

export function createMessageHighlightStore (): MessageHighlightStore {
  let current: { id: string | number, token: number } | null = null
  let counter = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())

  return {
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getToken: messageId => (current && current.id === messageId ? current.token : 0),
    highlight: messageId => {
      counter += 1
      current = { id: messageId, token: counter }
      emit()
      // Kept a while, so a row that only mounts once the list has scrolled to it still flashes.
      clearTimeout(timer)
      timer = setTimeout(() => {
        current = null
        emit()
      }, HIGHLIGHT_LIFETIME_MS)
    },
    dispose: () => {
      clearTimeout(timer)
      listeners.clear()
    },
  }
}

export const MessageHighlightContext = createContext<MessageHighlightStore | null>(null)

const noopSubscribe = () => () => {}
const zero = () => 0

/** The flash count for this message (0 when it is not flashing, or outside a `Chat`). */
export function useMessageHighlightToken (messageId: string | number | undefined): number {
  const store = useContext(MessageHighlightContext)
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store && messageId != null ? () => store.getToken(messageId) : zero,
    zero
  )
}

// Telegram Android keeps a jumped-to message highlighted for 1000ms (`ChatActivity.startMessageUnselect`),
// then fades it out over 300ms (`ChatMessageCell.setHighlighted` / `getHighlightAlpha`).
const HIGHLIGHT_HOLD_MS = 1000
const HIGHLIGHT_FADE_MS = 300
// `key_chat_selectedBackground` is 0x280a90f0: the accent at 0x28 / 0xff.
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
 * Telegram's band across the whole row behind a highlighted message (`ChatActivity`'s
 * `ChatListView` draws `key_chat_selectedBackground` under the cell). It shows at once and
 * fades out. Mounted only while its message is flashing, so the rest of the list carries no
 * shared value for it. `Message` passes `colors.selectionBackground`, which carries its own
 * alpha, at `opacity` 1; the default draws a plain accent at Telegram's 0x28.
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
 * The bubble's own part of the flash: Telegram swaps it to its selected color
 * (`chat_inBubbleSelected` / `chat_outBubbleSelected`, `ChatMessageCell:20790`) for as long as
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
