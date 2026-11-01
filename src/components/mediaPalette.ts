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
 * Telegram's voice colors (`chat_{in,out}VoiceSeekbar*`, `chat_{in,out}Loader`): the play
 * button and played bars in the bubble's fill color, unplayed bars in its track color. On the
 * day theme's green bubble they are greens; on the night gradient, white.
 */
export const getMediaPalette = (
  theme: ChatTheme,
  position: 'left' | 'right'
): MediaPalette =>
  position === 'right'
    ? {
      control: theme.colors.outgoingVoiceFill,
      glyph: theme.colors.outgoingBubble,
      progress: theme.colors.outgoingVoiceFill,
      track: theme.colors.outgoingVoiceTrack,
      meta: theme.colors.outgoingMeta,
    }
    : {
      control: theme.colors.incomingVoiceFill,
      glyph: '#FFFFFF',
      progress: theme.colors.incomingVoiceFill,
      track: theme.colors.incomingVoiceTrack,
      meta: theme.colors.incomingMeta,
    }
