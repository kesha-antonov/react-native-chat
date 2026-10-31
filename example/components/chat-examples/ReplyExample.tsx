import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage, ReplyMessage } from '@kesha-antonov/react-native-chat'

import { useColorScheme } from '@/hooks/use-color-scheme'
import messagesData from '../../example-expo/data/messages'
import { getColorSchemeStyle } from '../../utils/styleUtils'

export interface IChatMessage extends IMessage {
  replyMessage?: ReplyMessage
}

export default function ReplyExample () {
  const [messages, setMessages] = useState<IChatMessage[]>(messagesData)
  const colorScheme = useColorScheme()

  const user = useMemo(() => ({
    _id: 1,
    name: 'Developer',
  }), [])

  const onSend = useCallback((newMessages: IChatMessage[] = []) => {
    const messagesWithIds = newMessages.map(msg => ({
      ...msg,
      _id: msg._id || Math.random().toString(36).substring(7),
      user: msg.user || user,
    }))
    setMessages(previousMessages =>
      Chat.append(previousMessages, messagesWithIds)
    )
  }, [user])

  const handlePressReply = useCallback((reply: ReplyMessage) => {
    console.log('Pressed reply:', reply)
    // Could scroll to the original message here
  }, [])

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<IChatMessage>
        messages={messages}
        onSend={onSend}
        user={user}
        // New grouped reply props
        reply={{
          swipe: {
            isEnabled: true,
            direction: 'left', // swipe left to reply
          },
          onPress: handlePressReply,
        }}
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
