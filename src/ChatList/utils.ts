import dayjs from 'dayjs'

import { ChatLabels, formatLabel } from '../i18n'
import { IMessage, User } from '../Models'
import { ChatListItem } from './types'

const timeOf = (message?: IMessage) => (message?.createdAt ? new Date(message.createdAt).getTime() : 0)

/** Pinned chats first, in the order given, then the rest by their newest message. */
export function sortChats<TChat extends ChatListItem> (chats: TChat[]): TChat[] {
  const pinned = chats.filter(chat => chat.isPinned)
  const rest = chats
    .filter(chat => !chat.isPinned)
    .sort((a, b) => timeOf(b.lastMessage) - timeOf(a.lastMessage))
  return [...pinned, ...rest]
}

/** The default search: the title or the last message's text contains the query. */
export function matchesChatQuery (chat: ChatListItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle)
    return true
  return chat.title.toLowerCase().includes(needle) ||
    !!chat.lastMessage?.text?.toLowerCase().includes(needle)
}

/**
 * The time on a row: the time today, the weekday within a week, the day and month this year,
 * and the full date before that.
 */
export function formatChatListDate (date: Date | number, locale?: string): string {
  const value = locale ? dayjs(date).locale(locale) : dayjs(date)
  const now = dayjs()
  if (value.isSame(now, 'day'))
    return value.format('LT')
  if (now.diff(value, 'day') < 7)
    return value.format('ddd')
  if (value.isSame(now, 'year'))
    return value.format('MMM D')
  return value.format('L')
}

/** Initials: the first letters of the first two words. */
export function getInitials (title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
}

export interface ChatPreview {
  /** "You: " or "Anna: " in groups. */
  prefix?: string
  /** "Photo", "Voice message"... when the message has no text. */
  attachment?: string
  text: string
  /** A photo's thumbnail, drawn before the text. */
  thumbnail?: string
}

const firstName = (name?: string) => (name ?? '').split(' ')[0]

/** The second line of a row for its newest message. */
export function getChatPreview (chat: ChatListItem, labels: ChatLabels, user?: User): ChatPreview {
  const message = chat.lastMessage
  if (!message)
    return { text: '' }

  const isMine = user != null && message.user?._id === user._id
  const prefix = chat.kind === 'group' && !message.system
    ? `${isMine ? labels.chatListYou : firstName(message.user?.name)}: `
    : undefined

  const attachment = message.image
    ? labels.chatListPhoto
    : message.videoNote
      ? labels.videoMessage
      : message.video
        ? labels.video
        : message.audio
          ? labels.voiceMessage
          : message.file
            ? message.file.name || labels.chatListFile
            : message.location
              ? labels.location
              : undefined

  return {
    prefix,
    attachment: attachment && message.text ? undefined : attachment,
    text: message.text ? message.text.replace(/\s+/g, ' ') : '',
    thumbnail: message.image,
  }
}

/** "typing…", or "Anna is typing…" in a group. */
export function getTypingText (chat: ChatListItem, labels: ChatLabels): string | undefined {
  const typing = chat.typingUsers?.[0]
  if (!typing)
    return undefined
  return chat.kind === 'group'
    ? formatLabel(labels.chatListTypingName, { name: firstName(typing.name) })
    : labels.chatListTyping
}
