import { useMemo } from 'react'
import { chatAppearances, ChatTheme } from '@kesha-antonov/react-native-chat'

import { useAppearance } from '@/components/appearance'
import { useColorScheme } from '@/hooks/use-color-scheme'

/**
 * The chat list screens' colors. Each line notes the color's role.
 */
export interface ChatListColors {
  background: string // windowBackgroundWhite
  headerBackground: string // actionBarDefault
  headerTitle: string // actionBarDefaultIcon / chats_name
  headerIcon: string
  name: string // chats_name
  message: string // chats_message_threeLines
  senderPrefix: string // chats_nameMessage
  attachment: string // chats_attachMessage
  typing: string // chats_actionMessage
  draft: string // chats_draft
  date: string // chats_date
  check: string // chats_sentCheck / chats_sentReadCheck
  badge: string // chats_unreadCounter
  badgeMuted: string // chats_unreadCounterMuted
  badgeText: string // chats_unreadCounterText
  muteIcon: string // chats_muteIcon
  pinIcon: string // chats_pinnedIcon
  verified: string // chats_verifiedBackground
  online: string // chats_onlineCircle
  divider: string // divider
  pressed: string // listSelector
  selectedRow: string
  checkbox: string // checkbox
  archiveBackground: string // chats_archiveBackground
  archivePinBackground: string // chats_archivePinBackground
  archiveAvatar: string // avatar_backgroundArchived
  savedAvatar: [string, string] // avatar_backgroundSaved -> avatar_background2Saved
  fab: string // featuredStickers_addButton
  subtitle: string // actionBarDefaultSubtitle (header "last seen")
  subtitleActive: string // chat header "online" / "typing"
  avatarPalette: string[]
  avatarPaletteEnd: string[]
}

// Saved Messages keeps its blue whatever the appearance, as a fixed identity.
const SAVED_AVATAR: [string, string] = ['#69BDF9', '#409FE1']

/** The screens' colors for a theme: the library's `chatList` tokens, under the names used here. */
export function chatListColorsFor (theme: ChatTheme): ChatListColors {
  const c = theme.chatList
  return {
    background: c.background,
    headerBackground: c.headerBackground,
    headerTitle: c.headerText,
    headerIcon: c.headerText,
    name: c.name,
    message: c.message,
    senderPrefix: c.senderPrefix,
    attachment: c.attachment,
    typing: c.typing,
    draft: c.draft,
    date: c.date,
    check: c.check,
    badge: c.badge,
    badgeMuted: c.badgeMuted,
    badgeText: c.badgeText,
    muteIcon: c.muteIcon,
    pinIcon: c.pinIcon,
    verified: c.verified,
    online: c.online,
    divider: c.divider,
    pressed: c.pressed,
    selectedRow: c.selectedRow,
    checkbox: c.checkbox,
    archiveBackground: c.swipeArchive,
    archivePinBackground: c.swipeUnarchive,
    archiveAvatar: c.archiveAvatar,
    savedAvatar: SAVED_AVATAR,
    fab: c.fab,
    subtitle: c.headerSubtitle,
    subtitleActive: c.headerSubtitleActive,
    avatarPalette: theme.avatar.palette,
    avatarPaletteEnd: theme.avatar.paletteEnd,
  }
}

/** The colors of the appearance picked in the Explore tab, for the current color scheme. */
export function useChatListColors (): ChatListColors {
  const scheme = useColorScheme()
  const appearance = useAppearance()
  return useMemo(() => chatListColorsFor(chatAppearances[appearance][scheme]), [appearance, scheme])
}

/** The swipe-to-delete red, the same in both themes. */
export const SWIPE_DELETE_COLOR = '#E56555'
