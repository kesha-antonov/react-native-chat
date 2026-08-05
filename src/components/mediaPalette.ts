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
      track: 'rgba(0, 0, 0, 0.20)',
      meta: theme.colors.incomingMeta,
    }
