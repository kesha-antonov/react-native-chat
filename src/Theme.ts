import { ImageSourcePropType } from 'react-native'

import { chatAppearances, DEFAULT_APPEARANCE, getAppearance } from './appearances'

/**
 * Centralized design tokens for the chat UI.
 *
 * The look starts from an appearance (`appearance` prop): `plain` by default, or `wallpaper`,
 * `mono`, `soft` (see `src/appearances`), each a complete light and dark theme. Consumers can
 * override any subset through the `theme` / `darkTheme` props on `Chat`; overrides are
 * deep-merged over the appearance, and explicit per-component style props still win over the
 * theme. Components read the resolved theme via the `useTheme` hook.
 */

export interface ChatThemeColors {
  /** Accent used for the send button, record button and active states. */
  accent: string
  /** Icons and text drawn on an accent fill: the send / record button, badges, check marks. */
  onAccent: string
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
  /** `ChatHeader`'s status line ("last seen", members). */
  headerSubtitle: string
  /** `ChatHeader`'s status line while it reads "online" or "typing". */
  headerSubtitleActive: string
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
  /**
   * The text size the user picked, as a multiplier of every size in `typography` (1 by default):
   * messages, times, names, day and service pills, quotes and the composer grow together.
   */
  textScale?: number
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
  /** Multiplies every size in `typography`; see `ChatTheme.textScale`. */
  textScale?: number
}

/** The built-in appearances. */
export type ChatAppearanceName = 'plain' | 'wallpaper' | 'mono' | 'soft'

/** A complete look: the theme for each color scheme. */
export interface ChatAppearance {
  light: ChatTheme
  dark: ChatTheme
}

/** The default appearance's day theme (`plain`). */
export const defaultLightTheme: ChatTheme = chatAppearances[DEFAULT_APPEARANCE].light
/** The default appearance's night theme (`plain`). */
export const defaultDarkTheme: ChatTheme = chatAppearances[DEFAULT_APPEARANCE].dark

export interface ChatThemeOverrides {
  light?: PartialChatTheme
  dark?: PartialChatTheme
}

/**
 * Resolve the active theme for a color scheme: the appearance's theme for it, with the matching
 * override merged on top. Used by `Chat` (and `ChatList`, `ChatHeader`) to compute the theme once
 * per change and share it via context.
 */
export function resolveTheme (
  colorScheme: 'light' | 'dark' | null | undefined,
  light?: PartialChatTheme,
  dark?: PartialChatTheme,
  appearance?: ChatAppearanceName | ChatAppearance
): ChatTheme {
  const isDark = colorScheme === 'dark'
  const base = getAppearance(appearance)
  return mergeTheme(isDark ? base.dark : base.light, isDark ? dark : light)
}

/** Deep-merge a partial theme over a base theme (two levels deep; arrays are replaced). */
export function mergeTheme (base: ChatTheme, override?: PartialChatTheme): ChatTheme {
  if (!override)
    return base

  const mergedTypography = { ...base.typography }
  if (override.typography)
    for (const key of Object.keys(override.typography) as Array<keyof ChatThemeTypography>)
      mergedTypography[key] = { ...base.typography[key], ...override.typography[key] }

  // The text size multiplies whatever sizes the merge ends with, the app's own included.
  const textScale = override.textScale ?? base.textScale ?? 1
  if (textScale !== (base.textScale ?? 1))
    for (const key of Object.keys(mergedTypography) as Array<keyof ChatThemeTypography>) {
      const style = mergedTypography[key]
      mergedTypography[key] = {
        ...style,
        fontSize: style.fontSize * textScale,
        lineHeight: style.lineHeight != null ? style.lineHeight * textScale : undefined,
      }
    }

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
    textScale,
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
