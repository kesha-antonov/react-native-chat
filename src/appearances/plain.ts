import { fromPalette } from './fromPalette'
import { avatarPaletteDay, avatarPaletteEndDay, avatarPaletteEndNight, avatarPaletteNight } from './shared'

/**
 * `plain`, the default: a quiet neutral background, white (dark grey at night) incoming bubbles
 * and solid accent-blue outgoing bubbles with white text. No wallpaper, no gradients.
 */

const BLUE = '#2B6FE6'

export const plainLight = fromPalette({
  isDark: false,
  accent: BLUE,
  onAccent: '#FFFFFF',
  background: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F5',
  listBackground: '#FFFFFF',
  text: '#111418',
  textSecondary: '#5F6671',
  textTertiary: '#8E959F',
  separator: 'rgba(17, 20, 24, 0.08)',

  incomingBubble: '#FFFFFF',
  incomingText: '#111418',
  incomingMeta: '#8E959F',
  incomingAccent: BLUE,
  incomingOnAccent: '#FFFFFF',
  outgoingBubble: BLUE,
  outgoingText: '#FFFFFF',
  outgoingMeta: 'rgba(255, 255, 255, 0.78)',
  outgoingAccent: '#FFFFFF',
  outgoingOnAccent: BLUE,
  incomingShadow: 'rgba(16, 24, 40, 0.1)',
  outgoingShadow: 'transparent',

  error: '#DC3545',
  online: '#2E9E5B',
  nameColors: ['#CF3F3F', '#C2650F', '#7451D6', '#2B8F52', '#1A8AA3', BLUE, '#BC3F82'],
  avatarPalette: avatarPaletteDay,
  avatarPaletteEnd: avatarPaletteEndDay,
}, { bubble: { hasTail: false } })

export const plainDark = fromPalette({
  isDark: true,
  accent: '#3B82F6',
  onAccent: '#FFFFFF',
  background: '#0F1115',
  surface: '#1B1E24',
  surfaceAlt: '#16191E',
  listBackground: '#0F1115',
  text: '#F2F4F7',
  textSecondary: '#A4ABB6',
  textTertiary: '#6E7681',
  separator: 'rgba(255, 255, 255, 0.08)',

  incomingBubble: '#22252B',
  incomingText: '#F2F4F7',
  incomingMeta: '#7D8590',
  incomingAccent: '#7DB0FF',
  incomingOnAccent: '#0F1115',
  outgoingBubble: BLUE,
  outgoingText: '#FFFFFF',
  outgoingMeta: 'rgba(255, 255, 255, 0.72)',
  outgoingAccent: '#FFFFFF',
  outgoingOnAccent: BLUE,
  incomingShadow: 'transparent',
  outgoingShadow: 'transparent',

  error: '#FF6369',
  online: '#3DD68C',
  nameColors: ['#FF8A8A', '#F5B064', '#A99BFF', '#6FD49A', '#5CC8DD', '#7DB0FF', '#F08CC0'],
  avatarPalette: avatarPaletteNight,
  avatarPaletteEnd: avatarPaletteEndNight,
}, { bubble: { hasTail: false } })
