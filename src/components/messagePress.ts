// Telegram Android's long-press: the list's item long-click fires after the system long-press
// timeout (`RecyclerListView` uses `ViewConfiguration.getLongPressTimeout()`, 400ms), with no
// shrink or lift on the way - the message stays where it is and the menu opens beside the finger.
export const PRESS_HOLD_MS = 400

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
