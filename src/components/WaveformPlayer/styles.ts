import { StyleSheet } from 'react-native'

import { ChatTheme } from '../../Theme'
import { getMediaPalette } from '../mediaPalette'
import {
  BAR_STEP,
  BAR_WIDTH,
  TRANSCRIBE_SLOT_WIDTH,
  VOICE_BUTTON_SIZE,
  VOICE_COLUMN_GAP,
  VOICE_META_HEIGHT,
  VOICE_ROW_PADDING_V,
  VOICE_TIME_FONT_SIZE,
  WAVEFORM_HEIGHT,
} from '../voiceWaveform'

export const ROW_PADDING_H = 8

export const barStyles = StyleSheet.create({
  row: {
    height: WAVEFORM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_STEP - BAR_WIDTH,
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  line: {
    flex: 1,
    height: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  },
  clipContent: {
    position: 'absolute',
    top: 0,
  },
  burn: {
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  },
})

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const palette = getMediaPalette(theme, position)

  return StyleSheet.create({
    // Carries the glyph color out of JSX and into the stylesheet.
    glyphColor: {
      color: palette.glyph,
    },
    // Carries the bar colors: background = played, border = unplayed.
    colors: {
      backgroundColor: palette.progress,
      borderColor: palette.track,
    },
    // Carries the text colors of the bubble and the transcription.
    bubble: {
      backgroundColor: position === 'right' ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
    },
    transcriptionColor: {
      color: position === 'right' ? theme.colors.outgoingText : theme.colors.incomingText,
    },
    container: {
      maxWidth: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: VOICE_ROW_PADDING_V,
      paddingHorizontal: ROW_PADDING_H,
      gap: VOICE_COLUMN_GAP,
    },
    waveformRow: {
      height: WAVEFORM_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    transcribeSlot: {
      width: TRANSCRIBE_SLOT_WIDTH,
      alignItems: 'flex-end',
    },
    transcription: {
      paddingHorizontal: ROW_PADDING_H,
    },
    metaSpacer: {
      paddingBottom: VOICE_META_HEIGHT,
    },
    playCircle: {
      width: VOICE_BUTTON_SIZE,
      height: VOICE_BUTTON_SIZE,
      borderRadius: VOICE_BUTTON_SIZE / 2,
      backgroundColor: palette.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playCircleLoading: {
      opacity: 0.5,
    },
    // Waveform level with the button's top, time level with its bottom.
    column: {
      flex: 1,
      minHeight: VOICE_BUTTON_SIZE,
      justifyContent: 'space-between',
    },
    waveform: {
      flex: 1,
      height: WAVEFORM_HEIGHT,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    time: {
      fontSize: VOICE_TIME_FONT_SIZE,
      lineHeight: VOICE_BUTTON_SIZE - WAVEFORM_HEIGHT,
      color: palette.meta,
      fontVariant: ['tabular-nums'],
    },
    dotSlot: {
      marginLeft: 3,
    },
  })
}

export type WaveformPlayerStyles = ReturnType<typeof makeStyles>

export const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
export const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
