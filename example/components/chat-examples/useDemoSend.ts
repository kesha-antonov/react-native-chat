import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

/** When the demo "server" takes a message, and when the other side reads it. */
const SENT_MS = 500
const READ_MS = 1800

/**
 * `onSend` for the demos. A sent message goes through the states Telegram shows on every outgoing
 * message, voice notes and files included: a clock while it goes out (`pending`), one check once
 * the server has it (`sent`), two once it is read (`received`). A real app sets those three from
 * its backend instead.
 */
export function useDemoSend<TMessage extends IMessage> (setMessages: Dispatch<SetStateAction<TMessage[]>>) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return useCallback((newMessages: TMessage[] = []) => {
    const ids = new Set(newMessages.map(message => message._id))
    const patch = (fields: Partial<IMessage>) =>
      setMessages(previous => previous.map(message => (ids.has(message._id) ? { ...message, ...fields } : message)))

    setMessages(previous => Chat.append(previous, newMessages.map(message => ({ ...message, pending: true }))))
    timers.current.push(setTimeout(() => patch({ pending: false, sent: true }), SENT_MS))
    timers.current.push(setTimeout(() => patch({ received: true }), READ_MS))
  }, [setMessages])
}
