import { useEffect, useInsertionEffect, useRef, useState } from 'react'
import {
  createMediaPlaybackController,
  setPlaybackRate,
  subscribePlaybackRate,
} from '../components/mediaPlayback'
import { createMediaTransferController } from '../components/mediaTransfer'
import { createMediaGallery } from '../components/mediaViewer/gallery'
import { IMessage } from '../Models'
import { ChatProps } from './types'

/**
 * The chat's media controllers: the playlist players register with, the media button handlers
 * and the gallery the media viewer pages through. Also keeps the latest messages in a ref, for
 * what reads them only when it needs them.
 */
export function useChatMedia<TMessage extends IMessage> ({
  messages,
  isInverted,
  mediaPlayback,
  mediaTransfer,
}: {
  messages: TMessage[]
  isInverted: boolean
  mediaPlayback: ChatProps<TMessage>['mediaPlayback']
  mediaTransfer: ChatProps<TMessage>['mediaTransfer']
}) {
  // One playlist per chat: players register by message id and the controller
  // finds the next note from these messages. Fed on every render as a plain
  // write, so the list rows never re-render for it.
  const [mediaController] = useState(createMediaPlaybackController)
  mediaController.setMessages(messages, isInverted)
  mediaController.setOptions({
    isAutoPlayNextEnabled: mediaPlayback?.isAutoPlayNextEnabled ?? true,
    isRoundVideoAutoplayEnabled: mediaPlayback?.isRoundVideoAutoplayEnabled ?? false,
    onMediaRead: mediaPlayback?.onMediaRead,
    isNearEar: mediaPlayback?.isNearEar,
    onTranscribe: mediaPlayback?.onTranscribe,
    onViewOnceEnd: mediaPlayback?.onViewOnceEnd,
    isFloatingRoundNoteEnabled: mediaPlayback?.isFloatingRoundNoteEnabled ?? true,
  })

  // Media button handlers, read at press time; written per render like the
  // playback options so rows never re-render for a new handler.
  const [mediaTransferController] = useState(createMediaTransferController)
  mediaTransferController.set(mediaTransfer)

  // The latest messages, for what reads them only when it needs them: the selection, and the
  // photos the media viewer pages through (read when it opens, so nothing re-renders as
  // messages arrive).
  const messagesRef = useRef(messages)
  const [mediaGallery] = useState(createMediaGallery)
  useInsertionEffect(() => {
    messagesRef.current = messages
    mediaGallery.setMessages(messages)
  })

  // A round note kept playing past its row is stopped with the chat, and rows
  // unmounting along with it stop theirs rather than floating them.
  useEffect(() => {
    mediaController.notePlayers.setActive(true)
    return () => mediaController.notePlayers.setActive(false)
  }, [mediaController])

  const initialPlaybackRate = mediaPlayback?.playbackRate
  useEffect(() => {
    if (initialPlaybackRate != null)
      setPlaybackRate(initialPlaybackRate)
  }, [initialPlaybackRate])

  const onPlaybackRateChange = mediaPlayback?.onPlaybackRateChange
  const onPlaybackRateChangeRef = useRef(onPlaybackRateChange)
  useInsertionEffect(() => {
    onPlaybackRateChangeRef.current = onPlaybackRateChange
  })
  useEffect(() => subscribePlaybackRate(rate => onPlaybackRateChangeRef.current?.(rate)), [])

  return { mediaController, mediaTransferController, mediaGallery, messagesRef }
}
