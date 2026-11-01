import React, { useCallback, useState } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import messagesData from '../../example-expo/data/messages'

const USER = { _id: 1, name: 'Developer' }
// The quick bar's emojis are yours to pick; the chevron after them opens the built-in full
// emoji grid either way.
const QUICK_REACTIONS = ['🔥', '🎉', '😍', '🤯', '👏', '🙏', '💯']

export default function ReactionsExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  // Reactions live in your messages, so toggling one is yours too: `Chat.toggleReaction`
  // adds or removes the current user's pick (one per user).
  const onReactionPress = useCallback((message: IMessage, emoji: string) => {
    setMessages(previousMessages => Chat.toggleReaction(previousMessages, message._id, emoji, USER._id))
  }, [])

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={USER}
      reactions={{ onReactionPress, emojis: QUICK_REACTIONS }}
    />
  )
}
