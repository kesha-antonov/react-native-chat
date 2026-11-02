import { useCallback, useRef } from 'react'
import { useSharedValue } from 'react-native-reanimated'

import { useScrollGatedOpacity } from './components/DayAnimated/useScrollGatedOpacity'

/**
 * Whether a finger or a fling is moving the list, from the list's drag and momentum events,
 * and the floating day header's fade that follows it.
 */
export function useScrollActivity () {
  // true while the user is actively scrolling (finger down dragging or momentum
  // running). Drives the floating day header visibility so it stays opaque for the
  // whole gesture and only fades once scrolling fully stops.
  const isScrollActive = useSharedValue(false)
  // The floating day header's fade, shared with the inline separators it stands in for.
  const floatingDayOpacity = useScrollGatedOpacity(isScrollActive)

  // The floating day header shows while a finger or momentum moves the list.
  const onScrollBeginDrag = useCallback(() => {
    isScrollActive.set(true)
  }, [isScrollActive])
  // Momentum (if any) re-asserts it within the header's fade-out delay, so a flick keeps the
  // header up.
  const dragEndedAtRef = useRef(0)
  const onScrollEndDrag = useCallback(() => {
    dragEndedAtRef.current = Date.now()
    isScrollActive.set(false)
  }, [isScrollActive])
  const onMomentumScrollEnd = useCallback(() => {
    isScrollActive.set(false)
  }, [isScrollActive])

  // Only a fling's momentum counts: the list's own scrolls (opening at the newest message,
  // following a new one) start momentum on Android without ever ending it, which left the
  // header up for good.
  const onMomentumScrollBegin = useCallback(() => {
    if (Date.now() - dragEndedAtRef.current < 300)
      isScrollActive.set(true)
  }, [isScrollActive])

  return {
    isScrollActive,
    floatingDayOpacity,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  }
}
