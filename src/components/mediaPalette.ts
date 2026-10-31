import { ChatTheme } from '../Theme'

/**
 * Colors for the play/pause control and progress track inside a media bubble.
 *
 * The accent cannot be used for both positions: in the default light theme
 * `colors.accent` and `colors.outgoingBubble` are the same azure, so an accent
 * circle on an outgoing bubble is invisible (1:1 contrast). Telegram solves this
 * the same way - the control inverts on the sender's side.
 */
export interface MediaPalette {
  /** Filled circle behind the play/pause glyph. */
  control: string
  /** The glyph itself. */
  glyph: string
  /** Played portion of the waveform / progress track. */
  progress: string
  /** Unplayed portion. */
  track: string
  /** Duration and other meta text. */
  meta: string
}

/**
 * `color` at `alpha`, for a 6- or 3-digit hex; any other format (rgba, a
 * named color) comes back as `fallback`, since it cannot be faded reliably.
 */
const fadeHex = (color: string, alpha: number, fallback: string) => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match)
    return fallback

  const hex = match[1].length === 3
    ? match[1].split('').map(c => c + c).join('')
    : match[1]
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/*
 * Telegram's unplayed incoming bars (`chat_inVoiceSeekbar`) are a mid gray
 * that sits lighter than a dark bubble and darker than a light one - #5D6F80
 * on the dark-blue theme's #232E3B bubble, #BAC0C8 on the day theme's white.
 * A fixed black tint vanished on the dark bubble, so the track is the
 * incoming meta gray faded towards the bubble instead.
 */
const INCOMING_TRACK_ALPHA = 0.7
const INCOMING_TRACK_FALLBACK = 'rgba(0, 0, 0, 0.20)'

export const getMediaPalette = (
  theme: ChatTheme,
  position: 'left' | 'right'
): MediaPalette =>
  position === 'right'
    ? {
      control: theme.colors.outgoingText,
      glyph: theme.colors.outgoingBubble,
      progress: theme.colors.outgoingText,
      track: 'rgba(255, 255, 255, 0.45)',
      meta: theme.colors.outgoingText,
    }
    : {
      control: theme.colors.accent,
      glyph: '#FFFFFF',
      progress: theme.colors.accent,
      track: fadeHex(theme.colors.incomingMeta, INCOMING_TRACK_ALPHA, INCOMING_TRACK_FALLBACK),
      meta: theme.colors.incomingMeta,
    }
