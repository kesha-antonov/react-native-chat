import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutChangeEvent } from 'react-native'
import { SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated'

import { IMessage } from '../Models'
import { CONTENT_PADDING_BOTTOM, ListState } from './listState'
import { AnimatedListProps } from './types'

const LAYOUT_SETTLE_MS = 500

/**
 * The list's size and scroll position as shared values, and the layout and content-size
 * handlers that keep them current.
 */
export function useListMetrics<TMessage extends IMessage> (listProps: AnimatedListProps<TMessage> | undefined) {
  const [isListLaidOut, setIsListLaidOut] = useState(false)
  // Rows slide when they move, but not while the list first lays itself out: it places rows at
  // an estimated height and moves them once they are measured, and on Android those corrections
  // played as messages sliding in each time a chat opened. A chat should open with everything
  // already in place, as Telegram's does, so the slide starts once the first layout has settled.
  const [isLayoutAnimated, setIsLayoutAnimated] = useState(false)
  useEffect(() => {
    if (!isListLaidOut || isLayoutAnimated)
      return
    const timer = setTimeout(() => setIsLayoutAnimated(true), LAYOUT_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [isListLaidOut, isLayoutAnimated])

  const listHeight = useSharedValue(0)
  const contentHeight = useSharedValue(0)
  // The list's scroll offset, from the top, kept on the UI thread by the list itself.
  const scrollOffset = useSharedValue(0)
  const sharedValues = useMemo(() => ({ scrollOffset }), [scrollOffset])
  // Rows' positions count from the first row; the scroll offset counts from the very top, above
  // the list's header ("Load earlier") and, in a conversation shorter than the list, the space
  // that holds it at the bottom. The rows end where the content does, less the footer and the
  // bottom padding, so the offset in the rows' terms is measured from there. The day header, the
  // inline separators and the gradient bubbles read it.
  const rowsHeight = useSharedValue(0)
  const footerSize = useSharedValue(0)
  const scrolledY = useDerivedValue(() =>
    scrollOffset.value - (contentHeight.value - rowsHeight.value - footerSize.value - CONTENT_PADDING_BOTTOM))

  const onLayoutList = useCallback((event: LayoutChangeEvent) => {
    listHeight.set(event.nativeEvent.layout.height)
    setIsListLaidOut(true)

    const onLayoutProp = listProps?.onLayout as ((event: LayoutChangeEvent) => void) | undefined
    onLayoutProp?.(event)
  }, [listHeight, listProps])

  // Whether the whole conversation still fits the list (see `maintainScrollAtEnd` below).
  const [isContentShort, setIsContentShort] = useState(true)
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.set(height)
    // The space holding a short chat at the bottom makes its content exactly as tall as the list.
    const isShort = height <= listHeight.get() + 1
    setIsContentShort(previous => previous === isShort ? previous : isShort)
  }, [contentHeight, listHeight])
  const onMetricsChange = useCallback((metrics: { footerSize: number }) => {
    footerSize.set(metrics.footerSize)
  }, [footerSize])

  // New messages keep the list at the newest one while it is there (or near), and the newest
  // message comes up from below with the scroll, as the rows above it make room. While the
  // whole conversation still fits, the follow is immediate: an animated one holds back the space
  // that keeps a short chat at the bottom until it ends, and a reply streaming in restarts it
  // every few frames, so the reply grew off screen until it was done.
  const maintainScrollAtEnd = useMemo(() => ({ animated: !isContentShort }), [isContentShort])

  return {
    isListLaidOut,
    isLayoutAnimated,
    listHeight,
    contentHeight,
    scrollOffset,
    sharedValues,
    rowsHeight,
    scrolledY,
    onLayoutList,
    onContentSizeChange,
    onMetricsChange,
    maintainScrollAtEnd,
  }
}

/** Keeps `rowsHeight` at the rows' total height, which `scrolledY` measures from. */
export function useRowsHeight (
  isListLaidOut: boolean,
  listState: () => ListState | undefined,
  rowsHeight: SharedValue<number>,
  orderedData: IMessage[]
) {
  useEffect(() => {
    const state = isListLaidOut ? listState() : undefined
    if (!state)
      return
    // The listener only hears changes. On iOS the rows' height has usually settled before this
    // subscribes, so it never fired and the height stayed 0 - putting every gradient bubble a
    // content height off, all of them the gradient's last colour. Start from the last row's end.
    const lastMessage = orderedData[orderedData.length - 1]
    if (lastMessage) {
      const lastId = String(lastMessage._id)
      const position = state.positionByKey(lastId)
      if (position != null)
        rowsHeight.set(position + (state.sizes.get(lastId) ?? 0))
    }
    return state.listen('totalSize', size => {
      rowsHeight.set(size)
    })
  }, [isListLaidOut, listState, rowsHeight, orderedData])
}
