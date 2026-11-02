import React, { useState } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import messagesData from '../../example-expo/data/messages'
import { useDemoSend } from './useDemoSend'

const USER = { _id: 1, name: 'Developer' }

// Replies need nothing: swipe a message left (or pick Reply in its long-press menu), and the
// sent message carries `replyMessage`. Tapping a quote jumps to the message it quotes.
export default function ReplyExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)

  const onSend = useDemoSend(setMessages)

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={USER}
    />
  )
}
