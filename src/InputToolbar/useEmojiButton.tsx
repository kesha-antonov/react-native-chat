import React, { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Icon } from '../components/Icon'
import { EmojiIcon } from '../components/MediaControls'
import { EmojiKeyboardProps } from '../emoji/EmojiKeyboard'
import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { EMOJI_ICON_SWAP } from './animations'
import { createStyles } from './styles'

interface UseEmojiButtonOptions {
  /** The app's own handler, in place of the built-in emoji keyboard. */
  onPressEmoji?: () => void
  /** The built-in emoji keyboard's config; null when it is off. */
  emojiConfig: EmojiKeyboardProps | null
  isEmojiOpen: boolean
  toggleEmoji: () => void
}

/** The emoji button at the field's start, morphing between a smile and a keyboard. */
export function useEmojiButton ({ onPressEmoji, emojiConfig, isEmojiOpen, toggleEmoji }: UseEmojiButtonOptions) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()

  const emojiShown = useSharedValue(0)
  useEffect(() => {
    emojiShown.value = withTiming(isEmojiOpen ? 1 : 0, EMOJI_ICON_SWAP)
  }, [isEmojiOpen, emojiShown])
  const smileIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - emojiShown.value,
    transform: [{ scale: 1 - 0.5 * emojiShown.value }],
  }))
  const keyboardIconStyle = useAnimatedStyle(() => ({
    opacity: emojiShown.value,
    transform: [{ scale: 0.5 + 0.5 * emojiShown.value }],
  }))

  return useMemo(() => {
    if (!onPressEmoji && !emojiConfig)
      return null

    const size = styles.insetColor.fontSize
    const color = styles.insetColor.color
    return (
      <Pressable
        onPress={onPressEmoji ?? toggleEmoji}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={isEmojiOpen ? labels.keyboardButton : labels.emojiButton}
        style={styles.insetCell}
      >
        <Animated.View style={smileIconStyle}>
          <Icon name='emoji' color={color} size={size} fallback={<EmojiIcon color={color} size={size} />} />
        </Animated.View>
        {emojiConfig && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.centered, keyboardIconStyle]} pointerEvents='none'>
            <Icon name='keyboard' color={color} size={size} fallback={<Text style={[styles.keyboardFallback, { color }]}>{'⌨'}</Text>} />
          </Animated.View>
        )}
      </Pressable>
    )
  }, [onPressEmoji, emojiConfig, toggleEmoji, isEmojiOpen, labels, styles, smileIconStyle, keyboardIconStyle])
}
