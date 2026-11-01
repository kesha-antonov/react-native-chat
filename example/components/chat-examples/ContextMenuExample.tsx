import React, { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage, MessageReaction } from '@kesha-antonov/react-native-chat'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { getColorSchemeStyle } from '../../utils/styleUtils'

interface ChatMessage extends IMessage {
  reactions?: MessageReaction[]
}

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }
const CURRENT_USER_ID = 1

const INITIAL_MESSAGES: ChatMessage[] = [
  { _id: 2, text: 'Long-press me: Reply, Copy, Pin, Delete, and a reactions row on top.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'Long-press a message to open the context menu.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

export default function ContextMenuExample () {
  const colorScheme = useColorScheme()
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)

  const onSend = useCallback((newMessages: ChatMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages.map(m => ({
      ...m,
      _id: m._id || Math.random().toString(36).slice(2),
      user: USER,
      createdAt: new Date(),
    }))))
  }, [])

  const handleReactionPress = useCallback((message: ChatMessage, emoji: string) => {
    setMessages(previous => Chat.toggleReaction(previous, message._id, emoji, CURRENT_USER_ID))
  }, [])

  // The menu's Reply and Copy are built in; these callbacks add Edit (on your own messages),
  // Pin / Unpin, and a red Delete.
  const handleEditMessage = useCallback((message: ChatMessage, text: string) => {
    setMessages(previous => previous.map(m => (m._id === message._id ? { ...m, text, editedAt: new Date() } : m)))
  }, [])

  const handlePinMessage = useCallback((message: ChatMessage) => {
    setMessages(previous => previous.map(m => (m._id === message._id ? { ...m, isPinned: !m.isPinned } : m)))
  }, [])

  const handleDeleteMessage = useCallback((message: ChatMessage) => {
    setMessages(previous => previous.filter(m => m._id !== message._id))
  }, [])

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<ChatMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        onEditMessage={handleEditMessage}
        onPinMessage={handlePinMessage}
        onDeleteMessage={handleDeleteMessage}
        reactions={{ onReactionPress: handleReactionPress }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container_dark: {
    backgroundColor: '#000',
  },
})
