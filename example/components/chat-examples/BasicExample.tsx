import React, { useCallback, useState } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import earlierMessages from '../../example-expo/data/earlierMessages'
import messagesData from '../../example-expo/data/messages'

const USER = { _id: 1, name: 'Developer' }

// Everything is the default: the emoji keyboard, the attachment menu, the long-press menu,
// swipe-to-reply, voice and round video notes (on once expo-audio / vision-camera are
// installed), the scroll-to-bottom button. This screen only adds "Load earlier".
export default function BasicExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  const onPressLoadEarlierMessages = useCallback(() => {
    setIsLoadingEarlier(true)
    setTimeout(() => {
      setMessages(previousMessages => Chat.prepend(previousMessages, earlierMessages()))
      setIsLoadingEarlier(false)
    }, 1500)
  }, [])

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={USER}
      loadEarlierMessagesProps={{ isAvailable: true, isLoading: isLoadingEarlier, onPress: onPressLoadEarlierMessages }}
    />
  )
}
