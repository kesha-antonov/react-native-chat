import React from 'react'
import { ColorSchemeName, FlatListProps, StyleProp, ViewStyle } from 'react-native'
import { SharedValue } from 'react-native-reanimated'

import { TypingAction } from '../components/TypingStatus'
import { ChatLabels } from '../i18n'
import { ChatIcons } from '../Icons'
import { IMessage, User } from '../Models'
import { PartialChatTheme } from '../Theme'

/** What a chat is: a one-to-one chat, a group (its rows name the sender) or a channel. */
export type ChatListItemKind = 'private' | 'group' | 'channel'

/**
 * One chat in a `ChatList`: map your backend's conversations onto this. Everything but `id` and
 * `title` is optional, and each field turns on the part of the row that draws it.
 */
export interface ChatListItem {
  id: string | number
  title: string
  kind?: ChatListItemKind
  /** A photo URL; initials on a per-chat color otherwise. */
  avatar?: string
  /** The newest message: its preview, time and (when it is yours) its sent / read checks. */
  lastMessage?: IMessage
  unreadCount?: number
  isPinned?: boolean
  isMuted?: boolean
  isArchived?: boolean
  isVerified?: boolean
  /** The green dot on the avatar. */
  isOnline?: boolean
  /** An unsent draft, shown in place of the last message. */
  draft?: string
  /** Who is typing right now; shown in place of the last message. */
  typingUsers?: User[]
  /** What they are doing, when not typing: recording a note, sending media... */
  typingAction?: TypingAction
}

/** The props a custom `renderChat` receives: the built-in row's own. */
export interface ChatListCellProps<TChat extends ChatListItem = ChatListItem> {
  chat: TChat
  /** You, for "You:" and the checks on your own last message. */
  user?: User
  isSelected: boolean
  isSelectionMode: boolean
  onPress: (chat: TChat) => void
  onLongPress: (chat: TChat) => void
  /** Swipe towards the start edge to archive (or unarchive); omitted turns the swipe off. */
  onSwipe?: (chat: TChat) => void
  isLast?: boolean
  /** Set on a pinned chat when pinned chats can be reordered. */
  reorder?: ChatListReorder<TChat>
  /** Selecting with more than one chat pinned: pinned rows show a reorder handle. */
  isReordering?: boolean
  /** The row's time today (dayjs format); the locale's own by default. */
  timeFormat?: string
  /** The row's date before this week (dayjs format); the month name this year, the locale's date before. */
  dateFormat?: string
}

/** A pinned row's part in a drag. */
export interface ChatListReorder<TChat extends ChatListItem = ChatListItem> {
  index: number
  count: number
  drag: ChatListDrag
  onStart: (chat: TChat) => void
  onDrop: (chat: TChat, toIndex: number) => void
}

/** The drag in progress, shared by every pinned row (UI-thread values). */
export interface ChatListDrag {
  id: SharedValue<string>
  from: SharedValue<number>
  y: SharedValue<number>
  isActive: SharedValue<boolean>
}

export interface ChatListProps<TChat extends ChatListItem = ChatListItem> {
  /** Every chat, archived ones included. Sorted for you unless `isSortEnabled` is false. */
  chats: TChat[]
  /** You: "You:" in groups and the checks on your own last messages. */
  user?: User
  onPressChat?: (chat: TChat) => void
  /** Replaces the default long-press, which selects the chat. */
  onLongPressChat?: (chat: TChat) => void

  /** Pin / unpin from the selection bar. Pinned chats come first, in the order of `chats`. */
  onPinChats?: (chats: TChat[], isPinned: boolean) => void
  /** Mute / unmute from the selection bar. */
  onMuteChats?: (chats: TChat[], isMuted: boolean) => void
  /** Archive / unarchive from the selection bar and by swiping a row. */
  onArchiveChats?: (chats: TChat[], isArchived: boolean) => void
  /** Delete from the selection bar, after a confirmation (see `isDeleteConfirmed`). */
  onDeleteChats?: (chats: TChat[]) => void
  /** Turns on dragging pinned chats into a new order; called with the pinned ids in it. */
  onReorderPinnedChats?: (ids: TChat['id'][]) => void
  /** Shows the round new-chat button. */
  onPressNewChat?: () => void
  /** Ask before deleting. Default true. */
  isDeleteConfirmed?: boolean
  /** Swipe a row to archive it (needs `onArchiveChats`). Default true. */
  isSwipeEnabled?: boolean

  /** Shows the loading placeholder instead of the rows. */
  isLoading?: boolean
  /** Pinned first, in the order given, then the rest by their newest message. Default true. */
  isSortEnabled?: boolean

  /** The built-in header (title, search, selection actions). Default true. */
  isHeaderVisible?: boolean
  /** Header title. Default the `chatListTitle` label. */
  title?: string
  /** Extra header buttons, before the search button (or after it, see `headerRightPosition`). */
  renderHeaderRight?: () => React.ReactNode
  /** Where `renderHeaderRight` goes: 'beforeSearch' (default) or 'afterSearch', e.g. for a close button. */
  headerRightPosition?: 'beforeSearch' | 'afterSearch'
  /**
   * The rows' time today, as a dayjs format: 'HH:mm' for a 24-hour clock whatever the locale.
   * Default the locale's own ('LT').
   */
  timeFormat?: string
  /**
   * The rows' date for chats older than a week, as a dayjs format, e.g. 'DD.MM.YY' for digits only.
   * Default the month name this year ('MMM D') and the locale's date before ('L').
   */
  dateFormat?: string
  /** Pads the header below the status bar. Default true. */
  isTopInsetApplied?: boolean

  /** The header's search button. Default true. */
  isSearchEnabled?: boolean
  /** Which chats a query keeps. Default: the title or the last message contains it. */
  filterChat?: (chat: TChat, query: string) => boolean
  /** Called as the query changes (for a server-side search, also pass `filterChat={() => true}`). */
  onSearchChange?: (query: string | null) => void

  /** Shows the archived chats instead of the main list; controlled when set. */
  isArchiveOpen?: boolean
  onArchiveOpenChange?: (isOpen: boolean) => void

  /** Replaces a row; `ChatListCell` is the built-in one. */
  renderChat?: (props: ChatListCellProps<TChat>) => React.ReactNode
  /** Replaces the empty-list text. */
  renderEmpty?: (isSearching: boolean) => React.ReactNode
  /** Passed to the FlatList (e.g. `onEndReached` for paging, `refreshControl`). */
  listProps?: Partial<FlatListProps<TChat>>
  style?: StyleProp<ViewStyle>

  theme?: PartialChatTheme
  darkTheme?: PartialChatTheme
  colorScheme?: ColorSchemeName
  locale?: string
  labels?: Partial<ChatLabels>
  icons?: ChatIcons
}
