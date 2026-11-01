import { useCallback, useMemo, useState } from 'react'

import { IMessage } from '../Models'
import { ChatListItem } from './types'

type Id = ChatListItem['id']

/**
 * Local state for a `ChatList`: the chats plus handlers for every list action, ready to spread
 * onto the list. Use it for prototypes, or as the store in front of your backend: call your API
 * in the handlers you wrap, and feed server updates through `upsertChat` / `receiveMessage`.
 *
 * ```tsx
 * const list = useChatList(initialChats)
 * <ChatList chats={list.chats} user={me} {...list.handlers} onPressChat={openChat} />
 * ```
 */
export function useChatList<TChat extends ChatListItem = ChatListItem> (initialChats: TChat[] = []) {
  const [chats, setChats] = useState<TChat[]>(initialChats)

  const patch = useCallback((ids: Id[], change: (chat: TChat) => TChat) => {
    const wanted = new Set(ids)
    setChats(current => current.map(chat => (wanted.has(chat.id) ? change(chat) : chat)))
  }, [])

  /** Pinning moves a chat to the top of the pinned ones; archiving unpins. */
  const onPinChats = useCallback((selection: TChat[], isPinned: boolean) => {
    const ids = new Set(selection.map(chat => chat.id))
    setChats(current => {
      const changed = current.filter(chat => ids.has(chat.id)).map(chat => ({ ...chat, isPinned }))
      const rest = current.filter(chat => !ids.has(chat.id))
      return isPinned ? [...changed, ...rest] : [...rest, ...changed]
    })
  }, [])

  const onMuteChats = useCallback((selection: TChat[], isMuted: boolean) => {
    patch(selection.map(chat => chat.id), chat => ({ ...chat, isMuted }))
  }, [patch])

  const onArchiveChats = useCallback((selection: TChat[], isArchived: boolean) => {
    patch(selection.map(chat => chat.id), chat => ({ ...chat, isArchived, isPinned: isArchived ? false : chat.isPinned }))
  }, [patch])

  const onDeleteChats = useCallback((selection: TChat[]) => {
    const ids = new Set(selection.map(chat => chat.id))
    setChats(current => current.filter(chat => !ids.has(chat.id)))
  }, [])

  /** Puts the pinned chats in the dragged order. */
  const onReorderPinnedChats = useCallback((ids: Id[]) => {
    setChats(current => {
      const byId = new Map(current.map(chat => [chat.id, chat]))
      const pinned = ids.map(id => byId.get(id)).filter((chat): chat is TChat => !!chat)
      const moved = new Set(ids)
      return [...pinned, ...current.filter(chat => !moved.has(chat.id))]
    })
  }, [])

  /** Adds a chat, or replaces the one with the same id. */
  const upsertChat = useCallback((chat: TChat) => {
    setChats(current => current.some(other => other.id === chat.id)
      ? current.map(other => (other.id === chat.id ? chat : other))
      : [...current, chat])
  }, [])

  /** A new message in a chat: it becomes the last message, and counts as unread unless `isRead`. */
  const receiveMessage = useCallback((id: Id, message: IMessage, isRead = false) => {
    patch([id], chat => ({
      ...chat,
      lastMessage: message,
      unreadCount: isRead ? chat.unreadCount ?? 0 : (chat.unreadCount ?? 0) + 1,
    }))
  }, [patch])

  const markRead = useCallback((id: Id) => {
    patch([id], chat => ({ ...chat, unreadCount: 0 }))
  }, [patch])

  const updateChat = useCallback((id: Id, change: Partial<TChat>) => {
    patch([id], chat => ({ ...chat, ...change }))
  }, [patch])

  const handlers = useMemo(() => ({
    onPinChats,
    onMuteChats,
    onArchiveChats,
    onDeleteChats,
    onReorderPinnedChats,
  }), [onPinChats, onMuteChats, onArchiveChats, onDeleteChats, onReorderPinnedChats])

  return { chats, setChats, handlers, upsertChat, updateChat, receiveMessage, markRead }
}
