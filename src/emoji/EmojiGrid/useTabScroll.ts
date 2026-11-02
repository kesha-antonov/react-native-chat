import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, ListViewToken } from 'react-native'

import { Item } from './types'

/**
 * Keeps the tab strip and the list in step: the visible rows move the indicator, and a tab
 * touched or slid onto scrolls the list to its section.
 */
export const useTabScroll = (firstItemOfTab: number[], offsets: number[]) => {
  const listRef = useRef<FlatList<Item>>(null)
  const activeTabRef = useRef<(index: number) => void>(() => {})
  // While a tab tap scrolls the list, the scroll must not drag the indicator back.
  const isJumpingRef = useRef(false)

  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 50 }))
  // FlatList does not allow this to change between renders.
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    if (isJumpingRef.current)
      return
    const first = viewableItems.map(token => token.item as Item).find(item => item.type !== 'search')
    if (first)
      activeTabRef.current(first.tab)
  })

  const jumpEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollToTab = useCallback((tab: number, isScrub = false) => {
    const index = firstItemOfTab[tab]
    if (index === undefined)
      return
    isJumpingRef.current = true
    if (jumpEndTimerRef.current)
      clearTimeout(jumpEndTimerRef.current)
    // A tap smooth-scrolls to the tab; while the finger slides along the strip each category is
    // jumped to at once, to keep up with it. The rows are fixed height, so the offset is exact.
    listRef.current?.scrollToOffset({ offset: offsets[index] ?? 0, animated: !isScrub })
    if (!isScrub)
      jumpEndTimerRef.current = setTimeout(() => {
        isJumpingRef.current = false
      }, 400)
  }, [firstItemOfTab, offsets])
  // The visible rows take the indicator back once the slide along the strip has ended.
  const endScrub = useCallback(() => {
    if (jumpEndTimerRef.current)
      clearTimeout(jumpEndTimerRef.current)
    jumpEndTimerRef.current = setTimeout(() => {
      isJumpingRef.current = false
    }, 400)
  }, [])
  useEffect(() => () => {
    if (jumpEndTimerRef.current)
      clearTimeout(jumpEndTimerRef.current)
  }, [])

  return { listRef, activeTabRef, viewabilityConfig, onViewableItemsChanged, scrollToTab, endScrub }
}
