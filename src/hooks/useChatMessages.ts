import { useCallback, useMemo, useState } from 'react'

import { appendMessages, toggleReaction } from '../messageUtils'
import { IMessage, User } from '../Models'

export interface UseChatMessagesOptions<TMessage extends IMessage> {
  /** Messages to start with, newest first (the default `isInverted` order). */
  initialMessages?: TMessage[]
  /** The current user; reactions are toggled for them. */
  user: User
  /** Match `Chat`'s `isInverted`; default true. */
  isInverted?: boolean
}

export interface UseChatMessagesResult<TMessage extends IMessage> {
  messages: TMessage[]
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
  /**
   * Spread onto `<Chat />`: messages, user, and local handlers for sending, reactions,
   * editing and deleting. Pass your own prop after the spread to replace any of them.
   */
  chatProps: {
    messages: TMessage[]
    user: User
    onSend: (messages: TMessage[]) => void
    onEditMessage: (message: TMessage, text: string) => void
    onDeleteMessage: (message: TMessage) => void
    reactions: { onReactionPress: (message: TMessage, emoji: string) => void }
  }
}

/**
 * Local message state wired to every built-in feature, for prototypes and demos:
 *
 * ```tsx
 * const { chatProps } = useChatMessages({ initialMessages, user })
 * return <Chat {...chatProps} />
 * ```
 *
 * Nothing leaves the device; a real app replaces the handlers with calls to its backend.
 */
export function useChatMessages<TMessage extends IMessage = IMessage> ({
  initialMessages = [],
  user,
  isInverted = true,
}: UseChatMessagesOptions<TMessage>): UseChatMessagesResult<TMessage> {
  const [messages, setMessages] = useState<TMessage[]>(initialMessages)
  const userId = user._id

  const onSend = useCallback((newMessages: TMessage[]) => {
    setMessages(previous => appendMessages(previous, newMessages, isInverted))
  }, [isInverted])

  const onEditMessage = useCallback((message: TMessage, text: string) => {
    setMessages(previous => previous.map(m => (m._id === message._id ? { ...m, text } : m)))
  }, [])

  const onDeleteMessage = useCallback((message: TMessage) => {
    setMessages(previous => previous.filter(m => m._id !== message._id))
  }, [])

  const onReactionPress = useCallback((message: TMessage, emoji: string) => {
    setMessages(previous => toggleReaction(previous, message._id, emoji, userId))
  }, [userId])

  const reactions = useMemo(() => ({ onReactionPress }), [onReactionPress])

  const chatProps = useMemo(() => ({
    messages,
    user,
    onSend,
    onEditMessage,
    onDeleteMessage,
    reactions,
  }), [messages, user, onSend, onEditMessage, onDeleteMessage, reactions])

  return { messages, setMessages, chatProps }
}
