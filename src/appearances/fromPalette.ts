import { mixColors, withAlpha } from '../colorUtils'
import type { ChatTheme, ChatThemeBubble, ChatThemeRadii } from '../Theme'
import {
  sharedBubble,
  sharedComposer,
  sharedEmojiKeyboardMetrics,
  sharedRadii,
  sharedSpacing,
  sharedTypography,
  sharedVoice,
} from './shared'

/**
 * The few colors an appearance is designed from; every token of a full theme is derived from
 * them, so the reply line, reactions, voice bars, menus, sheets and the chat list all agree.
 */
export interface AppearancePalette {
  isDark: boolean
  /** Buttons, badges, the caret, links outside bubbles. */
  accent: string
  /** Icons and text on an accent fill. */
  onAccent: string
  /** The chat behind the messages. */
  background: string
  /** Floating surfaces: the composer field, menus, sheets, the scroll button. */
  surface: string
  /** Panels a step away from `surface`: the emoji keyboard, menu group gaps. */
  surfaceAlt: string
  /** The chat list and its header. */
  listBackground: string
  /** Primary text outside bubbles. */
  text: string
  /** Secondary text: previews, subtitles, section titles. */
  textSecondary: string
  /** Icons, placeholders, timestamps outside bubbles. */
  textTertiary: string
  separator: string

  incomingBubble: string
  incomingText: string
  incomingMeta: string
  /** Links, the reply line, reaction pills and voice bars in incoming bubbles. */
  incomingAccent: string
  /** Text on a chosen incoming reaction pill. */
  incomingOnAccent: string
  outgoingBubble: string
  outgoingText: string
  outgoingMeta: string
  /** Links, the reply line, reaction pills, voice bars and read ticks in outgoing bubbles. */
  outgoingAccent: string
  /** Text on a chosen outgoing reaction pill. */
  outgoingOnAccent: string
  incomingShadow: string
  outgoingShadow: string

  error: string
  /** The online dot. */
  online: string
  nameColors: string[]
  avatarPalette: string[]
  /** Bottom of each avatar gradient; empty draws flat avatars. */
  avatarPaletteEnd: string[]
}

export interface AppearanceShape {
  radii?: Partial<ChatThemeRadii>
  bubble?: Partial<Omit<ChatThemeBubble, 'outgoingGradient'>>
}

/** A complete theme from a palette, on the shared sizes, with no wallpaper and solid bubbles. */
export const fromPalette = (p: AppearancePalette, shape: AppearanceShape = {}): ChatTheme => {
  const hover = withAlpha(p.text, p.isDark ? 0.08 : 0.06)
  return {
    colors: {
      accent: p.accent,
      onAccent: p.onAccent,
      background: p.background,
      incomingBubble: p.incomingBubble,
      outgoingBubble: p.outgoingBubble,
      incomingText: p.incomingText,
      outgoingText: p.outgoingText,
      incomingMeta: p.incomingMeta,
      outgoingMeta: p.outgoingMeta,
      senderName: p.incomingAccent,
      ticksSent: p.outgoingMeta,
      ticksRead: p.outgoingAccent,
      separator: p.separator,
      inputBackground: p.surface,
      inputBarBackground: 'transparent',
      inputText: p.text,
      placeholder: p.textTertiary,
      // Readable over the plain background and over a bubble the floating date passes.
      dayPillBackground: withAlpha(p.surface, 0.92),
      dayPillText: p.textSecondary,
      surface: p.surface,
      reactionBackground: hover,
      reactionActiveBackground: withAlpha(p.accent, 0.15),
      outgoingOverlay: withAlpha(p.outgoingText, 0.12),
      error: p.error,
      inputFieldBorder: p.separator,

      incomingLink: p.incomingAccent,
      outgoingLink: p.outgoingAccent,
      incomingBubbleShadow: p.incomingShadow,
      outgoingBubbleShadow: p.outgoingShadow,
      incomingBubbleSelected: mixColors(p.incomingBubble, p.incomingAccent, 0.1),
      outgoingBubbleSelected: mixColors(p.outgoingBubble, p.outgoingText, 0.12),
      selectionBackground: withAlpha(p.accent, 0.12),
      mediaTimeBackground: 'rgba(0, 0, 0, 0.4)',
      mediaTimeText: '#FFFFFF',
      incomingReplyLine: p.incomingAccent,
      incomingReplyName: p.incomingAccent,
      outgoingReplyLine: p.outgoingAccent,
      outgoingReplyName: p.outgoingAccent,
      incomingReaction: p.incomingAccent,
      incomingReactionText: p.incomingAccent,
      incomingReactionTextChosen: p.incomingOnAccent,
      outgoingReaction: p.outgoingAccent,
      outgoingReactionText: p.outgoingAccent,
      outgoingReactionTextChosen: p.outgoingOnAccent,
      incomingVoiceTrack: withAlpha(p.incomingAccent, 0.28),
      incomingVoiceFill: p.incomingAccent,
      outgoingVoiceTrack: withAlpha(p.outgoingAccent, 0.38),
      outgoingVoiceFill: p.outgoingAccent,
      composerIcon: p.textTertiary,
      inputCursor: p.accent,
      scrollToBottomBackground: p.surface,
      scrollToBottomIcon: p.textSecondary,
      scrollToBottomBadge: p.accent,
      scrollToBottomBadgeText: p.onAccent,
      unreadSeparatorBackground: withAlpha(p.surface, 0.92),
      unreadSeparatorText: p.textSecondary,
      unreadSeparatorArrow: p.textTertiary,
      selectionCheckbox: p.accent,
      selectionCheckboxCheck: p.onAccent,
    },
    radii: { ...sharedRadii, ...shape.radii },
    spacing: sharedSpacing,
    typography: sharedTypography,
    avatar: { size: 42, palette: p.avatarPalette, paletteEnd: p.avatarPaletteEnd, textColor: '#FFFFFF' },
    sendButton: { size: 44 },
    composer: sharedComposer,
    voice: sharedVoice,
    bubble: { ...sharedBubble, ...shape.bubble, outgoingGradient: null },
    wallpaper: {
      isEnabled: false,
      colors: [p.background, p.background, p.background, p.background],
      isAnimated: false,
      pattern: null,
      patternOpacity: 0,
    },
    nameColors: p.nameColors,
    emojiKeyboard: {
      ...sharedEmojiKeyboardMetrics,
      background: p.surfaceAlt,
      icon: p.textTertiary,
      iconSelected: p.textSecondary,
      tabIndicator: withAlpha(p.textTertiary, 0.18),
      sectionTitle: p.textSecondary,
      searchBackground: hover,
      searchIcon: p.textTertiary,
      searchText: p.text,
      backspace: p.textTertiary,
      shadowLine: p.separator,
      popupBackground: p.surface,
      selector: hover,
    },
    contextMenu: {
      background: p.surface,
      text: p.text,
      icon: p.text,
      separator: p.surfaceAlt,
      pressed: hover,
      destructive: p.error,
      scrim: p.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
      reactionSelected: hover,
    },
    chatList: {
      background: p.listBackground,
      headerBackground: p.listBackground,
      headerText: p.text,
      headerSubtitle: p.textSecondary,
      headerSubtitleActive: p.accent,
      name: p.text,
      message: p.textSecondary,
      senderPrefix: p.text,
      attachment: p.accent,
      typing: p.accent,
      draft: p.error,
      date: p.textTertiary,
      check: p.accent,
      badge: p.accent,
      badgeMuted: p.textTertiary,
      badgeText: p.onAccent,
      muteIcon: p.textTertiary,
      pinIcon: p.textTertiary,
      verified: p.accent,
      online: p.online,
      divider: p.separator,
      pressed: withAlpha(p.text, 0.05),
      selectedRow: withAlpha(p.accent, 0.08),
      checkbox: p.accent,
      swipeArchive: p.accent,
      swipeUnarchive: p.textTertiary,
      archiveAvatar: p.textTertiary,
      fab: p.accent,
      fabIcon: p.onAccent,
      shimmer: p.text,
      shimmerOpacity: p.isDark ? 0.08 : 0.06,
      shimmerHighlight: p.surface,
    },
    attachments: {
      background: p.surface,
      dim: p.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
      text: p.text,
      secondaryText: p.textSecondary,
      handle: withAlpha(p.text, 0.15),
      tabBackground: withAlpha(p.surface, 0.85),
      tabText: p.text,
      tabSelected: p.accent,
      tabSelectedText: p.accent,
      checkbox: p.accent,
      checkboxCheck: p.onAccent,
      cellBackground: withAlpha(p.text, 0.05),
      sendButton: p.accent,
      sendButtonIcon: p.onAccent,
    },
  }
}
