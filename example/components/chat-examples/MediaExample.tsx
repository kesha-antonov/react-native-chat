import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import { useColorScheme } from '@/hooks/use-color-scheme'
import { getColorSchemeStyle } from '../../utils/styleUtils'

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
    _id: 'file',
    text: '',
    createdAt: new Date(Date.now() - 1000 * 50),
    user: BOT,
    file: { uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', name: 'Quarterly report.pdf', size: 13264, mimeType: 'application/pdf' },
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
    text: 'This screen shows audio, video, file and location messages. Hold the mic to record a voice note, or tap the camera to record a video. The paperclip opens the built-in attachment menu: pick photos, a file or your location.',
    createdAt: new Date(Date.now() - 1000 * 240),
    user: BOT,
  },
]

export default function MediaExample () {
  const colorScheme = useColorScheme()
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages))
  }, [])

  const audioRecording = useMemo(() => ({ isEnabled: true }), [])
  // Telegram-style round video notes (react-native-vision-camera). On a
  // simulator there is no camera, so the recorder runs in POC mode.
  const videoRecording = useMemo(() => ({ isEnabled: true, maxDuration: 30 }), [])

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        // This example wires the optional media peers:
        //   - expo-audio              -> voice recording + simple audio playback
        //   - expo-video              -> inline video playback
        //   - react-native-vision-camera -> round video notes (camera button in the bar)
        //   - expo-media-library, expo-document-picker, expo-location -> the attachment menu
        audioRecording={audioRecording}
        videoRecording={videoRecording}
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
