import React, { useCallback, useState } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

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

// Voice notes (expo-audio) and round video notes (react-native-vision-camera)
// are on by default; this only shortens the round note limit from 60s to 30s. On a simulator
// there is no camera, so the recorder runs in POC mode.
const VIDEO_RECORDING = { maxDuration: 30 }

export default function MediaExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages))
  }, [])

  // Playback works out of the box with the optional peers installed: expo-audio for voice,
  // expo-video for video and round notes, expo-sharing to open files.
  return (
    <Chat<IMessage>
      messages={messages}
      onSend={onSend}
      user={USER}
      videoRecording={VIDEO_RECORDING}
    />
  )
}
