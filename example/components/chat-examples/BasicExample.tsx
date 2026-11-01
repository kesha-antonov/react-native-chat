import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import earlierMessages from '../../example-expo/data/earlierMessages'
import messagesData from '../../example-expo/data/messages'

// The emoji keyboard and the attachment menu (Gallery, File, Location) are built in: the
// composer's emoji button and paperclip work with no props, and picks arrive in `onSend`.
export default function BasicExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)

  const user = useMemo(() => ({
    _id: 1,
    name: 'Developer',
  }), [])

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  const onPressLoadEarlierMessages = useCallback(() => {
    setIsLoadingEarlier(true)
    setTimeout(() => {
      setMessages(previousMessages =>
        Chat.prepend(previousMessages, earlierMessages())
      )
      setIsLoadingEarlier(false)
    }, 1500)
  }, [])

  const audioRecording = useMemo(() => ({ isEnabled: true }), [])
  const videoRecording = useMemo(() => ({ isEnabled: true, maxDuration: 30 }), [])

  return (
    <View style={styles.container}>
      <Chat
        messages={messages}
        onSend={onSend}
        user={user}
        loadEarlierMessagesProps={{ isAvailable: true, isLoading: isLoadingEarlier, onPress: onPressLoadEarlierMessages }}
        audioRecording={audioRecording}
        videoRecording={videoRecording}
        messageTextProps={{
          hashtag: true,
          hashtagUrl: 'https://twitter.com/hashtag/',
        }}
        isScrollToBottomEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
