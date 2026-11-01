import React, { useCallback, useState } from 'react'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

// Generates a labelled chat spanning several days so the floating/animated day
// header and the inline day separators can be exercised. Each "day" is a fixed
// number of days before today with a handful of messages, alternating sides.
const USER = { _id: 1, name: 'Developer' }
const MESSAGES_PER_DAY = 6
const INITIAL_DAYS = 4
const LOAD_EARLIER_DAYS = 3

const generateDay = (dayOffset: number): IMessage[] => {
  const messages: IMessage[] = []
  for (let m = MESSAGES_PER_DAY - 1; m >= 0; m--) {
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - dayOffset)
    createdAt.setHours(10, m, 0, 0)
    const fromMe = m % 2 === 0
    messages.push({
      _id: `day-${dayOffset}-msg-${m}`,
      text: `Day -${dayOffset} · message ${m}`,
      createdAt,
      user: fromMe
        ? { _id: 1, name: 'Developer' }
        : { _id: 2, name: 'John Doe' },
    })
  }
  return messages
}

// Inclusive range of day offsets, newest message first (descending createdAt).
const generateRange = (fromDayOffset: number, toDayOffset: number): IMessage[] => {
  let messages: IMessage[] = []
  for (let day = fromDayOffset; day <= toDayOffset; day++)
    messages = messages.concat(generateDay(day))

  return messages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export default function DayAnimatedExample () {
  const [messages, setMessages] = useState<IMessage[]>(() => generateRange(0, INITIAL_DAYS - 1))
  const [oldestDayOffset, setOldestDayOffset] = useState(INITIAL_DAYS - 1)
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  const onPressLoadEarlierMessages = useCallback(() => {
    setIsLoadingEarlier(true)
    setTimeout(() => {
      const from = oldestDayOffset + 1
      const to = oldestDayOffset + LOAD_EARLIER_DAYS
      setMessages(previousMessages =>
        Chat.prepend(previousMessages, generateRange(from, to))
      )
      setOldestDayOffset(to)
      setIsLoadingEarlier(false)
    }, 1500)
  }, [oldestDayOffset])

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={USER}
      loadEarlierMessagesProps={{
        isAvailable: true,
        isLoading: isLoadingEarlier,
        onPress: onPressLoadEarlierMessages,
      }}
    />
  )
}
