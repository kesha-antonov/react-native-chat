import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chat, IMessage, MediaTransferProps } from '@kesha-antonov/react-native-chat'
import { File, Paths } from 'expo-file-system'
import { photo } from '@/constants/photos'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Loader Bot' }

// Real remote media, so the library's own fetches show real progress.
const VOICE_LONG = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
const VOICE_SHORT = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'
const ROUND_VIDEO = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'
const BROKEN_PHOTO = 'https://example.com/missing-photo.jpg'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000)

/** The newest messages first, as `Chat` expects. */
const LATEST: IMessage[] = [
  { _id: 'failed', text: 'This one could not be sent.', createdAt: minutesAgo(1), user: USER, isFailed: true },
  { _id: 'cycling', text: 'Watch my status: clock, one check, two checks.', createdAt: minutesAgo(1), user: USER, pending: true },
  { _id: 'sending', text: 'Still sending…', createdAt: minutesAgo(1), user: USER, pending: true },
  {
    _id: 'photo-upload',
    text: '',
    createdAt: minutesAgo(2),
    user: USER,
    image: photo('mountain', 1600, 1200),
    pending: true,
    transfer: { type: 'upload', progress: 0, totalBytes: 1_450_000 },
  },
  { _id: 'photo-broken', text: '', createdAt: minutesAgo(3), user: BOT, image: BROKEN_PHOTO },
  { _id: 'photo-manual', text: '', createdAt: minutesAgo(3), user: BOT, image: photo('mountains', 1600, 1200), isDownloadRequired: true },
  { _id: 'photo-remote', text: 'A photo loading from the web', createdAt: minutesAgo(4), user: BOT, image: `${photo('fog', 1600, 1200)}&v=${Date.now()}` },
  {
    _id: 'file-manual',
    text: '',
    createdAt: minutesAgo(5),
    user: BOT,
    file: { uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', name: 'Annual report.pdf', size: 4_718_592, mimeType: 'application/pdf' },
    isDownloadRequired: true,
  },
  { _id: 'round-remote', text: '', createdAt: minutesAgo(6), user: BOT, video: ROUND_VIDEO, videoNote: true, duration: 10 },
  {
    _id: 'voice-upload',
    text: '',
    createdAt: minutesAgo(7),
    user: USER,
    audio: VOICE_SHORT,
    duration: 325,
    pending: true,
    transfer: { type: 'upload', progress: 0 },
  },
  { _id: 'voice-manual', text: '', createdAt: minutesAgo(8), user: BOT, audio: VOICE_SHORT, duration: 325, isDownloadRequired: true },
  { _id: 'voice-remote', text: '', createdAt: minutesAgo(9), user: BOT, audio: VOICE_LONG, duration: 372 },
  {
    _id: 'intro',
    text: 'Loading states. Voice notes, photos and the round note fetch themselves with a progress ring; the arrows wait for a tap and then download slowly; your uploads show the ring and the sending clock. Scroll up for earlier messages.',
    createdAt: minutesAgo(10),
    user: BOT,
  },
]

const earlierPage = (page: number): IMessage[] => Array.from({ length: 8 }, (_, index) => ({
  _id: `earlier-${page}-${index}`,
  text: `Earlier message ${page * 8 + index + 1}`,
  createdAt: minutesAgo(60 * (page + 1) + index * 5),
  user: index % 3 === 0 ? USER : BOT,
  sent: true,
  received: true,
}))

const EARLIER_PAGES = 2
const HISTORY_LOAD_MS = 1500

type Patch = Partial<IMessage> | ((message: IMessage) => Partial<IMessage>)

/** Drives `transfer.progress` the way a slow network does: uneven steps every 250ms. */
const useSimulatedTransfers = (patch: (id: IMessage['_id'], change: Patch) => void) => {
  const timers = useRef(new Map<IMessage['_id'], ReturnType<typeof setInterval>>())

  useEffect(() => {
    const all = timers.current
    return () => all.forEach(clearInterval)
  }, [])

  const cancel = useCallback((id: IMessage['_id']) => {
    clearInterval(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const run = useCallback((id: IMessage['_id'], type: 'upload' | 'download', durationMs: number, totalBytes?: number) =>
    new Promise<void>(resolve => {
      cancel(id)
      let progress = 0
      patch(id, { transfer: { type, progress, totalBytes } })
      const step = 250 / durationMs
      timers.current.set(id, setInterval(() => {
        progress = Math.min(1, progress + step * (0.4 + Math.random() * 1.2))
        patch(id, { transfer: { type, progress, totalBytes } })
        if (progress >= 1) {
          cancel(id)
          resolve()
        }
      }, 250))
    }), [cancel, patch])

  return { run, cancel }
}

export default function LoadingExample () {
  const [messages, setMessages] = useState<IMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)
  const [pagesLoaded, setPagesLoaded] = useState(0)

  const patch = useCallback((id: IMessage['_id'], change: Patch) => {
    setMessages(previous => previous.map(message =>
      message._id === id
        ? { ...message, ...(typeof change === 'function' ? change(message) : change) }
        : message
    ))
  }, [])

  const transfers = useSimulatedTransfers(patch)

  // The history "loads" first: a spinner over the empty chat.
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages(LATEST)
      setIsLoading(false)
    }, HISTORY_LOAD_MS)
    return () => clearTimeout(timer)
  }, [])

  const upload = useCallback(async (id: IMessage['_id'], durationMs: number, totalBytes?: number) => {
    await transfers.run(id, 'upload', durationMs, totalBytes)
    patch(id, { transfer: undefined, pending: false, sent: true })
  }, [patch, transfers])

  // Once shown, the uploads run, and one message walks through the sending states.
  useEffect(() => {
    if (isLoading)
      return
    upload('voice-upload', 6000)
    upload('photo-upload', 5000, 1_450_000)
    const timers = [
      setTimeout(() => patch('cycling', { pending: false, sent: true }), 2500),
      setTimeout(() => patch('cycling', { received: true }), 4500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [isLoading, upload, patch])

  const mediaTransfer = useMemo<MediaTransferProps>(() => ({
    // A real app downloads here and swaps in the local file; this one also stretches the
    // bar over a few seconds so the ring can be watched.
    onDownload: async message => {
      if (message.audio) {
        const file = new File(Paths.cache, `voice-${message._id}.mp3`)
        const download = file.exists
          ? Promise.resolve(file)
          : File.downloadFileAsync(message.audio, file, { idempotent: true })
        await Promise.all([download, transfers.run(message._id, 'download', 5000)])
        patch(message._id, { transfer: undefined, isDownloadRequired: false, audio: file.uri })
        return
      }
      if (message.file) {
        await transfers.run(message._id, 'download', 4000)
        patch(message._id, { transfer: undefined, isDownloadRequired: false })
        return
      }
      // A photo: let the chat fetch it, with the real progress of the request.
      patch(message._id, { isDownloadRequired: false })
    },
    onCancel: message => {
      transfers.cancel(message._id)
      patch(message._id, message.transfer?.type === 'download'
        ? { transfer: undefined, isDownloadRequired: true }
        : { transfer: undefined, pending: false, isFailed: true })
    },
  }), [patch, transfers])

  const loadEarlier = useCallback(() => {
    setIsLoadingEarlier(true)
    setTimeout(() => {
      setMessages(previous => Chat.prepend(previous, earlierPage(pagesLoaded)))
      setPagesLoaded(pagesLoaded + 1)
      setIsLoadingEarlier(false)
    }, HISTORY_LOAD_MS)
  }, [pagesLoaded])

  const loadEarlierMessagesProps = useMemo(() => ({
    isAvailable: !isLoading && pagesLoaded < EARLIER_PAGES,
    isLoading: isLoadingEarlier,
    isInfiniteScrollEnabled: true,
    onPress: loadEarlier,
  }), [isLoading, pagesLoaded, isLoadingEarlier, loadEarlier])

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages.map(message => ({ ...message, pending: true }))))
    newMessages.forEach(message => setTimeout(() => patch(message._id, { pending: false, sent: true }), 800))
  }, [patch])

  return (
    <Chat<IMessage>
      messages={messages}
      onSend={onSend}
      user={USER}
      isLoading={isLoading}
      mediaTransfer={mediaTransfer}
      loadEarlierMessagesProps={loadEarlierMessagesProps}
    />
  )
}
