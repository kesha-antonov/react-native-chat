import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { Icon } from '../../components/Icon'
import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { TAB_PILL, TABS_ROW } from './constants'
import { createStyles } from './styles'

/** The caption field and the "Send N" button that replace the tabs once something is picked. */
export function CaptionBar ({ count, caption, onChangeCaption, onSend, captionShown, keyboardHeight, bottomInset, isDark }: {
  /** How many items are picked. */
  count: number
  caption: string
  onChangeCaption: (text: string) => void
  onSend: () => void
  captionShown: SharedValue<number>
  keyboardHeight: SharedValue<number>
  bottomInset: number
  isDark: boolean
}) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const labels = useLabels()
  const isRTL = useIsRTL()

  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionShown.value,
    transform: [{ translateY: keyboardHeight.value + bottomInset * Math.min(1, -keyboardHeight.value / 100) }],
  }))
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.2 + 0.8 * captionShown.value }],
  }))

  return (
    <Animated.View style={[styles.captionRow, { bottom: bottomInset + (TABS_ROW - TAB_PILL) / 2 }, isRTL && styles.rowReverse, captionStyle]}>
      <View style={styles.captionPill}>
        <TextInput
          value={caption}
          onChangeText={onChangeCaption}
          placeholder={labels.attachCaption}
          placeholderTextColor={theme.attachments.secondaryText}
          style={[styles.captionInput, isRTL && styles.textRTL]}
          multiline
          keyboardAppearance={isDark ? 'dark' : 'default'}
          accessibilityLabel={labels.attachCaption}
        />
      </View>
      <Animated.View style={sendStyle}>
        <Pressable
          onPress={onSend}
          style={styles.sendButton}
          accessibilityRole='button'
          accessibilityLabel={`${labels.send} ${count}`}
        >
          <Icon name='send' color={theme.attachments.sendButtonIcon} size={22} fallback={<Text style={styles.sendFallback}>{'➤'}</Text>} />
          <View style={styles.sendBadge}>
            <Text style={styles.sendBadgeText} allowFontScaling={false}>{count}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
