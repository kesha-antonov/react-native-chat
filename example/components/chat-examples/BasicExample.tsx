import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { AttachmentAction, Chat, IMessage } from '@kesha-antonov/react-native-chat'
// Deep imports, not the `lucide-react-native` barrel: the barrel re-exports every icon in the
// set and Metro has no tree-shaking, so importing from it ships all ~1600 of them (~1.2 MB).
import CameraIcon from 'lucide-react-native/icons/camera'
import ImageIcon from 'lucide-react-native/icons/image'
import MapPin from 'lucide-react-native/icons/map-pin'

import earlierMessages from '../../example-expo/data/earlierMessages'
import messagesData from '../../example-expo/data/messages'
import { getLocationAsync, pickImageAsync, takePictureAsync } from '../../example-expo/mediaUtils'
import EmojiPicker from '../EmojiPicker'

const newId = () => Math.random().toString(36).substring(7)

export default function BasicExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)
  const [text, setText] = useState('')
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)

  const user = useMemo(() => ({
    _id: 1,
    name: 'Developer',
  }), [])

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    const messagesWithIds = newMessages.map(msg => ({
      ...msg,
      _id: msg._id || newId(),
      user: msg.user || user,
      createdAt: msg.createdAt || new Date(),
    }))
    setMessages(previousMessages =>
      Chat.append(previousMessages, messagesWithIds)
    )
  }, [user])

  const onPressLoadEarlierMessages = useCallback(() => {
    setIsLoadingEarlier(true)
    setTimeout(() => {
      setMessages(previousMessages =>
        Chat.prepend(previousMessages, earlierMessages())
      )
      setIsLoadingEarlier(false)
    }, 1500)
  }, [])

  const sendImages = useCallback((images?: string[]) => {
    if (!images)
      return

    onSend(images.map(image => ({ _id: newId(), image, text: '', createdAt: new Date(), user })))
  }, [onSend, user])

  // The paperclip in the field opens a Telegram-style grid of these tiles.
  const attachmentActions = useMemo<AttachmentAction[]>(() => [
    {
      title: 'Gallery',
      color: '#8E44AD',
      icon: ({ color, size }) => <ImageIcon color={color} size={size} />,
      action: async () => sendImages(await pickImageAsync()),
    },
    {
      title: 'Camera',
      color: '#E74C3C',
      icon: ({ color, size }) => <CameraIcon color={color} size={size} />,
      action: async () => sendImages(await takePictureAsync()),
    },
    {
      title: 'Location',
      color: '#2ECC71',
      icon: ({ color, size }) => <MapPin color={color} size={size} />,
      action: async () => {
        const location = await getLocationAsync()
        if (location)
          onSend([{ _id: newId(), location, text: '', createdAt: new Date(), user }])
      },
    },
  ], [onSend, sendImages, user])

  const audioRecording = useMemo(() => ({ isEnabled: true }), [])
  const videoRecording = useMemo(() => ({ isEnabled: true, maxDuration: 30 }), [])

  return (
    <View style={styles.container}>
      <Chat
        messages={messages}
        onSend={onSend}
        user={user}
        loadEarlierMessagesProps={{ isAvailable: true, isLoading: isLoadingEarlier, onPress: onPressLoadEarlierMessages }}
        // Controlled text so the emoji button can insert into the field.
        text={text}
        textInputProps={{ onChangeText: setText }}
        actions={attachmentActions}
        onPressEmoji={() => setIsEmojiOpen(true)}
        audioRecording={audioRecording}
        videoRecording={videoRecording}
        messageTextProps={{
          hashtag: true,
          hashtagUrl: 'https://twitter.com/hashtag/',
        }}
        isScrollToBottomEnabled
      />
      <EmojiPicker
        visible={isEmojiOpen}
        onClose={() => setIsEmojiOpen(false)}
        onSelect={emoji => setText(t => t + emoji)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
