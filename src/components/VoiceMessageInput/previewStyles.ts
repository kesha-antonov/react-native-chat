import { StyleSheet } from 'react-native'

import { ChatTheme } from '../../Theme'
import { HANDLE_WIDTH, TRIM_INSET } from './previewWaveform'

export const createPreviewStyles = (theme: ChatTheme) => StyleSheet.create({
  // A pill in the accent color.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 4,
    borderRadius: 17,
    backgroundColor: theme.colors.accent,
  },
  play: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  barPlayed: {
    backgroundColor: '#fff',
  },
  barUnplayed: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  barCut: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  waveformTrimmable: {
    paddingHorizontal: TRIM_INSET,
  },
  // The pill is darkened outside the kept range.
  cut: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  cutStart: {
    left: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  cutEnd: {
    right: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  handle: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: HANDLE_WIDTH,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  time: {
    minWidth: 34,
    paddingRight: 8,
    textAlign: 'right',
    fontSize: 12,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
})
