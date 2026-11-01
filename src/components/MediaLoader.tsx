import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { formatFileSize } from '../MessageFile'

/** The loader circle over media and its glyph. */
export const MEDIA_LOADER_BACKGROUND = 'rgba(0, 0, 0, 0.4)'
export const MEDIA_LOADER_ICON = '#FFFFFF'
/** The button over a photo or video is 48 across. */
export const MEDIA_BUTTON_SIZE = 48
/** Over a round note, 44. */
export const ROUND_BUTTON_SIZE = 44

/**
 * "1.2 MB / 4.5 MB", the loading text. Without a
 * total it is nothing; a size that would not fit is the percentage.
 */
export const transferLabel = (progress: number, total?: number) => {
  if (!total || !Number.isFinite(total) || total <= 0)
    return null
  const loaded = Math.max(0, Math.min(1, progress)) * total
  return `${formatFileSize(Math.round(loaded))} / ${formatFileSize(total)}`
}

/**
 * The loading text on a photo or video: white 12 on the media time background in a pill 4 in
 * from the top-left corner, 16.5 tall, the text 6 in.
 */
export function MediaInfoPill ({ label }: { label: string }) {
  return (
    <View testID='media-info-pill' style={styles.pill} pointerEvents='none'>
      <Text style={styles.text} numberOfLines={1} allowFontScaling={false}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    height: 16.5,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
})
