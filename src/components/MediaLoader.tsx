import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { formatFileSize } from '../MessageFile'

/** `chat_mediaLoaderPhoto` / `chat_mediaLoaderPhotoIcon` (`ThemeColors.java:530-532`). */
export const MEDIA_LOADER_BACKGROUND = 'rgba(0, 0, 0, 0.4)'
export const MEDIA_LOADER_ICON = '#FFFFFF'
/** The button over a photo or video is 48 across (`ChatMessageCell.java:14120-14122`). */
export const MEDIA_BUTTON_SIZE = 48
/** Over a round note, 44 (`ChatMessageCell.java:13948`). */
export const ROUND_BUTTON_SIZE = 44

/**
 * "1.2 MB / 4.5 MB", Telegram's loading text (`ChatMessageCell.java:18357-18367`). Without a
 * total it is nothing; a size that would not fit is the percentage.
 */
export const transferLabel = (progress: number, total?: number) => {
  if (!total || !Number.isFinite(total) || total <= 0)
    return null
  const loaded = Math.max(0, Math.min(1, progress)) * total
  return `${formatFileSize(Math.round(loaded))} / ${formatFileSize(total)}`
}

/**
 * The loading text on a photo or video: white 12 on `chat_mediaTimeBackground` in a pill 4 in
 * from the top-left corner, 16.5 tall, the text 6 in (`ChatMessageCell.java:25048-25123`).
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
