import { fromPalette } from './fromPalette'

/**
 * `mono`: ink on paper. Black outgoing bubbles on white (reversed at night), light grey incoming,
 * grey avatars, square-ish corners, no tails or shadows. Links are underlined, since they share
 * the text's color.
 */

const GREYS_DAY = ['#8B9098', '#6F747D', '#A0A5AC', '#5E636C', '#7C818A', '#94999F', '#696E77']
const GREYS_NIGHT = ['#5E636C', '#4E535B', '#6C7179', '#454A52', '#575C64', '#63686F', '#4A4F57']
const SHAPE = {
  radii: { bubble: 12, bubbleGrouped: 4, media: 10, replyQuote: 4 },
  bubble: { hasTail: false },
}

export const monoLight = fromPalette({
  isDark: false,
  accent: '#16181D',
  onAccent: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  listBackground: '#FFFFFF',
  text: '#16181D',
  textSecondary: '#5B616B',
  textTertiary: '#8D929A',
  separator: 'rgba(22, 24, 29, 0.1)',

  incomingBubble: '#F1F2F4',
  incomingText: '#16181D',
  incomingMeta: '#7E838C',
  incomingAccent: '#16181D',
  incomingOnAccent: '#FFFFFF',
  outgoingBubble: '#16181D',
  outgoingText: '#FFFFFF',
  outgoingMeta: 'rgba(255, 255, 255, 0.62)',
  outgoingAccent: '#FFFFFF',
  outgoingOnAccent: '#16181D',
  incomingShadow: 'transparent',
  outgoingShadow: 'transparent',

  error: '#D93036',
  online: '#2E9E5B',
  nameColors: [],
  avatarPalette: GREYS_DAY,
  avatarPaletteEnd: [],
}, SHAPE)

export const monoDark = fromPalette({
  isDark: true,
  accent: '#F2F3F5',
  onAccent: '#0B0C0E',
  background: '#0B0C0E',
  surface: '#18191C',
  surfaceAlt: '#121316',
  listBackground: '#0B0C0E',
  text: '#F2F3F5',
  textSecondary: '#A1A6AE',
  textTertiary: '#6C7179',
  separator: 'rgba(255, 255, 255, 0.1)',

  incomingBubble: '#1C1D21',
  incomingText: '#F2F3F5',
  incomingMeta: '#80858E',
  incomingAccent: '#F2F3F5',
  incomingOnAccent: '#0B0C0E',
  outgoingBubble: '#F2F3F5',
  outgoingText: '#0B0C0E',
  outgoingMeta: 'rgba(11, 12, 14, 0.56)',
  outgoingAccent: '#0B0C0E',
  outgoingOnAccent: '#F2F3F5',
  incomingShadow: 'transparent',
  outgoingShadow: 'transparent',

  error: '#FF5C61',
  online: '#4CC38A',
  nameColors: [],
  avatarPalette: GREYS_NIGHT,
  avatarPaletteEnd: [],
}, SHAPE)
