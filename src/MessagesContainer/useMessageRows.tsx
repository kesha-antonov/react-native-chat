import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { SharedValue } from 'react-native-reanimated'

import { IMessage } from '../Models'
import { createStore } from '../store'
import { MessageRow } from './components/Item'
import { RowTargets, useStableRowConfig } from './rowConfig'
import { MessageRowStore, sameOrder } from './rowStore'
import { DaysPositions, MessagesContainerProps } from './types'

/** The list's shared values every row reads through the row config. */
interface RowSharedValues {
  scrolledY: SharedValue<number>
  daysPositions: SharedValue<DaysPositions>
  listHeight: SharedValue<number>
  floatingRenderedDate: SharedValue<number | undefined>
  floatingDayOpacity: SharedValue<number>
}

/**
 * What the rows read: the row store, the shared row config and the per-row targets, plus the
 * list's data in display order and where it opens.
 */
export function useMessageRows<TMessage extends IMessage> (
  props: MessagesContainerProps<TMessage>,
  sharedValues: RowSharedValues
) {
  const {
    messages = [],
    isInverted = true,
    isDayAnimationEnabled = true,
    firstUnreadMessageId,
  } = props
  const { scrolledY, daysPositions, listHeight, floatingRenderedDate, floatingDayOpacity } = sharedValues

  // The messages by id, for the rows to subscribe to (see rowStore). Synced while rendering so
  // rows mounting now read the new messages; rows already on screen hear about it on commit.
  const [rowStore] = useState(() => new MessageRowStore<TMessage>())
  rowStore.sync(messages, isInverted)
  useLayoutEffect(() => {
    rowStore.flush()
  })

  // The list's data keeps its identity while the ids and their order do: a status change,
  // a reaction or a streamed token then leaves the list and its cells alone.
  // Kept in state, not a ref: a render that changes the order stores the new array (React
  // re-runs that render once, before any child renders).
  const [previousListData, setPreviousListData] = useState(messages)
  const listData = sameOrder(previousListData, messages)
  if (listData !== previousListData)
    setPreviousListData(listData)
  // The list renders oldest first; `messages` comes newest first unless `isInverted` is off.
  const orderedData = useMemo(() => isInverted ? [...listData].reverse() : listData, [listData, isInverted])

  // A chat with unread messages opens on its "Unread Messages" bar, at the top of the screen,
  // and one without them at the newest message. Decided once, when the list first renders.
  const [initialScroll] = useState(() => {
    const index = firstUnreadMessageId != null
      ? orderedData.findIndex(message => message._id === firstUnreadMessageId)
      : -1
    // The newest message already is the first unread one: the list starts there anyway.
    return index >= 0 && index < orderedData.length - 1
      ? { initialScrollIndex: { index, viewPosition: 0 } }
      : { initialScrollAtEnd: true }
  })

  // What every row shares, kept stable across renders that change nothing a row can see.
  const {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    messages: _messages,
    forwardRef: _forwardRef,
    listProps: _listProps,
    // The list's own chrome; no row draws any of it.
    isTyping: _isTyping,
    renderChatEmpty: _renderChatEmpty,
    renderFooter: _renderFooter,
    renderLoadEarlier: _renderLoadEarlier,
    loadEarlierMessagesProps: _loadEarlierMessagesProps,
    renderTypingIndicator: _renderTypingIndicator,
    typingIndicatorStyle: _typingIndicatorStyle,
    scrollToBottomComponent: _scrollToBottomComponent,
    scrollToBottomStyle: _scrollToBottomStyle,
    scrollToBottomContentStyle: _scrollToBottomContentStyle,
    scrollToBottomOffset: _scrollToBottomOffset,
    isScrollToBottomEnabled: _isScrollToBottomEnabled,
    isScrollToBottomBadgeEnabled: _isScrollToBottomBadgeEnabled,
    isAlignedTop: _isAlignedTop,
    // Concerns two rows at most: read through `useRowSettings` (rowTargets below).
    firstUnreadMessageId: _firstUnreadMessageId,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...sharedRowProps
  } = props
  const stableRowProps = useStableRowConfig({
    ...sharedRowProps,
    isInverted,
    isDayAnimationEnabled,
  })
  // The list's shared values join outside the comparison: they keep their identity anyway, and
  // the comparison must only see what the props hand it (see useStableRowConfig).
  const rowConfig = useMemo(() => ({
    ...stableRowProps,
    scrolledY,
    daysPositions,
    listHeight,
    floatingRenderedDate,
    floatingDayOpacity,
  }), [stableRowProps, scrolledY, daysPositions, listHeight, floatingRenderedDate, floatingDayOpacity])

  const [rowTargets] = useState(() => createStore<RowTargets>({ firstUnreadMessageId }))
  // Before paint, so the bar never shows on both rows or neither.
  useLayoutEffect(() => {
    rowTargets.set(prev => prev.firstUnreadMessageId === firstUnreadMessageId ? prev : { ...prev, firstUnreadMessageId })
  }, [rowTargets, firstUnreadMessageId])

  const renderItem = useCallback(({ item }: { item: unknown }): React.ReactElement =>
    <MessageRow id={String((item as TMessage)._id)} />
  , [])

  const keyExtractor = useCallback((item: unknown) => (item as TMessage)._id.toString(), [])

  return { rowStore, orderedData, initialScroll, rowConfig, rowTargets, renderItem, keyExtractor }
}
