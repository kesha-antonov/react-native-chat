/**
 * Centralized design tokens for the chat UI.
 *
 * The defaults below produce a modern, Telegram-inspired look (azure accent,
 * soft 18px bubbles, rounded composer, inline time + vector ticks). Consumers
 * can override any subset through the `theme` / `darkTheme` props on `Chat`;
 * overrides are deep-merged over these defaults, and explicit per-component
 * style props still win over the theme. Components read the resolved theme via
 * the `useTheme` hook.
 */

export interface ChatThemeColors {
  /** Accent used for the send button, links, read ticks and active states. */
  accent: string
  /** Chat list background. Lets white incoming bubbles read on light themes. */
  background: string
  /** Incoming (left) bubble background. */
  incomingBubble: string
  /** Outgoing (right) bubble background. */
  outgoingBubble: string
  /** Incoming message text. */
  incomingText: string
  /** Outgoing message text. */
  outgoingText: string
  /** Time/meta text inside incoming bubbles. */
  incomingMeta: string
  /** Time/meta text inside outgoing bubbles. */
  outgoingMeta: string
  /** Sender name shown above grouped incoming messages. */
  senderName: string
  /** Delivery tick color before the message is read. */
  ticksSent: string
  /** Delivery tick color once the message is read. */
  ticksRead: string
  /** Hairlines and dividers. */
  separator: string
  /** Background of the rounded composer field. */
  inputBackground: string
  /** Background of the whole input bar surrounding the field. */
  inputBarBackground: string
  /** Composer text color. */
  inputText: string
  /** Composer placeholder color. */
  placeholder: string
  /** Translucent day-separator pill background. */
  dayPillBackground: string
  /** Day-separator pill text. */
  dayPillText: string
  /** Surface color for floating elements (scroll-to-bottom button, picker). */
  surface: string
  /** Inactive reaction pill background. */
  reactionBackground: string
  /** Active (selected) reaction pill background. */
  reactionActiveBackground: string
  /** Translucent overlay drawn on top of outgoing bubbles (e.g. reply quotes). */
  outgoingOverlay: string
  /** Error / "not implemented" placeholder text. */
  error: string
  /** Optional border around the composer field (default transparent). */
  inputFieldBorder: string
}

export interface ChatThemeAvatar {
  size: number
  /** Background palette for initials avatars, picked deterministically per user. */
  palette: string[]
  /** Initials text color drawn on a palette background. */
  textColor: string
}

export interface ChatThemeRadii {
  bubble: number
  bubbleGrouped: number
  inputField: number
  sendButton: number
  reaction: number
  dayPill: number
}

export interface ChatThemeSpacing {
  bubblePaddingV: number
  bubblePaddingH: number
  withinGroup: number
  betweenGroups: number
  screenEdge: number
}

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
  /** Horizontal slide distance (px) to cancel a recording. */
  cancelThreshold: number
  /** Vertical slide distance (px) to lock hands-free recording. */
  lockThreshold: number
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
}

export type PartialChatTheme = {
  colors?: Partial<ChatThemeColors>
  radii?: Partial<ChatThemeRadii>
  spacing?: Partial<ChatThemeSpacing>
  typography?: Partial<Record<keyof ChatThemeTypography, Partial<ChatThemeTextStyle>>>
  avatar?: Partial<ChatThemeAvatar>
  sendButton?: Partial<{ size: number }>
  composer?: Partial<ChatThemeComposer>
  voice?: Partial<ChatThemeVoice>
}

// Decorative palette for initials avatars (flatuicolors.com), shared by themes.
const avatarPalette = ['#E67E22', '#2ECC71', '#3498DB', '#8E44AD', '#E74C3C', '#1ABC9C', '#2C3E50']

const sharedRadii: ChatThemeRadii = {
  bubble: 18,
  bubbleGrouped: 6,
  inputField: 18,
  sendButton: 18,
  reaction: 14,
  dayPill: 14,
}

const sharedComposer: ChatThemeComposer = {
  minHeight: 44,
  maxHeight: 120,
  fieldPaddingH: 12,
  insetIconSize: 24,
}

const sharedVoice: ChatThemeVoice = {
  cancelThreshold: 80,
  lockThreshold: 90,
}

const sharedSpacing: ChatThemeSpacing = {
  bubblePaddingV: 6,
  bubblePaddingH: 12,
  withinGroup: 2,
  betweenGroups: 8,
  screenEdge: 8,
}

const sharedTypography: ChatThemeTypography = {
  message: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  time: { fontSize: 12, fontWeight: '400' },
  senderName: { fontSize: 13, fontWeight: '600' },
  day: { fontSize: 13, fontWeight: '600' },
  system: { fontSize: 13, fontWeight: '400' },
}

export const defaultLightTheme: ChatTheme = {
  colors: {
    accent: '#3390EC',
    background: '#EFEFF4',
    incomingBubble: '#FFFFFF',
    outgoingBubble: '#3390EC',
    incomingText: '#000000',
    outgoingText: '#FFFFFF',
    incomingMeta: '#8E8E93',
    outgoingMeta: 'rgba(255, 255, 255, 0.7)',
    senderName: '#3390EC',
    ticksSent: 'rgba(255, 255, 255, 0.6)',
    ticksRead: '#FFFFFF',
    separator: 'rgba(0, 0, 0, 0.08)',
    inputBackground: '#F2F2F7',
    inputBarBackground: '#FFFFFF',
    inputText: '#000000',
    placeholder: '#8E8E93',
    dayPillBackground: 'rgba(0, 0, 0, 0.3)',
    dayPillText: '#FFFFFF',
    surface: '#FFFFFF',
    reactionBackground: 'rgba(0, 0, 0, 0.06)',
    reactionActiveBackground: 'rgba(51, 144, 236, 0.15)',
    outgoingOverlay: 'rgba(255, 255, 255, 0.15)',
    error: '#E74C3C',
    inputFieldBorder: 'transparent',
  },
  radii: sharedRadii,
  spacing: sharedSpacing,
  typography: sharedTypography,
  avatar: { size: 34, palette: avatarPalette, textColor: '#FFFFFF' },
  sendButton: { size: 36 },
  composer: sharedComposer,
  voice: sharedVoice,
}

export const defaultDarkTheme: ChatTheme = {
  colors: {
    accent: '#3390EC',
    background: '#0E1621',
    incomingBubble: '#182533',
    outgoingBubble: '#2B5278',
    incomingText: '#FFFFFF',
    outgoingText: '#FFFFFF',
    incomingMeta: '#6D7F8F',
    outgoingMeta: 'rgba(255, 255, 255, 0.55)',
    senderName: '#6FB2F0',
    ticksSent: 'rgba(255, 255, 255, 0.55)',
    ticksRead: '#59ABE8',
    separator: 'rgba(255, 255, 255, 0.1)',
    inputBackground: '#243140',
    inputBarBackground: '#17212B',
    inputText: '#FFFFFF',
    placeholder: '#708499',
    dayPillBackground: 'rgba(255, 255, 255, 0.12)',
    dayPillText: '#FFFFFF',
    surface: '#17212B',
    reactionBackground: 'rgba(255, 255, 255, 0.08)',
    reactionActiveBackground: 'rgba(51, 144, 236, 0.22)',
    outgoingOverlay: 'rgba(255, 255, 255, 0.1)',
    error: '#E74C3C',
    inputFieldBorder: 'transparent',
  },
  radii: sharedRadii,
  spacing: sharedSpacing,
  typography: sharedTypography,
  avatar: { size: 34, palette: avatarPalette, textColor: '#FFFFFF' },
  sendButton: { size: 36 },
  composer: sharedComposer,
  voice: sharedVoice,
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

/** Deep-merge a partial theme over a base theme (two levels deep). */
export function mergeTheme (base: ChatTheme, override?: PartialChatTheme): ChatTheme {
  if (!override)
    return base

  const mergedTypography = { ...base.typography }
  if (override.typography)
    for (const key of Object.keys(override.typography) as Array<keyof ChatThemeTypography>)
      mergedTypography[key] = { ...base.typography[key], ...override.typography[key] }

  return {
    colors: { ...base.colors, ...override.colors },
    radii: { ...base.radii, ...override.radii },
    spacing: { ...base.spacing, ...override.spacing },
    typography: mergedTypography,
    avatar: { ...base.avatar, ...override.avatar },
    sendButton: { ...base.sendButton, ...override.sendButton },
    composer: { ...base.composer, ...override.composer },
    voice: { ...base.voice, ...override.voice },
  }
}
