import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SharedValue } from 'react-native-reanimated'

import { IMessage } from '../Models'
import { ListState, NEWEST_SLOP } from './listState'
import { PageDownReturn } from './pageDownReturn'

interface PageDownUnreadOptions<TMessage extends IMessage> {
  messages: TMessage[]
  isInverted: boolean
  userId: string | number | undefined
  isScrollToBottomEnabled: boolean
  isScrollToBottomBadgeEnabled: boolean
  isScrollToBottomVisible: boolean
  distanceFromNewestSV: SharedValue<number>
  isShownByScroll: SharedValue<boolean>
  isScrollToBottomShown: SharedValue<boolean>
  listState: () => ListState | undefined
  pageDownReturn: PageDownReturn | null
}

/**
 * The counter on the scroll-to-bottom button: messages that arrive while away from the newest
 * one, less those scrolled into view since.
 */
export function usePageDownUnread<TMessage extends IMessage> ({
  messages,
  isInverted,
  userId,
  isScrollToBottomEnabled,
  isScrollToBottomBadgeEnabled,
  isScrollToBottomVisible,
  distanceFromNewestSV,
  isShownByScroll,
  isScrollToBottomShown,
  listState,
  pageDownReturn,
}: PageDownUnreadOptions<TMessage>) {
  // The counter on the scroll-to-bottom button: messages that
  // arrive while away from the newest one count up and bring the button up; each counts down
  // as it scrolls into view (read), and the count clears when the button goes.
  const unreadIdsRef = useRef(new Set<string | number>())
  const [unreadCount, setUnreadCount] = useState(0)
  const newestMessageId = messages.length > 0
    ? (isInverted ? messages[0] : messages[messages.length - 1])?._id
    : undefined
  const previousNewestIdRef = useRef(newestMessageId)
  useEffect(() => {
    const previousNewestId = previousNewestIdRef.current
    previousNewestIdRef.current = newestMessageId

    if (!isScrollToBottomEnabled || previousNewestId == null || newestMessageId === previousNewestId)
      return

    const previousIndex = messages.findIndex(message => message._id === previousNewestId)
    if (previousIndex < 0)
      return

    const arrived = isInverted ? messages.slice(0, previousIndex) : messages.slice(previousIndex + 1)
    // At the newest message (within 5dp), or after sending one yourself, there is nothing to
    // count: the list follows the new message.
    const isFromMe = arrived.some(message => message.user?._id === userId)
    // The list follows a new message with an animated scroll, so the distance is not back to 0
    // yet when it lands; whether the list is following the end is what says it was seen.
    const state = listState()
    const isAtNewest = state ? state.isFollowingEnd || state.isNearEnd : distanceFromNewestSV.get() <= NEWEST_SLOP
    if (isFromMe || isAtNewest) {
      unreadIdsRef.current.clear()
      setUnreadCount(0)
      return
    }

    const incoming = arrived.filter(message => !message.system)
    if (incoming.length === 0)
      return

    if (isScrollToBottomBadgeEnabled) {
      incoming.forEach(message => unreadIdsRef.current.add(message._id))
      setUnreadCount(unreadIdsRef.current.size)
    }
    isShownByScroll.set(false)
    isScrollToBottomShown.set(true)
  }, [newestMessageId, messages, isInverted, userId, isScrollToBottomEnabled, isScrollToBottomBadgeEnabled, distanceFromNewestSV, isShownByScroll, isScrollToBottomShown, listState])

  // Read as they come into view.
  const markRowsSeen = useCallback((ids: (string | number)[]) => {
    if (unreadIdsRef.current.size === 0)
      return

    let changed = false
    for (const id of ids)
      changed = unreadIdsRef.current.delete(id) || changed

    if (changed)
      setUnreadCount(unreadIdsRef.current.size)
  }, [])

  // Through a ref: the callback changes with every new message, and re-running this then would
  // clear a count just set by a message that arrived before the button had come up.
  const clearPageDownReturnRef = useRef(pageDownReturn?.clear)
  const clearPageDownReturn = pageDownReturn?.clear
  // A layout effect, so it is current before the passive effect below reads it.
  useLayoutEffect(() => {
    clearPageDownReturnRef.current = clearPageDownReturn
  })
  useEffect(() => {
    if (!isScrollToBottomVisible) {
      unreadIdsRef.current.clear()
      setUnreadCount(0)
      clearPageDownReturnRef.current?.()
    }
  }, [isScrollToBottomVisible])

  return { unreadCount, markRowsSeen }
}
