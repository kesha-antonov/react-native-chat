import { RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useScrollToMessage } from '../components/mediaPlayback'
import { NOTE_GROW_MS, noteGrowEasing } from '../components/roundNoteChrome'
import { NOTE_CENTRE_DELAY_MS } from './constants'

// A round note that starts playing scrolls to the middle of the
// list, once it has grown, so the whole circle is in view.
export const useCentreWhenGrown = (
  isGrown: boolean,
  messageId: string | number | undefined,
  skipCentreRef: RefObject<boolean>
) => {
  const scrollToMessage = useScrollToMessage()
  const scrollToMessageRef = useRef(scrollToMessage)
  useLayoutEffect(() => {
    scrollToMessageRef.current = scrollToMessage
  })
  useEffect(() => {
    if (!isGrown)
      return

    if (skipCentreRef.current) {
      skipCentreRef.current = false
      return
    }

    const timer = setTimeout(() => scrollToMessageRef.current(messageId), NOTE_CENTRE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isGrown, messageId, skipCentreRef])
}

// Grow while current, shrink back after.
export const useNoteGrowAnimation = (
  isGrown: boolean,
  noteSize: number,
  playingNoteSize: number,
  growShift: number
) => {
  const size = isGrown ? playingNoteSize : noteSize
  const sizeSV = useSharedValue(noteSize)
  useEffect(() => {
    sizeSV.set(withTiming(size, { duration: NOTE_GROW_MS, easing: noteGrowEasing }))
  }, [size, sizeSV])
  const sizeStyle = useAnimatedStyle(() => ({
    width: sizeSV.get(),
    height: sizeSV.get(),
    borderRadius: sizeSV.get() / 2,
  }))
  const shiftSV = useSharedValue(0)
  useEffect(() => {
    shiftSV.set(withTiming(growShift, { duration: NOTE_GROW_MS, easing: noteGrowEasing }))
  }, [growShift, shiftSV])
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftSV.get() }],
  }))

  return { sizeSV, sizeStyle, shiftStyle }
}
