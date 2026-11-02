import { useWindowDimensions } from 'react-native'

import { useTheme } from '../../hooks/useTheme'
import { SLIDE_WIDTH_SHARE } from './constants'

/** The horizontal distance a cancel slide covers (`distCanMove`), shared with the bar. */
export function useRecordSlideDistance () {
  const { voice } = useTheme()
  const { width } = useWindowDimensions()
  return Math.min(voice.cancelThreshold, width * SLIDE_WIDTH_SHARE)
}
