import { fromPalette } from './fromPalette'
import { avatarPaletteDay, avatarPaletteEndDay, avatarPaletteEndNight, avatarPaletteNight } from './shared'

/**
 * `soft`: friendly and rounded. A faint violet background, lavender outgoing bubbles with dark
 * text, white incoming, 20pt corners and no tails; deep plum at night.
 */

const SHAPE = {
  radii: { bubble: 20, bubbleGrouped: 8, media: 18, mediaInner: 6, replyQuote: 8 },
  bubble: { hasTail: false },
}

export const softLight = fromPalette({
  isDark: false,
  accent: '#7357F6',
  onAccent: '#FFFFFF',
  background: '#F5F2FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEAFB',
  listBackground: '#FFFFFF',
  text: '#1F1A2E',
  textSecondary: '#655E7A',
  textTertiary: '#9A93AE',
  separator: 'rgba(31, 26, 46, 0.08)',

  incomingBubble: '#FFFFFF',
  incomingText: '#1F1A2E',
  incomingMeta: '#9A93AE',
  incomingAccent: '#6A4CF0',
  incomingOnAccent: '#FFFFFF',
  outgoingBubble: '#E7DFFF',
  outgoingText: '#1F1A2E',
  outgoingMeta: '#7C70A8',
  outgoingAccent: '#5B3CE0',
  outgoingOnAccent: '#FFFFFF',
  incomingShadow: 'rgba(76, 54, 160, 0.08)',
  outgoingShadow: 'transparent',

  error: '#DC3545',
  online: '#2E9E5B',
  nameColors: ['#CC3F55', '#BF6A12', '#6A4CF0', '#2B8F5E', '#16879C', '#4A62E3', '#BB4189'],
  avatarPalette: avatarPaletteDay,
  avatarPaletteEnd: avatarPaletteEndDay,
}, SHAPE)

export const softDark = fromPalette({
  isDark: true,
  accent: '#8467FF',
  onAccent: '#FFFFFF',
  background: '#14111C',
  surface: '#201B2C',
  surfaceAlt: '#1A1624',
  listBackground: '#14111C',
  text: '#F1EEF8',
  textSecondary: '#ABA3BF',
  textTertiary: '#736C89',
  separator: 'rgba(255, 255, 255, 0.08)',

  incomingBubble: '#231E31',
  incomingText: '#F1EEF8',
  incomingMeta: '#857D9E',
  incomingAccent: '#B4A3FF',
  incomingOnAccent: '#14111C',
  outgoingBubble: '#3A2F66',
  outgoingText: '#F4F1FF',
  outgoingMeta: 'rgba(244, 241, 255, 0.62)',
  outgoingAccent: '#CBBEFF',
  outgoingOnAccent: '#2A2050',
  incomingShadow: 'transparent',
  outgoingShadow: 'transparent',

  error: '#FF6B70',
  online: '#4CC38A',
  nameColors: ['#FF8E9E', '#F5B26B', '#B4A3FF', '#72D3A0', '#62C9DB', '#93A6FF', '#F28DC8'],
  avatarPalette: avatarPaletteNight,
  avatarPaletteEnd: avatarPaletteEndNight,
}, SHAPE)
