import { memo } from 'react'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import '../dayjsLocales'
import { ChatWrapper } from './ChatWrapper'

dayjs.extend(localizedFormat)

/**
 * The chat, skipped when its props compare equal: a screen around it re-renders for many reasons
 * (unread counts, connection state, its own scroll position) that leave the chat's props alone,
 * and each of those used to render the whole conversation again. Stable callbacks and memoized
 * objects in the props are what make the comparison hold.
 */
const Chat = Object.assign(memo(ChatWrapper), {
  append: ChatWrapper.append,
  prepend: ChatWrapper.prepend,
  toggleReaction: ChatWrapper.toggleReaction,
}) as unknown as typeof ChatWrapper

export {
  Chat
}
export type { ChatHandle, ChatProps } from './types'
