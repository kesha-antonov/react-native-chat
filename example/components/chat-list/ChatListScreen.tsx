import React, { useCallback, useEffect, useState } from 'react'
import { ChatList } from '@kesha-antonov/react-native-chat'
import { Href, useRouter } from 'expo-router'

import { ME } from './data'
import { chatStore, DialogItem, startChatListDemo, useChatListItems } from './store'

// The demo shows the loading placeholder once, on the first open of the tab in a session.
const SIMULATED_LOAD_MS = 1500
let hasLoadedDialogs = false

/**
 * The library's `ChatList` on top of the demo's store: the store is the "backend", and each
 * list action is one call into it. `archived` shows the Archived Chats folder: it is a screen of
 * its own, as in Telegram, which the main list pushes when the folder row is tapped.
 */
export default function ChatListScreen ({ archived = false }: { archived?: boolean }) {
  const router = useRouter()
  const chats = useChatListItems()
  const [isLoading, setIsLoading] = useState(!archived && !hasLoadedDialogs)

  useEffect(() => {
    startChatListDemo()
    if (hasLoadedDialogs)
      return
    const timer = setTimeout(() => {
      hasLoadedDialogs = true
      setIsLoading(false)
    }, SIMULATED_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])

  const onPressChat = useCallback((chat: DialogItem) => {
    router.push(`/chats/${chat.id}` as Href)
  }, [router])

  // The list asks to open the folder (its row) or to close it (its back arrow, Android's back).
  const onArchiveOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && !archived)
      router.push('/chats/archived' as Href)
    else if (!isOpen && archived)
      router.back()
  }, [archived, router])

  return (
    <ChatList<DialogItem>
      chats={chats}
      user={ME}
      isLoading={isLoading}
      isArchiveOpen={archived}
      onArchiveOpenChange={onArchiveOpenChange}
      onPressChat={onPressChat}
      onPressNewChat={() => router.push('/chats/new' as Href)}
      onPinChats={(selection, isPinned) => selection.forEach(chat => {
        if (!!chat.isPinned !== isPinned)
          chatStore.togglePin(chat.dialog.id)
      })}
      onMuteChats={(selection, isMuted) => selection.forEach(chat => {
        if (!!chat.isMuted !== isMuted)
          chatStore.toggleMute(chat.dialog.id)
      })}
      onArchiveChats={selection => selection.forEach(chat => chatStore.toggleArchive(chat.dialog.id))}
      onDeleteChats={selection => selection.forEach(chat => chatStore.deleteDialog(chat.dialog.id))}
      onReorderPinnedChats={ids => chatStore.setPinOrder(ids.map(String))}
    />
  )
}
