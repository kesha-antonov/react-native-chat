// Telegram's press (Telegram-iOS, submodules/Display/Source/ContextGesture.swift
// and ContextControllerSourceNode.swift): nothing for the first 0.12s, then the
// content shrinks linearly over 0.2s - by 15pt of its width, never below 0.7 -
// and the menu opens as the shrink completes, 0.32s in. Let go earlier and it
// eases back over 0.2s.
export const PRESS_DELAY_MS = 120
export const PRESS_SHRINK_MS = 200
export const PRESS_RELEASE_MS = 200
export const PRESS_HOLD_MS = PRESS_DELAY_MS + PRESS_SHRINK_MS

const noop = () => {}

/**
 * Spread onto a tappable inside a bubble (photo, location card, play button...).
 * Holding it as long as the message long-press takes counts as a long-press, so
 * letting go no longer fires its `onPress`: a long-press opens the menu, as in
 * Telegram, and never also opens the photo viewer or starts playback on release.
 * `Pressable` and gesture-handler's `BaseButton` both skip `onPress` once their
 * own `onLongPress` has fired.
 */
export const suppressPressAfterHold = {
  onLongPress: noop,
  delayLongPress: PRESS_HOLD_MS,
} as const
