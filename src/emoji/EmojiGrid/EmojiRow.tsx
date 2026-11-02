import React, { memo } from 'react'
import { GestureResponderEvent, Text, View } from 'react-native'

import { emojiRecents, takesSkinTone, withSkinTone } from '../emojiStore'
import { Styles } from './styles'

export const EmojiRow = memo(({ emojis, cellSize, fontSize, isRTL, onPress, onLongPress, styles }: {
  emojis: string[]
  cellSize: number
  fontSize: number
  isRTL: boolean
  /** Bumped when a remembered tone changes, so the row redraws with it. */
  toneVersion: number
  onPress: (emoji: string) => void
  onLongPress: (emoji: string, event: GestureResponderEvent) => void
  styles: Styles
}) => (
  <View style={[styles.row, isRTL && styles.rowReverse]}>
    {emojis.map(emoji => {
      const shown = withSkinTone(emoji, emojiRecents.getTone(emoji))
      return (
        <Text
          key={emoji}
          onPress={() => onPress(shown)}
          onLongPress={takesSkinTone(emoji) ? event => onLongPress(emoji, event) : undefined}
          style={[styles.cell, { width: cellSize, height: cellSize, lineHeight: cellSize, fontSize }]}
          suppressHighlighting
          allowFontScaling={false}
          accessibilityRole='button'
          accessibilityLabel={shown}
        >
          {shown}
        </Text>
      )
    })}
  </View>
))
EmojiRow.displayName = 'EmojiRow'
