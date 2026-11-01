import { IMessage } from '@kesha-antonov/react-native-chat'
import dayjs from 'dayjs'

import { Dialog, ME } from './data'

/**
 * The chat list's date, as `DialogCell` formats it (`LocaleController.stringForMessageListDate`):
 * the time today (in the locale's clock, as the bubbles show it), the weekday within a week, the day and month this year, the full date before.
 */
export function formatListDate (date: Date | number): string {
  const value = dayjs(date)
  const now = dayjs()
  if (value.isSame(now, 'day'))
    return value.format('LT')
  if (now.diff(value, 'day') < 7)
    return value.format('ddd')
  if (value.isSame(now, 'year'))
    return value.format('MMM D')
  return value.format('DD.MM.YY')
}

export interface Preview {
  /** "You: " or "Sofia: " in groups (`DialogCell`'s inline sender prefix). */
  prefix?: string
  /** The media label ("Photo", "Voice message"...), in `chats_attachMessage` color. */
  attachment?: string
  text: string
  thumbnail?: string
}

const firstName = (name?: string) => (name ?? '').split(' ')[0]

/** `DialogCell`'s preview line for a dialog's newest message. */
export function getPreview (dialog: Dialog, message?: IMessage): Preview {
  if (!message)
    return { text: '' }

  const isGroup = dialog.kind === 'group'
  const prefix = isGroup
    ? message.user._id === ME._id ? 'You: ' : `${firstName(message.user.name)}: `
    : undefined

  // The media type, then the caption after a comma-less space.
  const attachment = message.image
    ? 'Photo'
    : message.videoNote
      ? 'Video message'
      : message.video
        ? 'Video'
        : message.audio
          ? 'Voice message'
          : message.file
            ? message.file.name
            : message.location
              ? 'Location'
              : undefined

  return {
    prefix,
    attachment: attachment && message.text ? undefined : attachment,
    text: message.text ? message.text.replace(/\s+/g, ' ') : '',
    thumbnail: message.image,
  }
}

export function formatSubscribers (count: number): string {
  return `${count.toLocaleString('en-US')} subscribers`
}
