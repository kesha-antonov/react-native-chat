import React, { useCallback, useMemo, useState } from 'react'
import { Alert, StyleSheet, View, useColorScheme } from 'react-native'
import { AttachmentAction, Chat, IMessage } from '@kesha-antonov/react-native-chat'
// Deep imports, not the `lucide-react-native` barrel: the barrel re-exports every icon in the
// set and Metro has no tree-shaking, so importing from it ships all ~1600 of them (~1.2 MB).
import CameraIcon from 'lucide-react-native/dist/esm/icons/camera.mjs'
import FileText from 'lucide-react-native/dist/esm/icons/file-text.mjs'
import ImageIcon from 'lucide-react-native/dist/esm/icons/image.mjs'
import MapPin from 'lucide-react-native/dist/esm/icons/map-pin.mjs'

import { getColorSchemeStyle } from '../../utils/styleUtils'
import EmojiPicker from '../EmojiPicker'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Media Bot' }

// Public sample media for the demo.
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
const SAMPLE_VIDEO = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'

const INITIAL_MESSAGES: IMessage[] = [
  {
    _id: 'note-out',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 20),
    user: USER,
    video: SAMPLE_VIDEO,
    videoNote: true,
    duration: 8,
    sent: true,
    received: true,
  },
  {
    _id: 'note-in',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 40),
    user: BOT,
    video: SAMPLE_VIDEO,
    videoNote: true,
    duration: 8,
  },
  {
    _id: 'loc',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 60),
    user: BOT,
    location: { latitude: 37.78825, longitude: -122.4324 },
  },
  {
    _id: 'vid',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 120),
    user: BOT,
    video: SAMPLE_VIDEO,
  },
  {
    _id: 'aud',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 180),
    user: BOT,
    audio: SAMPLE_AUDIO,
  },
  {
    _id: 'intro',
    text: 'This screen shows audio, video and location messages. Hold the mic to record a voice note, or tap the camera to record a video. Tap the location card to open maps.',
    createdAt: new Date(Date.now() - 1000 * 240),
    user: BOT,
  },
]

export default function MediaExample () {
  const colorScheme = useColorScheme()
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [text, setText] = useState('')
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    const withIds = newMessages.map(msg => ({
      ...msg,
      _id: msg._id || Math.random().toString(36).slice(2),
      user: msg.user || USER,
      createdAt: msg.createdAt || new Date(),
    }))
    setMessages(previous => Chat.append(previous, withIds))
  }, [])

  const audioRecording = useMemo(() => ({ isEnabled: true }), [])
  // Telegram-style round video notes (react-native-vision-camera). On a
  // simulator there is no camera, so the recorder runs in POC mode.
  const videoRecording = useMemo(() => ({ isEnabled: true, maxDuration: 30 }), [])

  // Tap the paperclip in the field to open a Telegram-style attachment grid.
  // Providing `icon`/`color` switches the sheet from a list to a grid of tiles;
  // the icons here are Lucide glyphs (rendered white on the colored tiles).
  const attachmentActions = useMemo<AttachmentAction[]>(() => [
    { title: 'Gallery', color: '#8E44AD', icon: ({ color, size }) => <ImageIcon color={color} size={size} />, action: () => {} },
    { title: 'File', color: '#3498DB', icon: ({ color, size }) => <FileText color={color} size={size} />, action: () => {} },
    {
      title: 'Location',
      color: '#2ECC71',
      icon: ({ color, size }) => <MapPin color={color} size={size} />,
      action: () => onSend([{ _id: '', text: '', user: USER, location: { latitude: 51.5074, longitude: -0.1278 } } as IMessage]),
    },
    { title: 'Camera', color: '#E74C3C', icon: ({ color, size }) => <CameraIcon color={color} size={size} />, action: () => Alert.alert('Camera', 'Camera capture is available on a physical device.') },
  ], [onSend])

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        // Controlled text so the emoji button can insert into the field.
        text={text}
        textInputProps={{ onChangeText: setText }}
        // This example wires the optional media peers:
        //   - expo-audio              -> voice recording + simple audio playback
        //   - expo-video              -> inline video playback
        //   - react-native-vision-camera -> round video notes (camera button in the bar)
        audioRecording={audioRecording}
        videoRecording={videoRecording}
        actions={attachmentActions}
        // Emoji button inset on the left of the field opens the emoji picker.
        onPressEmoji={() => setIsEmojiOpen(true)}
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
    backgroundColor: '#fff',
  },
  container_dark: {
    backgroundColor: '#000',
  },
})
