import { ImageSourcePropType } from 'react-native'

/**
 * Centralized design tokens for the chat UI.
 *
 * The defaults are a classic day theme (pale green outgoing bubbles over the green swirl
 * wallpaper) and a "Dark Blue" night theme (a purple-to-blue outgoing gradient fixed to the
 * screen). Consumers can override any subset through the `theme` /
 * `darkTheme` props on `Chat`; overrides are deep-merged over these defaults, and explicit
 * per-component style props still win over the theme. Components read the resolved theme via
 * the `useTheme` hook.
 */

export interface ChatThemeColors {
  /** Accent used for the send button, record button and active states. */
  accent: string
  /** Chat background, shown when the wallpaper is off (`theme.wallpaper.isEnabled`). */
  background: string
  /** Incoming (left) bubble background. */
  incomingBubble: string
  /**
   * Outgoing (right) bubble background. With `bubble.outgoingGradient` set, the gradient is
   * drawn instead and this is only the base color media controls are tinted with.
   */
  outgoingBubble: string
  /** Incoming message text. */
  incomingText: string
  /** Outgoing message text. */
  outgoingText: string
  /** Time/meta text inside incoming bubbles. */
  incomingMeta: string
  /** Time/meta text inside outgoing bubbles. */
  outgoingMeta: string
  /** Sender name color when `nameColors` is empty. */
  senderName: string
  /** Delivery tick color before the message is read. */
  ticksSent: string
  /** Delivery tick color once the message is read. */
  ticksRead: string
  /** Hairlines and dividers. */
  separator: string
  /** The floating composer pill (at 85%). */
  inputBackground: string
  /** The band behind the composer pill; transparent so the wallpaper shows through. */
  inputBarBackground: string
  /** Composer text color. */
  inputText: string
  /** Composer placeholder color. */
  placeholder: string
  /** Date and service pill background (stands in for a wallpaper-shaded pill). */
  dayPillBackground: string
  /** Date and service pill text. */
  dayPillText: string
  /** Surface color for floating elements (menus, sheets). */
  surface: string
  /** Neutral tint for secondary surfaces (location card, media card). */
  reactionBackground: string
  /** Active tint kept for custom reaction displays. */
  reactionActiveBackground: string
  /** Translucent overlay drawn on top of outgoing bubbles (location and media cards). */
  outgoingOverlay: string
  /** Errors: the failed-message badge, the recording trash can, destructive actions. */
  error: string
  /** Stroke around the composer pill and the glass buttons. */
  inputFieldBorder: string

  /** Links in incoming messages. */
  incomingLink: string
  /** Links in outgoing messages. */
  outgoingLink: string
  /** The 1px drop under incoming bubbles; transparent to turn it off. */
  incomingBubbleShadow: string
  /** The 1px drop under outgoing bubbles; transparent to turn it off. */
  outgoingBubbleShadow: string
  /** Incoming bubble tint while selected or flashed after a quote jump. */
  incomingBubbleSelected: string
  /** Outgoing bubble tint while selected or flashed after a quote jump. */
  outgoingBubbleSelected: string
  /** The band across a highlighted row. */
  selectionBackground: string
  /** Time pill over photos. */
  mediaTimeBackground: string
  /** Time and ticks on that pill. */
  mediaTimeText: string
  /** Reply quote line in incoming bubbles when `nameColors` is empty. */
  incomingReplyLine: string
  /** Reply quote name in incoming bubbles when `nameColors` is empty. */
  incomingReplyName: string
  /** Reply quote line in outgoing bubbles. */
  outgoingReplyLine: string
  /** Reply quote name in outgoing bubbles. */
  outgoingReplyName: string
  /** Reaction pill accent in incoming bubbles: solid when chosen, 15.6% when not. */
  incomingReaction: string
  /** Reaction count on an unchosen pill in incoming bubbles. */
  incomingReactionText: string
  /** Reaction count on a chosen pill in incoming bubbles. */
  incomingReactionTextChosen: string
  /** Reaction pill accent in outgoing bubbles. */
  outgoingReaction: string
  /** Reaction count on an unchosen pill in outgoing bubbles. */
  outgoingReactionText: string
  /** Reaction count on a chosen pill in outgoing bubbles. */
  outgoingReactionTextChosen: string
  /** Unplayed voice bars and audio track in incoming bubbles. */
  incomingVoiceTrack: string
  /** Played bars and the play button in incoming bubbles. */
  incomingVoiceFill: string
  /** Unplayed voice bars and audio track in outgoing bubbles. */
  outgoingVoiceTrack: string
  /** Played bars and the play button in outgoing bubbles. */
  outgoingVoiceFill: string
  /** Emoji and attach icons in the composer (`glass_defaultIcon`). */
  composerIcon: string
  /** Composer caret. */
  inputCursor: string
  /** Scroll-to-bottom glass circle. */
  scrollToBottomBackground: string
  /** Scroll-to-bottom chevron. */
  scrollToBottomIcon: string
  /** Unread counter on the scroll-to-bottom button. */
  scrollToBottomBadge: string
  /** Unread counter text. */
  scrollToBottomBadgeText: string
  /** The "Unread Messages" bar. */
  unreadSeparatorBackground: string
  /** Its label. */
  unreadSeparatorText: string
  /** Its arrow. */
  unreadSeparatorArrow: string
  /** A selected message's check circle in selection mode (`checkbox`). */
  selectionCheckbox: string
  /** The check mark and the empty circle's ring (`checkboxCheck`). */
  selectionCheckboxCheck: string
}

export interface ChatThemeAvatar {
  size: number
  /** Initials avatar colors, picked per user id; the top of the gradient. */
  palette: string[]
  /** Bottom of each initials gradient, matched to `palette` by index; empty draws flat colors. */
  paletteEnd: string[]
  /** Initials text color drawn on a palette background. */
  textColor: string
}

export interface ChatThemeRadii {
  bubble: number
  /** The tail-side corners of a bubble facing a grouped neighbour. */
  bubbleGrouped: number
  inputField: number
  sendButton: number
  reaction: number
  dayPill: number
  /** Photo corners inside a bubble. */
  media: number
  /** Photo corners next to other content (a name, a reply, a caption). */
  mediaInner: number
  /** The time pill over a photo. */
  mediaTimePill: number
  /** The reply quote box. */
  replyQuote: number
}

export interface ChatThemeHorizontalEdge {
  left: number
  right: number
}

export interface ChatThemeSpacing {
  /** Space above the first line of a bubble's text. */
  bubblePaddingV: number
  /** Space below the last line of a bubble's text. */
  bubblePaddingBottom: number
  bubblePaddingH: number
  withinGroup: number
  betweenGroups: number
  /** Horizontal inset applied to the input bar and its accessories (e.g. the reply preview). */
  screenEdge: ChatThemeHorizontalEdge
  /** Gap between the composer pill and the bottom of the chat. */
  inputToolbarPaddingV: number
}

/** Accepted shape for a `screenEdge` override: a single value for both sides, or either side individually. */
export type ChatThemeScreenEdgeOverride = number | Partial<ChatThemeHorizontalEdge>

export interface ChatThemeTextStyle {
  fontSize: number
  lineHeight?: number
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
}

export interface ChatThemeTypography {
  message: ChatThemeTextStyle
  time: ChatThemeTextStyle
  senderName: ChatThemeTextStyle
  day: ChatThemeTextStyle
  system: ChatThemeTextStyle
  /** Name in a reply quote. */
  replyName: ChatThemeTextStyle
  /** Text in a reply quote. */
  replyText: ChatThemeTextStyle
  /** Count on a reaction pill. */
  reactionCount: ChatThemeTextStyle
  /** Composer text. */
  composer: ChatThemeTextStyle
}

export interface ChatThemeComposer {
  /** Resting height of the composer field (single line). */
  minHeight: number
  /** Max height before the field scrolls internally instead of growing. */
  maxHeight: number
  /** Horizontal padding inside the field pill. */
  fieldPaddingH: number
  /** Size of the inset icons (emoji, attachment, camera). */
  insetIconSize: number
}

export interface ChatThemeVoice {
  /**
   * Full slide-to-cancel distance (px), capped at 35% of the window width.
   * Reaching it cancels the take mid-drag; releasing past 55% of
   * it cancels too.
   */
  cancelThreshold: number
  /** Vertical slide distance (px) to lock hands-free recording. */
  lockThreshold: number
}

export interface ChatThemeBubble {
  /** Draw a curled tail on the last bubble of each run. */
  hasTail: boolean
  /** Put the time on the last line of text when it fits; `false` gives it a row. */
  isTimeInline: boolean
  /**
   * Gradient stops for outgoing bubbles, top to bottom, or `null` for the solid
   * `colors.outgoingBubble`.
   */
  outgoingGradient: string[] | null
  /**
   * `'screen'`: one gradient spans the message list and each bubble shows its slice, so a
   * bubble changes color as it scrolls. `'bubble'`: every bubble carries the whole
   * gradient, which costs nothing while scrolling.
   */
  outgoingGradientMode: 'screen' | 'bubble'
  /**
   * Text column inset: a bubble's text is at most `min(width, height) - maxWidthInset` wide
   * (80 by default), and narrower by the avatar column when avatars show.
   */
  maxWidthInset: number
  /**
   * Big emoji: a message of at most this many emoji (and nothing else) drops its
   * bubble and draws them large. `0` turns it off.
   */
  bigEmojiMaxCount: number
  /** Font size of big emoji by count: index 0 for one emoji, the last entry for that many or more. */
  bigEmojiSizes: number[]
}

export interface ChatThemeWallpaper {
  /** Draw the wallpaper; off, the chat shows `colors.background`. */
  isEnabled: boolean
  /** Three or four colors for the swirl gradient. */
  colors: string[]
  /** Shift the gradient one step per outgoing message (500ms, bezier(0.33, 0, 0, 1)). */
  isAnimated: boolean
  /** An image tiled over the gradient, e.g. a doodle pattern; none is bundled. */
  pattern?: ImageSourcePropType | null
  /** Pattern opacity (0.34 day, 0.38 night). */
  patternOpacity: number
  /** Pattern tint; defaults to black over a light wallpaper and white over a dark one. */
  patternColor?: string
}

export interface ChatThemeEmojiKeyboard {
  /** Panel background. */
  background: string
  /** Tab icons. */
  icon: string
  /** The selected tab's icon. */
  iconSelected: string
  /** The round-rect behind the selected tab (the tab icon color at 18%). */
  tabIndicator: string
  /** Section headers ("Smileys & People"). */
  sectionTitle: string
  /** The search pill. */
  searchBackground: string
  /** Search icon and hint. */
  searchIcon: string
  /** Text typed into search. */
  searchText: string
  /** The backspace key. */
  backspace: string
  /** The hairline above the tab strip. */
  shadowLine: string
  /** The skin-tone popup (`dialogBackground`). */
  popupBackground: string
  /** The press highlight in the popup and on cells. */
  selector: string
  /** Panel height before any system keyboard has been seen (200). */
  defaultHeight: number
  /** Target width of a grid cell; the column count is `max(1, width / cellSize)` (45). */
  cellSize: number
  /** Emoji glyph size in a cell. */
  emojiSize: number
}

export interface ChatThemeContextMenu {
  /** Menu and reactions bar fill (`actionBarDefaultSubmenuBackground`). */
  background: string
  /** Item text (`actionBarDefaultSubmenuItem`). */
  text: string
  /** Item icons (`actionBarDefaultSubmenuItemIcon`). */
  icon: string
  /** The 8dp gap between item groups (`actionBarDefaultSubmenuSeparator`). */
  separator: string
  /** Pressed item (`dialogButtonSelector`). */
  pressed: string
  /** A `destructive` item (`text_RedRegular`). */
  destructive: string
  /** The dim over the chat while the menu is open (black at 0.2). */
  scrim: string
  /** The circle behind a reaction you already chose. */
  reactionSelected: string
}

/** `ChatList`: the list of chats. */
export interface ChatThemeChatList {
  background: string
  headerBackground: string
  /** Header title and icons. */
  headerText: string
  /** Chat names. */
  name: string
  /** The last message's text. */
  message: string
  /** "You:" / "Anna:" before a group's last message. */
  senderPrefix: string
  /** "Photo", "Voice message"... when the last message has no text. */
  attachment: string
  /** "typing…". */
  typing: string
  /** "Draft:". */
  draft: string
  /** The last message's time. */
  date: string
  /** Sent / read checks on your last message. */
  check: string
  /** Unread counter. */
  badge: string
  /** Unread counter of a muted chat. */
  badgeMuted: string
  badgeText: string
  muteIcon: string
  /** The pin and the reorder handle. */
  pinIcon: string
  verified: string
  /** The online dot on an avatar. */
  online: string
  divider: string
  /** A pressed row. */
  pressed: string
  /** A selected row. */
  selectedRow: string
  /** The selection check on an avatar. */
  checkbox: string
  /** Behind a row swiped to archive, and the circle that grows past the threshold. */
  swipeArchive: string
  swipeUnarchive: string
  /** The "Archived Chats" folder avatar. */
  archiveAvatar: string
  /** The new-chat button. */
  fab: string
  fabIcon: string
  /** The loading placeholder: its bars (and their opacity), and the band sweeping over them. */
  shimmer: string
  shimmerOpacity: number
  shimmerHighlight: string
}

export interface ChatThemeAttachments {
  /** Sheet background (`dialogBackground`). */
  background: string
  /** The dim behind the sheet (black at 51/255). */
  dim: string
  /** Titles and the caption text (`dialogTextBlack`). */
  text: string
  /** Secondary text: file sizes, hints, the caption placeholder. */
  secondaryText: string
  /** The drag handle. */
  handle: string
  /** The floating tab pill (`windowBackgroundWhite` at 0.85). */
  tabBackground: string
  /** Unselected tab icon and label (`glass_tabUnselected`). */
  tabText: string
  /** Selected tab icon, and its capsule at 9% (`glass_tabSelected`). */
  tabSelected: string
  /** Selected tab label. */
  tabSelectedText: string
  /** Selection disc. */
  checkbox: string
  /** Number / check on the disc. */
  checkboxCheck: string
  /** Empty photo cell. */
  cellBackground: string
  /** Send button (`dialogFloatingButton`). */
  sendButton: string
  /** Send button icon. */
  sendButtonIcon: string
}

export interface ChatTheme {
  colors: ChatThemeColors
  radii: ChatThemeRadii
  spacing: ChatThemeSpacing
  typography: ChatThemeTypography
  avatar: ChatThemeAvatar
  sendButton: { size: number }
  composer: ChatThemeComposer
  voice: ChatThemeVoice
  bubble: ChatThemeBubble
  wallpaper: ChatThemeWallpaper
  /** The built-in emoji keyboard. */
  emojiKeyboard: ChatThemeEmojiKeyboard
  /** The long-press menu and reactions bar. */
  contextMenu: ChatThemeContextMenu
  /** The built-in attachment menu. */
  attachments: ChatThemeAttachments
  /** The chat list (`ChatList`). */
  chatList: ChatThemeChatList
  /** Sender name colors, picked per user id (`avatar_nameInMessage*`); empty uses `colors.senderName`. */
  nameColors: string[]
}

export type PartialChatTheme = {
  colors?: Partial<ChatThemeColors>
  radii?: Partial<ChatThemeRadii>
  spacing?: Partial<Omit<ChatThemeSpacing, 'screenEdge'>> & { screenEdge?: ChatThemeScreenEdgeOverride }
  typography?: Partial<Record<keyof ChatThemeTypography, Partial<ChatThemeTextStyle>>>
  avatar?: Partial<ChatThemeAvatar>
  sendButton?: Partial<{ size: number }>
  composer?: Partial<ChatThemeComposer>
  voice?: Partial<ChatThemeVoice>
  bubble?: Partial<ChatThemeBubble>
  wallpaper?: Partial<ChatThemeWallpaper>
  emojiKeyboard?: Partial<ChatThemeEmojiKeyboard>
  contextMenu?: Partial<ChatThemeContextMenu>
  attachments?: Partial<ChatThemeAttachments>
  chatList?: Partial<ChatThemeChatList>
  nameColors?: string[]
}

// Avatars: a vertical gradient per color, `abs(id % 7)` -> red, orange, violet, green,
// cyan, blue, pink.
const avatarPaletteDay = ['#FF845E', '#FEBB5B', '#B694F9', '#9AD164', '#5BCBE3', '#5CAFFA', '#FF8AAC']
const avatarPaletteEndDay = ['#D45246', '#F68136', '#6C61DF', '#46BA43', '#359AD4', '#408ACF', '#D95574']
// Dark Blue overrides only red and orange.
const avatarPaletteNight = ['#E86C6A', '#F2BC64', '#B694F9', '#9AD164', '#5BCBE3', '#5CAFFA', '#FF8AAC']
const avatarPaletteEndNight = ['#E14747', '#E58943', '#6C61DF', '#46BA43', '#359AD4', '#408ACF', '#D95574']

const sharedRadii: ChatThemeRadii = {
  // 17, and `min(6, bubble)` near a grouped neighbour.
  bubble: 17,
  bubbleGrouped: 6,
  // The composer island.
  inputField: 22,
  sendButton: 18,
  // Reaction pills are full capsules: 26 tall, radius 13.
  reaction: 13,
  // Date / service pill radius.
  dayPill: 11,
  // Photos: `bubbleRadius - 2`, 4 next to other content.
  media: 15,
  mediaInner: 4,
  mediaTimePill: 8,
  replyQuote: 5,
}

const sharedComposer: ChatThemeComposer = {
  // One line at rest; the field grows to 6 lines of 21.
  minHeight: 44,
  maxHeight: 149,
  fieldPaddingH: 12,
  insetIconSize: 24,
}

// The slide-to-cancel distance (140dp, capped at 35% of the width) and the
// lock distance (57dp).
const sharedVoice: ChatThemeVoice = {
  cancelThreshold: 140,
  lockThreshold: 57,
}

const sharedSpacing: ChatThemeSpacing = {
  // 5 above the first line, 8.5 below the last, 9 either side.
  bubblePaddingV: 5,
  bubblePaddingBottom: 8.5,
  bubblePaddingH: 9,
  // 2 inside a run, 6 between runs.
  withinGroup: 2,
  betweenGroups: 6,
  // The composer island's 7 side margins and 9 above the bottom inset.
  screenEdge: { left: 7, right: 7 },
  inputToolbarPaddingV: 9,
}

const sharedTypography: ChatThemeTypography = {
  // 16 body, line spacing 1.0: Roboto's natural ~19.
  message: { fontSize: 16, lineHeight: 19, fontWeight: '400' },
  time: { fontSize: 12, lineHeight: 14, fontWeight: '400' },
  // `(2 * 16 + 10) / 3` = 14, Roboto Medium - the only emphasis weight.
  senderName: { fontSize: 14, lineHeight: 17, fontWeight: '500' },
  day: { fontSize: 14, lineHeight: 17, fontWeight: '500' },
  system: { fontSize: 14, lineHeight: 17, fontWeight: '500' },
  replyName: { fontSize: 14, lineHeight: 17, fontWeight: '500' },
  replyText: { fontSize: 14, lineHeight: 17, fontWeight: '400' },
  reactionCount: { fontSize: 12, fontWeight: '500' },
  // The input field is 18.
  composer: { fontSize: 18, lineHeight: 21, fontWeight: '400' },
}

const sharedBubble: Omit<ChatThemeBubble, 'outgoingGradient'> = {
  hasTail: true,
  isTimeInline: true,
  outgoingGradientMode: 'screen',
  maxWidthInset: 80,
  // Past a screenful a lone-emoji message stops being a
  // sticker-like moment and is just a lot of emoji, so the default stops at 20.
  bigEmojiMaxCount: 20,
  // `.34/.28/.22/.19 × 120dp`: plain emoji use the non-animated sizes, 1-2 emoji at [2],
  // 3 at [3], 4 at [4], 5+ at [5].
  bigEmojiSizes: [40.8, 40.8, 33.6, 26.4, 22.8],
}

// The emoji panel: 200 before any keyboard was measured, 45 per column, 32 glyphs.
const sharedEmojiKeyboardMetrics = { defaultHeight: 200, cellSize: 45, emojiSize: 30 }

export const defaultLightTheme: ChatTheme = {
  colors: {
    accent: '#229AF0',
    // The fallback when no wallpaper can be drawn.
    background: '#D6E4EF',
    incomingBubble: '#FFFFFF',
    outgoingBubble: '#EFFFDE',
    incomingText: '#000000',
    outgoingText: '#000000',
    incomingMeta: '#A1AAB3',
    outgoingMeta: '#70B15C',
    senderName: '#298ACF',
    ticksSent: '#5DB050',
    ticksRead: '#5DB050',
    separator: 'rgba(0, 0, 0, 0.08)',
    // #FFFFFF at 216/255.
    inputBackground: 'rgba(255, 255, 255, 0.847)',
    inputBarBackground: 'transparent',
    inputText: '#000000',
    placeholder: '#858A84',
    dayPillBackground: 'rgba(0, 0, 0, 0.18)',
    dayPillText: '#FFFFFF',
    surface: '#FFFFFF',
    reactionBackground: 'rgba(0, 0, 0, 0.06)',
    reactionActiveBackground: 'rgba(34, 154, 240, 0.15)',
    outgoingOverlay: 'rgba(110, 185, 105, 0.1)',
    error: '#DB3535',
    inputFieldBorder: '#FFFFFF',

    incomingLink: '#2678B6',
    outgoingLink: '#2678B6',
    incomingBubbleShadow: 'rgba(29, 55, 83, 0.16)',
    outgoingBubbleShadow: 'rgba(30, 117, 12, 0.16)',
    incomingBubbleSelected: '#ECF7FD',
    outgoingBubbleSelected: '#D9F7C5',
    selectionBackground: 'rgba(10, 144, 240, 0.157)',
    mediaTimeBackground: 'rgba(0, 0, 0, 0.4)',
    mediaTimeText: '#FFFFFF',
    incomingReplyLine: '#599FD8',
    incomingReplyName: '#298ACF',
    outgoingReplyLine: '#6EB969',
    outgoingReplyName: '#55AB4F',
    incomingReaction: '#229AF0',
    incomingReactionText: '#298ACF',
    incomingReactionTextChosen: '#FFFFFF',
    outgoingReaction: '#78C272',
    outgoingReactionText: '#55AB4F',
    outgoingReactionTextChosen: '#FFFFFF',
    incomingVoiceTrack: '#DEE5EB',
    incomingVoiceFill: '#229AF0',
    outgoingVoiceTrack: '#BBE3AC',
    outgoingVoiceFill: '#78C272',
    composerIcon: 'rgba(27, 34, 39, 0.6)',
    inputCursor: '#54A1DB',
    scrollToBottomBackground: 'rgba(255, 255, 255, 0.847)',
    scrollToBottomIcon: 'rgba(27, 34, 39, 0.6)',
    scrollToBottomBadge: '#229AF0',
    scrollToBottomBadgeText: '#FFFFFF',
    unreadSeparatorBackground: '#FFFFFF',
    unreadSeparatorText: '#5695CC',
    unreadSeparatorArrow: '#A2B5C7',
    selectionCheckbox: '#5EC245',
    selectionCheckboxCheck: '#FFFFFF',
  },
  radii: sharedRadii,
  spacing: sharedSpacing,
  typography: sharedTypography,
  avatar: { size: 42, palette: avatarPaletteDay, paletteEnd: avatarPaletteEndDay, textColor: '#FFFFFF' },
  sendButton: { size: 36 },
  composer: sharedComposer,
  voice: sharedVoice,
  bubble: { ...sharedBubble, outgoingGradient: null },
  wallpaper: {
    isEnabled: true,
    colors: ['#DBDDBB', '#6BA587', '#D5D88D', '#88B884'],
    isAnimated: true,
    pattern: null,
    patternOpacity: 0.34,
  },
  nameColors: ['#CC5049', '#D67722', '#955CDB', '#40A920', '#309EBA', '#368AD1', '#C7508B'],
  emojiKeyboard: {
    ...sharedEmojiKeyboardMetrics,
    background: '#F0F2F5',
    icon: '#9DA4AB',
    iconSelected: '#5E6976',
    tabIndicator: 'rgba(157, 164, 171, 0.18)',
    sectionTitle: '#828B94',
    searchBackground: '#E5E9EE',
    searchIcon: '#94A1AF',
    searchText: '#000000',
    backspace: '#8C9197',
    shadowLine: 'rgba(0, 0, 0, 0.07)',
    popupBackground: '#FFFFFF',
    selector: 'rgba(0, 0, 0, 0.06)',
  },
  contextMenu: {
    background: '#FFFFFF',
    text: '#1A1D21',
    icon: '#1A1D21',
    separator: '#F5F5F5',
    pressed: 'rgba(0, 0, 0, 0.06)',
    destructive: '#CC2929',
    scrim: 'rgba(0, 0, 0, 0.2)',
    reactionSelected: 'rgba(0, 0, 0, 0.06)',
  },
  chatList: {
    background: '#FFFFFF',
    headerBackground: '#FFFFFF',
    headerText: '#1A1D21',
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
    swipeArchive: '#229AF0',
    swipeUnarchive: '#9FAAB3',
    archiveAvatar: '#B8C2CC',
    fab: '#229AF0',
    fabIcon: '#FFFFFF',
    shimmer: '#000000',
    shimmerOpacity: 0.06,
    shimmerHighlight: '#FFFFFF',
  },
  attachments: {
    background: '#FFFFFF',
    dim: 'rgba(0, 0, 0, 0.2)',
    text: '#222222',
    secondaryText: '#8A8A8A',
    handle: 'rgba(0, 0, 0, 0.15)',
    tabBackground: 'rgba(255, 255, 255, 0.85)',
    tabText: '#1A1D21',
    tabSelected: '#1A91E6',
    tabSelectedText: '#0D7FCF',
    checkbox: '#229AF0',
    checkboxCheck: '#FFFFFF',
    cellBackground: 'rgba(0, 0, 0, 0.047)',
    sendButton: '#229AF0',
    sendButtonIcon: '#FFFFFF',
  },
}

export const defaultDarkTheme: ChatTheme = {
  colors: {
    accent: '#229AF0',
    background: '#0E141A',
    incomingBubble: '#232E3B',
    // The gradient's bottom stop; the bubble itself draws `bubble.outgoingGradient`.
    outgoingBubble: '#258DE5',
    incomingText: '#FAFAFA',
    outgoingText: '#FFFFFF',
    incomingMeta: 'rgba(128, 145, 160, 0.85)',
    outgoingMeta: '#FFFFFF',
    senderName: '#79C4FC',
    ticksSent: '#FFFFFF',
    ticksRead: '#FFFFFF',
    separator: 'rgba(255, 255, 255, 0.1)',
    inputBackground: 'rgba(33, 45, 59, 0.85)',
    inputBarBackground: 'transparent',
    inputText: '#FFFFFF',
    placeholder: 'rgba(219, 239, 255, 0.431)',
    dayPillBackground: 'rgba(53, 66, 81, 0.51)',
    dayPillText: '#FFFFFF',
    surface: '#212D3B',
    reactionBackground: 'rgba(255, 255, 255, 0.08)',
    reactionActiveBackground: 'rgba(96, 157, 210, 0.22)',
    outgoingOverlay: 'rgba(255, 255, 255, 0.12)',
    error: '#F6574E',
    inputFieldBorder: 'rgba(255, 255, 255, 0.157)',

    incomingLink: '#79C4FC',
    outgoingLink: '#FFFFFF',
    incomingBubbleShadow: 'rgba(0, 0, 0, 0.196)',
    outgoingBubbleShadow: 'transparent',
    incomingBubbleSelected: '#314A61',
    // Drawn over the gradient.
    outgoingBubbleSelected: 'rgba(255, 255, 255, 0.078)',
    selectionBackground: 'rgba(95, 157, 227, 0.165)',
    mediaTimeBackground: 'rgba(0, 0, 0, 0.4)',
    mediaTimeText: '#FFFFFF',
    incomingReplyLine: '#79C4FC',
    incomingReplyName: '#79C4FC',
    outgoingReplyLine: '#FFFFFF',
    outgoingReplyName: '#FFFFFF',
    incomingReaction: '#609DD2',
    incomingReactionText: '#FFFFFF',
    incomingReactionTextChosen: '#FFFFFF',
    outgoingReaction: '#FFFFFF',
    outgoingReactionText: '#FFFFFF',
    outgoingReactionTextChosen: '#1D2733',
    incomingVoiceTrack: '#5D6F80',
    incomingVoiceFill: '#64B5EF',
    outgoingVoiceTrack: 'rgba(255, 255, 255, 0.3)',
    outgoingVoiceFill: '#FFFFFF',
    composerIcon: 'rgba(255, 255, 255, 0.627)',
    inputCursor: '#54A1DB',
    scrollToBottomBackground: 'rgba(33, 45, 59, 0.85)',
    scrollToBottomIcon: 'rgba(255, 255, 255, 0.627)',
    scrollToBottomBadge: '#51AAEE',
    scrollToBottomBadgeText: '#FFFFFF',
    unreadSeparatorBackground: '#253442',
    unreadSeparatorText: 'rgba(255, 255, 255, 0.855)',
    unreadSeparatorArrow: '#5A6B7A',
    selectionCheckbox: '#5EC245',
    selectionCheckboxCheck: '#FFFFFF',
  },
  radii: sharedRadii,
  spacing: sharedSpacing,
  typography: sharedTypography,
  avatar: { size: 42, palette: avatarPaletteNight, paletteEnd: avatarPaletteEndNight, textColor: '#FFFFFF' },
  sendButton: { size: 36 },
  composer: sharedComposer,
  voice: sharedVoice,
  bubble: {
    ...sharedBubble,
    // Purple at the top of the list, blue at the bottom.
    outgoingGradient: ['#9F3EAA', '#8146D7', '#4272DF', '#258DE5'],
  },
  wallpaper: {
    isEnabled: true,
    colors: ['#0E141A', '#172431', '#0F171E', '#141C2B'],
    isAnimated: true,
    pattern: null,
    patternOpacity: 0.38,
  },
  nameColors: ['#E88878', '#E8AB5A', '#8C8DEA', '#7DD071', '#53CCC6', '#5CADEA', '#E8749A'],
  emojiKeyboard: {
    ...sharedEmojiKeyboardMetrics,
    background: '#1D2733',
    icon: '#677687',
    iconSelected: '#64B5EF',
    tabIndicator: 'rgba(103, 118, 135, 0.18)',
    sectionTitle: '#828B94',
    // Dark Blue leaves the search pill at the day color; in the chat's glass panel it is the
    // icon color at 6%, which is what reads right on the dark sheet.
    searchBackground: 'rgba(255, 255, 255, 0.06)',
    searchIcon: '#94A1AF',
    searchText: '#FFFFFF',
    backspace: '#677687',
    shadowLine: 'rgba(0, 0, 0, 0.196)',
    popupBackground: '#212D3B',
    selector: 'rgba(255, 255, 255, 0.08)',
  },
  contextMenu: {
    background: '#283848',
    text: '#FFFFFF',
    icon: '#FFFFFF',
    separator: '#1F2E3F',
    pressed: '#324156',
    destructive: '#EE686F',
    scrim: 'rgba(0, 0, 0, 0.2)',
    reactionSelected: 'rgba(255, 255, 255, 0.08)',
  },
  chatList: {
    background: '#1D2733',
    headerBackground: '#242D39',
    headerText: '#FFFFFF',
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
    pressed: 'rgba(255, 255, 255, 0.05)',
    selectedRow: 'rgba(95, 157, 227, 0.16)',
    checkbox: '#5EC245',
    swipeArchive: '#5796CC',
    swipeUnarchive: '#2E3E4B',
    archiveAvatar: '#384B5A',
    fab: '#229AF0',
    fabIcon: '#FFFFFF',
    shimmer: '#E6F7FF',
    shimmerOpacity: 0.08,
    shimmerHighlight: '#283848',
  },
  attachments: {
    background: '#212D3B',
    dim: 'rgba(0, 0, 0, 0.2)',
    text: '#FFFFFF',
    secondaryText: '#7D8B99',
    handle: 'rgba(255, 255, 255, 0.15)',
    tabBackground: 'rgba(29, 39, 51, 0.85)',
    tabText: '#FFFFFF',
    tabSelected: '#229AF0',
    tabSelectedText: '#229AF0',
    checkbox: '#229AF0',
    checkboxCheck: '#FFFFFF',
    cellBackground: 'rgba(255, 255, 255, 0.05)',
    sendButton: '#229AF0',
    sendButtonIcon: '#FFFFFF',
  },
}

export interface ChatThemeOverrides {
  light?: PartialChatTheme
  dark?: PartialChatTheme
}

/**
 * Resolve the active theme for a color scheme, applying the matching override.
 * Used by `Chat` to compute the theme once per change and share it via context.
 */
export function resolveTheme (
  colorScheme: 'light' | 'dark' | null | undefined,
  light?: PartialChatTheme,
  dark?: PartialChatTheme
): ChatTheme {
  const isDark = colorScheme === 'dark'
  return mergeTheme(isDark ? defaultDarkTheme : defaultLightTheme, isDark ? dark : light)
}

/** Deep-merge a partial theme over a base theme (two levels deep; arrays are replaced). */
export function mergeTheme (base: ChatTheme, override?: PartialChatTheme): ChatTheme {
  if (!override)
    return base

  const mergedTypography = { ...base.typography }
  if (override.typography)
    for (const key of Object.keys(override.typography) as Array<keyof ChatThemeTypography>)
      mergedTypography[key] = { ...base.typography[key], ...override.typography[key] }

  const overrideScreenEdge = override.spacing?.screenEdge
  const mergedScreenEdge: ChatThemeHorizontalEdge = typeof overrideScreenEdge === 'number'
    ? { left: overrideScreenEdge, right: overrideScreenEdge }
    : { ...base.spacing.screenEdge, ...overrideScreenEdge }

  // An app that picks its own outgoing color, sender color or avatar palette keeps seeing it:
  // the gradient, the per-user name colors and the avatar gradients would otherwise paint over
  // the override.
  const bubble = { ...base.bubble, ...override.bubble }
  if (override.colors?.outgoingBubble && override.bubble?.outgoingGradient === undefined)
    bubble.outgoingGradient = null

  const avatar = { ...base.avatar, ...override.avatar }
  if (override.avatar?.palette && override.avatar.paletteEnd === undefined)
    avatar.paletteEnd = []

  const nameColors = override.nameColors ??
    (override.colors?.senderName ? [] : base.nameColors)

  return {
    colors: { ...base.colors, ...override.colors },
    radii: { ...base.radii, ...override.radii },
    spacing: { ...base.spacing, ...override.spacing, screenEdge: mergedScreenEdge },
    typography: mergedTypography,
    avatar,
    sendButton: { ...base.sendButton, ...override.sendButton },
    composer: { ...base.composer, ...override.composer },
    voice: { ...base.voice, ...override.voice },
    bubble,
    wallpaper: { ...base.wallpaper, ...override.wallpaper },
    emojiKeyboard: { ...base.emojiKeyboard, ...override.emojiKeyboard },
    contextMenu: { ...base.contextMenu, ...override.contextMenu },
    attachments: { ...base.attachments, ...override.attachments },
    chatList: { ...base.chatList, ...override.chatList },
    nameColors,
  }
}

/** The per-user color index: `abs(id % 7)` for numeric ids, a stable hash for strings. */
export function getUserColorIndex (id: string | number | undefined, count: number): number {
  if (count <= 0 || id == null)
    return 0

  if (typeof id === 'number' && Number.isFinite(id))
    return Math.abs(Math.trunc(id) % count)

  const text = String(id)
  let hash = 0
  for (let i = 0; i < text.length; i += 1)
    hash = (hash * 31 + text.charCodeAt(i)) | 0

  return Math.abs(hash % count)
}

/** The sender name color for a user: their slot in `nameColors`, or `colors.senderName`. */
export function getNameColor (theme: ChatTheme, id: string | number | undefined): string {
  if (!theme.nameColors.length)
    return theme.colors.senderName

  return theme.nameColors[getUserColorIndex(id, theme.nameColors.length)]
}
