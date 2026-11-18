import { RefObject, useCallback } from 'react'
import { LayoutChangeEvent } from 'react-native'
import { SharedValue } from 'react-native-reanimated'

import { ListState } from './listState'
import { AnimatedList } from './types'

interface Options {
  forwardRef: RefObject<AnimatedList | null> | undefined
  /** Raised before each scroll this makes, so the scroll-to-bottom button does not count it. */
  isScrollAdjusting: SharedValue<boolean>
  listHeight: SharedValue<number>
  onLayoutList: (event: LayoutChangeEvent) => void
}

/**
 * Keeps the rows at the list's bottom edge in place when the list's height changes - a reply bar
 * opening over the composer, the composer growing a line, the emoji panel - as an inverted list
 * did: the list scrolls from the top, and a list that got shorter kept its top rows and hid the
 * ones above the composer. Returns the list's `onLayout`, wrapping the metrics' own.
 *
 * The keyboard does not come through here: it lifts the list's content natively and leaves the
 * list's height alone (see `keyboardLift`).
 */
export function useKeepBottomEdge ({ forwardRef, isScrollAdjusting, listHeight, onLayoutList }: Options) {
  const keepBottomEdge = useCallback((shrunkBy: number) => {
    const list = forwardRef?.current
    const state = list?.getState() as unknown as ListState | undefined
    if (!list || !state || Math.abs(shrunkBy) < 0.5)
      return
    // The state already has the new length. A list that grew at the end has had its offset pulled
    // back to the new end by Android itself, so taking the growth off again left it short.
    const maxOffset = Math.max(0, state.contentLength - state.scrollLength)
    if (shrunkBy < 0 && Math.abs(state.scroll - maxOffset) < 1)
      return
    isScrollAdjusting.set(true)
    list.scrollToOffset({ offset: Math.min(maxOffset, Math.max(0, state.scroll + shrunkBy)), animated: false })
  }, [forwardRef, isScrollAdjusting])

  return useCallback((event: LayoutChangeEvent) => {
    const previousHeight = listHeight.get()
    onLayoutList(event)
    const height = event.nativeEvent.layout.height
    if (previousHeight > 0 && height !== previousHeight)
      keepBottomEdge(previousHeight - height)
  }, [listHeight, onLayoutList, keepBottomEdge])
}
