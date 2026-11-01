import { defaultDarkTheme, defaultLightTheme } from '@kesha-antonov/react-native-chat'

import { useColorScheme } from '@/hooks/use-color-scheme'

/**
 * The chat list colors for the day and night themes. Each line notes the color's role.
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

export const chatListColors: Record<'light' | 'dark', ChatListColors> = {
  light: {
    background: '#FFFFFF',
    headerBackground: '#FFFFFF',
    headerTitle: '#1A1D21',
    headerIcon: '#1A1D21',
    name: '#1A1D21',
    message: '#8E9091',
    senderPrefix: '#298ACF',
    attachment: '#298ACF',
    typing: '#298ACF',
    draft: '#DD4B39',
    date: '#848688',
    check: '#46AA36',
    badge: '#229AF0',
    badgeMuted: '#BEC3C7',
    badgeText: '#FFFFFF',
    muteIcon: '#BDC1C4',
    pinIcon: '#919294',
    verified: '#33A8E6',
    online: '#4BCB1C',
    divider: '#D9D9D9',
    pressed: 'rgba(0, 0, 0, 0.06)',
    selectedRow: 'rgba(10, 144, 240, 0.08)',
    checkbox: '#5EC245',
    archiveBackground: '#229AF0',
    archivePinBackground: '#9FAAB3',
    archiveAvatar: '#B8C2CC',
    savedAvatar: ['#69BDF9', '#409FE1'],
    fab: '#229AF0',
    subtitle: '#79817E',
    subtitleActive: '#298ACF',
    avatarPalette: defaultLightTheme.avatar.palette,
    avatarPaletteEnd: defaultLightTheme.avatar.paletteEnd,
  },
  dark: {
    background: '#1D2733',
    headerBackground: '#242D39',
    headerTitle: '#FFFFFF',
    headerIcon: '#FFFFFF',
    name: '#E9EEF4',
    message: '#7D8B99',
    senderPrefix: '#E9EEF4',
    attachment: '#7D8E98',
    typing: '#64AFE9',
    draft: 'rgba(252, 71, 74, 0.85)',
    date: '#737F8B',
    check: '#64B5EF',
    badge: '#64B5EF',
    badgeMuted: '#3E5263',
    badgeText: '#FFFFFF',
    muteIcon: '#4E5F6A',
    pinIcon: '#586D80',
    verified: '#64B5EF',
    online: '#64B5EF',
    divider: 'rgba(0, 0, 0, 0.58)',
    // The night `listSelector` is the day's 6% black, which is invisible on #1D2733; a 5% white
    // reads the same way.
    pressed: 'rgba(255, 255, 255, 0.05)',
    selectedRow: 'rgba(95, 157, 227, 0.16)',
    checkbox: '#5EC245',
    archiveBackground: '#5796CC',
    archivePinBackground: '#2E3E4B',
    archiveAvatar: '#384B5A',
    savedAvatar: ['#69BDF9', '#409FE1'],
    fab: '#229AF0',
    subtitle: 'rgba(219, 242, 255, 0.49)',
    subtitleActive: '#73BBF7',
    avatarPalette: defaultDarkTheme.avatar.palette,
    avatarPaletteEnd: defaultDarkTheme.avatar.paletteEnd,
  },
}

export function useChatListColors (): ChatListColors {
  return chatListColors[useColorScheme()]
}

/** The swipe-to-delete red, the same in both themes. */
export const SWIPE_DELETE_COLOR = '#E56555'
