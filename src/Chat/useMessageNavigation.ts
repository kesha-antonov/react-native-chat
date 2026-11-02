import { RefObject, useCallback, useEffect, useMemo, useState } from 'react'
import { MediaPlaybackController } from '../components/mediaPlayback'
import { createMessageHighlightStore } from '../components/messageHighlight'
import { AnimatedList } from '../MessagesContainer'
import { PageDownReturn } from '../MessagesContainer/pageDownReturn'
import { IMessage, ReplyMessage } from '../Models'

/**
 * Moving around the list: scrolling to a message (from the now-playing bar or a quote),
 * flashing it, and the way back to where a quote was tapped.
 */
export function useMessageNavigation<TMessage extends IMessage> ({
  messagesRef,
  messagesContainerRef,
  mediaController,
}: {
  messagesRef: RefObject<TMessage[]>
  messagesContainerRef: RefObject<AnimatedList>
  mediaController: MediaPlaybackController
}) {
  const [highlightStore] = useState(createMessageHighlightStore)
  useEffect(() => () => highlightStore.dispose(), [highlightStore])

  // Read through a ref: these end up in the reply config every row gets, and depending on
  // `messages` re-rendered every mounted row each time a message was sent or arrived.
  const getSenderName = useCallback((messageId: string | number) =>
    messagesRef.current.find(message => message._id === messageId)?.user?.name
  , [messagesRef])

  // The now-playing bar scrolls to the playing message.
  const scrollToMessage = useCallback((messageId: string | number) => {
    if (!messagesRef.current.some(message => message._id === messageId))
      return

    // By key: the list reaches a row it has not measured yet, far up the history, too.
    messagesContainerRef.current?.scrollToKey({ key: String(messageId), animated: true, viewPosition: 0.5 })
  }, [messagesContainerRef, messagesRef])

  // Tapping a quote jumps to the message it quotes and flashes it. The scroll-to-bottom button
  // then comes up and takes you back to where you tapped it (`returnToMessageId`).
  const [returnToMessageId, setReturnToMessageId] = useState<string | number | null>(null)
  const jumpToQuotedMessage = useCallback((replyMessage: ReplyMessage, fromMessage?: IMessage) => {
    scrollToMessage(replyMessage._id)
    highlightStore.highlight(replyMessage._id)
    if (fromMessage && fromMessage._id !== replyMessage._id)
      setReturnToMessageId(fromMessage._id)
  }, [scrollToMessage, highlightStore])

  const pageDownReturn = useMemo((): PageDownReturn => ({
    messageId: returnToMessageId,
    goBack: () => {
      if (returnToMessageId == null)
        return

      scrollToMessage(returnToMessageId)
      highlightStore.highlight(returnToMessageId)
      setReturnToMessageId(null)
    },
    clear: () => setReturnToMessageId(null),
  }), [returnToMessageId, scrollToMessage, highlightStore])

  useEffect(() => {
    mediaController.setScroller(scrollToMessage)
    return () => mediaController.setScroller(null)
  }, [mediaController, scrollToMessage])

  return { highlightStore, getSenderName, scrollToMessage, jumpToQuotedMessage, pageDownReturn }
}
