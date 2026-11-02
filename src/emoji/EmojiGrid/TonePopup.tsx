import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { emojiRecents, withSkinTone } from '../emojiStore'
import { TONE_ARROW, TONE_POPUP_HEIGHT, TONE_POPUP_WIDTH } from './constants'
import { Styles } from './styles'
import { TonePopupState } from './types'

/** The skin-tone picker: the emoji plus five tones in a bubble above the pressed cell. */
export const TonePopup = ({ popup, width, onPick, onClose, styles }: {
  popup: TonePopupState
  width: number
  onPick: (tone: number | null) => void
  onClose: () => void
  styles: Styles
}) => {
  const current = emojiRecents.getTone(popup.emoji)
  const left = Math.max(5, Math.min(popup.x - TONE_POPUP_WIDTH / 2, width - TONE_POPUP_WIDTH - 5))
  const top = Math.max(0, popup.y - TONE_POPUP_HEIGHT - TONE_ARROW)
  const arrowLeft = Math.max(12, Math.min(popup.x - left - TONE_ARROW, TONE_POPUP_WIDTH - 12 - TONE_ARROW * 2))
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.set(withTiming(1, { duration: 125, easing: Easing.bezier(0.23, 1, 0.32, 1) }))
  }, [appear])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.9 + 0.1 * appear.value }],
  }))

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel='close' />
      <Animated.View style={[styles.tonePopup, { left, top }, appearStyle]}>
        {[null, 0, 1, 2, 3, 4].map(tone => (
          <Pressable
            key={String(tone)}
            onPress={() => onPick(tone)}
            style={[styles.toneCell, tone === current && styles.toneCellSelected]}
            accessibilityRole='button'
            accessibilityLabel={withSkinTone(popup.emoji, tone)}
          >
            <Text style={styles.toneEmoji} allowFontScaling={false}>{withSkinTone(popup.emoji, tone)}</Text>
          </Pressable>
        ))}
        <View style={[styles.toneArrow, { left: arrowLeft }]} />
      </Animated.View>
    </View>
  )
}
