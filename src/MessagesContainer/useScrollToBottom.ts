import { RefObject, useCallback, useEffect, useState } from 'react'
import { Easing, runOnJS, SharedValue, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated'

import { NEWEST_SLOP } from './listState'
import { PageDownReturn } from './pageDownReturn'
import { AnimatedList } from './types'

// The pagedown button comes up from 80 below at 0.7 scale and fades in, over 280ms on a
// decelerate curve.
const SCROLL_BUTTON_SHOW = { duration: 280, easing: Easing.out(Easing.quad) }

interface ScrollToBottomOptions {
  forwardRef: RefObject<AnimatedList | null> | undefined
  scrollOffset: SharedValue<number>
  contentHeight: SharedValue<number>
  listHeight: SharedValue<number>
  scrollToBottomOffset: number
  pageDownReturn: PageDownReturn | null
}

/**
 * When the scroll-to-bottom button shows, from the list's scroll offset on the UI thread, and
 * what pressing it does.
 */
export function useScrollToBottom ({
  forwardRef,
  scrollOffset,
  contentHeight,
  listHeight,
  scrollToBottomOffset,
  pageDownReturn,
}: ScrollToBottomOptions) {
  const scrollToBottomOpacity = useSharedValue(0)
  const isScrollingDown = useSharedValue(false)
  // Scroll-to-bottom button logic: scroll travelled
  // since the last change, whether the button came up from scrolling, and how far the viewport
  // is from the newest message.
  const scrollTravel = useSharedValue(0)
  const isShownByScroll = useSharedValue(false)
  const distanceFromNewestSV = useSharedValue(0)
  const lastScrolledY = useSharedValue(0)
  const [isScrollToBottomVisible, setIsScrollToBottomVisible] = useState(false)

  // Whether the scroll-to-bottom button should be showing. Written from the scroll
  // worklet (UI thread) and from `doScrollToBottom` (JS); the reaction below is the
  // single place that reacts to it changing, so the JS thread is only involved on a
  // genuine transition rather than on every scroll frame.
  const isScrollToBottomShown = useSharedValue(false)

  useAnimatedReaction(
    () => isScrollToBottomShown.value,
    (isVisible, previous) => {
      if (isVisible === previous)
        return

      // Mount the button before fading it in; unmount only once it has faded out.
      if (isVisible)
        runOnJS(setIsScrollToBottomVisible)(true)

      scrollToBottomOpacity.set(withTiming(isVisible ? 1 : 0, SCROLL_BUTTON_SHOW, isFinished => {
        if (isFinished && !isVisible)
          runOnJS(setIsScrollToBottomVisible)(false)
      }))
    })

  const returnToMessageId = pageDownReturn?.messageId ?? null
  // A jump to a quoted message brings the button up, whatever the scroll did.
  useEffect(() => {
    if (returnToMessageId == null)
      return

    isShownByScroll.set(false)
    isScrollToBottomShown.set(true)
  }, [returnToMessageId, isShownByScroll, isScrollToBottomShown])

  const doScrollToBottom = useCallback((animated: boolean = true) => {
    isScrollingDown.set(true)
    isScrollToBottomShown.set(false)
    isShownByScroll.set(false)
    scrollTravel.set(0)

    forwardRef?.current?.scrollToEnd({ animated })
  }, [forwardRef, isScrollingDown, isScrollToBottomShown, isShownByScroll, scrollTravel])

  const goBackFromQuote = pageDownReturn?.goBack
  const handleScrollToBottomPress = useCallback(() => {
    if (returnToMessageId != null && goBackFromQuote) {
      goBackFromQuote()
      return
    }

    doScrollToBottom()
  }, [doScrollToBottom, returnToMessageId, goBackFromQuote])

  // Scroll state, on the UI thread from the list's scroll offset: how far the viewport is from
  // the newest message decides the scroll-to-bottom button.
  useAnimatedReaction(
    () => scrollOffset.get(),
    y => {
      isScrollingDown.set(lastScrolledY.get() < y)
      lastScrolledY.set(y)

      const distanceFromNewest = Math.max(0, contentHeight.get() - listHeight.get() - y)
      const delta = distanceFromNewest - distanceFromNewestSV.get()
      distanceFromNewestSV.set(distanceFromNewest)

      // The button hides once the newest message is reached; it comes up after scrolling
      // back towards the newest by `scrollToBottomOffset`, and goes again after scrolling
      // away by as much if scrolling is what brought it up.
      if (distanceFromNewest <= NEWEST_SLOP) {
        if (delta <= 0) {
          isScrollToBottomShown.set(false)
          isShownByScroll.set(false)
          scrollTravel.set(0)
        }
      } else if (delta < 0) {
        if (!isScrollToBottomShown.get()) {
          scrollTravel.set(scrollTravel.get() - delta)
          if (scrollTravel.get() > scrollToBottomOffset!) {
            scrollTravel.set(0)
            isScrollToBottomShown.set(true)
            isShownByScroll.set(true)
          }
        }
      } else if (delta > 0 && isShownByScroll.get() && isScrollToBottomShown.get()) {
        scrollTravel.set(scrollTravel.get() - delta)
        if (scrollTravel.get() < -scrollToBottomOffset!) {
          scrollTravel.set(0)
          isScrollToBottomShown.set(false)
          isShownByScroll.set(false)
        }
      }
    })

  return {
    scrollToBottomOpacity,
    isScrollToBottomVisible,
    isScrollToBottomShown,
    isShownByScroll,
    distanceFromNewestSV,
    handleScrollToBottomPress,
  }
}
