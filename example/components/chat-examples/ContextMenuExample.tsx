import React, { useCallback, useState } from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { Chat, IMessage, MessageMenuItem, MessageReaction } from '@kesha-antonov/react-native-chat'
import * as Clipboard from 'expo-clipboard'

import { useKeyboardVerticalOffset } from '../../hooks/useKeyboardVerticalOffset'
import { getColorSchemeStyle } from '../../utils/styleUtils'

interface ChatMessage extends IMessage {
  reactions?: MessageReaction[]
}

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }
const CURRENT_USER_ID = 1

const INITIAL_MESSAGES: ChatMessage[] = [
  { _id: 2, text: 'Long-press me: Copy, Delete, and a reactions row on top.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'Long-press a message to open the context menu.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

export default function ContextMenuExample () {
  const colorScheme = useColorScheme()
  const keyboardVerticalOffset = useKeyboardVerticalOffset()
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
    setMessages(previous => previous.map(m => {
      if (m._id !== message._id)
        return m

      const existing = (m.reactions ?? []).find(r => r.emoji === emoji)
      if (!existing)
        return { ...m, reactions: [...(m.reactions ?? []), { emoji, userIds: [CURRENT_USER_ID] }] }

      const userIds = existing.userIds.includes(CURRENT_USER_ID)
        ? existing.userIds.filter(id => id !== CURRENT_USER_ID)
        : [...existing.userIds, CURRENT_USER_ID]

      return {
        ...m,
        reactions: userIds.length === 0
          ? (m.reactions ?? []).filter(r => r.emoji !== emoji)
          : (m.reactions ?? []).map(r => (r.emoji === emoji ? { ...r, userIds } : r)),
      }
    }))
  }, [])

  const messageActions = useCallback((message: ChatMessage): MessageMenuItem[] => {
    const items: MessageMenuItem[] = []

    if (message.text)
      items.push({ label: 'Copy', onPress: () => Clipboard.setStringAsync(message.text) })

    items.push({
      label: 'Delete',
      destructive: true,
      onPress: () => setMessages(previous => previous.filter(m => m._id !== message._id)),
    })

    return items
  }, [])

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<ChatMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        messageActions={messageActions}
        reactions={{ isEnabled: true, onReactionPress: handleReactionPress }}
        keyboardAvoidingViewProps={{ keyboardVerticalOffset }}
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
