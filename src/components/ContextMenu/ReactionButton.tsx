import React, { useEffect } from 'react'
import { Pressable, StyleProp, Text, TextStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { EASE_OUT_QUINT, ITEM_IN_MS, REDUCE_MOTION, timing } from './constants'
import { Styles } from './styles'

export const ReactionButton = ({
  emoji,
  index,
  delay,
  isSelected,
  isHidden,
  onPress,
  emojiStyle,
  styles,
}: {
  emoji: string
  index: number
  delay: number
  isSelected: boolean
  /** Flying to the message, so its spot in the bar is left empty. */
  isHidden: boolean
  onPress: (emoji: string, index: number) => void
  emojiStyle?: StyleProp<TextStyle>
  styles: Styles
}) => {
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.set(withDelay(delay, withTiming(1, timing(ITEM_IN_MS, EASE_OUT_QUINT)), REDUCE_MOTION))
  }, [appear, delay])
  const appearStyle = useAnimatedStyle(() => ({
    transform: [{ scale: appear.value }],
  }))

  return (
    <Pressable
      onPress={() => onPress(emoji, index)}
      accessibilityRole='button'
      accessibilityLabel={emoji}
      accessibilityState={{ selected: isSelected }}
      style={styles.reactionCell}
    >
      <Animated.View style={[styles.reactionBox, isSelected && styles.reactionBoxSelected, isHidden && styles.hidden, appearStyle]}>
        <Text style={[styles.reactionEmoji, isSelected && styles.reactionEmojiSelected, emojiStyle]} allowFontScaling={false}>
          {emoji}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
