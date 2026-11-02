import React, { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { Chat, IMessage, MessageMenuItem } from '@kesha-antonov/react-native-chat'
import Info from 'lucide-react-native/icons/info'
import { useDemoSend } from './useDemoSend'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }

const INITIAL_MESSAGES: IMessage[] = [
  { _id: 3, text: 'Edit shows on your own messages only.', createdAt: new Date(Date.now() - 1000 * 20), user: USER },
  { _id: 2, text: 'Long-press me: Reply, Copy, Pin, Delete, a custom Info action, and a reactions row on top.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'Long-press a message to open the context menu.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

export default function ContextMenuExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)

  const onSend = useDemoSend(setMessages)

  const onReactionPress = useCallback((message: IMessage, emoji: string) => {
    setMessages(previous => Chat.toggleReaction(previous, message._id, emoji, USER._id))
  }, [])

  // Reply and Copy are built in; each callback below turns on one more built-in action.
  const onEditMessage = useCallback((message: IMessage, text: string) => {
    setMessages(previous => previous.map(m => (m._id === message._id ? { ...m, text, editedAt: new Date() } : m)))
  }, [])

  const onPinMessage = useCallback((message: IMessage) => {
    setMessages(previous => previous.map(m => (m._id === message._id ? { ...m, isPinned: !m.isPinned } : m)))
  }, [])

  const onDeleteMessage = useCallback((message: IMessage) => {
    setMessages(previous => previous.filter(m => m._id !== message._id))
  }, [])

  // A function gets the built-in actions for the message, so you can add to them.
  const messageActions = useCallback((message: IMessage, defaults: MessageMenuItem[]): MessageMenuItem[] => [
    ...defaults,
    {
      key: 'info',
      label: 'Info',
      icon: ({ color, size }) => <Info color={color} size={size} />,
      onPress: () => Alert.alert('Message info', `Sent ${new Date(message.createdAt).toLocaleString()}`),
    },
  ], [])

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={USER}
      onEditMessage={onEditMessage}
      onPinMessage={onPinMessage}
      onDeleteMessage={onDeleteMessage}
      messageActions={messageActions}
      reactions={{ onReactionPress }}
    />
  )
}
