import type {
  ChatThemeBubble,
  ChatThemeComposer,
  ChatThemeRadii,
  ChatThemeSpacing,
  ChatThemeTypography,
  ChatThemeVoice,
} from '../Theme'

/** Sizes, spacing and type every built-in appearance shares; only colors and a few shapes differ. */

// Avatars: a vertical gradient per color, `abs(id % 7)` -> red, orange, violet, green,
// cyan, blue, pink.
export const avatarPaletteDay = ['#FF845E', '#FEBB5B', '#B694F9', '#9AD164', '#5BCBE3', '#5CAFFA', '#FF8AAC']
export const avatarPaletteEndDay = ['#D45246', '#F68136', '#6C61DF', '#46BA43', '#359AD4', '#408ACF', '#D95574']
// Dark Blue overrides only red and orange.
export const avatarPaletteNight = ['#E86C6A', '#F2BC64', '#B694F9', '#9AD164', '#5BCBE3', '#5CAFFA', '#FF8AAC']
export const avatarPaletteEndNight = ['#E14747', '#E58943', '#6C61DF', '#46BA43', '#359AD4', '#408ACF', '#D95574']

export const sharedRadii: ChatThemeRadii = {
  // 17, and `min(6, bubble)` near a grouped neighbour.
  bubble: 17,
  bubbleGrouped: 6,
  // The composer island.
  inputField: 22,
  // The send / record circle: as tall as the island at one line, as in Telegram.
  sendButton: 22,
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

export const sharedComposer: ChatThemeComposer = {
  // One line at rest; the field grows to 6 lines of 21.
  minHeight: 44,
  maxHeight: 149,
  fieldPaddingH: 12,
  insetIconSize: 24,
}

// The slide-to-cancel distance (140dp, capped at 35% of the width) and the
// lock distance (57dp).
export const sharedVoice: ChatThemeVoice = {
  cancelThreshold: 140,
  lockThreshold: 57,
}

export const sharedSpacing: ChatThemeSpacing = {
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

export const sharedTypography: ChatThemeTypography = {
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

export const sharedBubble: Omit<ChatThemeBubble, 'outgoingGradient'> = {
  hasTail: true,
  isTimeInline: true,
  outgoingGradientMode: 'screen',
  maxWidthInset: 80,
  // Past a screenful a lone-emoji message stops being a
  // sticker-like moment and is just a lot of emoji, so the default stops at 20.
  bigEmojiMaxCount: 20,
  // `.34/.28/.22/.19 x 120dp`: plain emoji use the non-animated sizes, 1-2 emoji at [2],
  // 3 at [3], 4 at [4], 5+ at [5].
  bigEmojiSizes: [40.8, 40.8, 33.6, 26.4, 22.8],
}

// The emoji panel: 200 before any keyboard was measured, 45 per column, 32 glyphs.
export const sharedEmojiKeyboardMetrics = { defaultHeight: 200, cellSize: 45, emojiSize: 30 }
