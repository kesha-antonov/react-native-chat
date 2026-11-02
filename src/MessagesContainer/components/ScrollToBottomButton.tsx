import React, { useCallback, useMemo } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { GlassSurface } from '../../components/GlassSurface'
import { Icon } from '../../components/Icon'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import stylesCommon from '../../styles'
import styles, { createThemedStyles } from '../styles'
import { PageDownCounter } from './PageDownCounter'

const SCROLL_BUTTON_RISE = 80
// 13% smaller in 80ms while pressed, back
// over 350ms on an overshoot with tension 2.
const SCROLL_BUTTON_PRESSED = 0.87
const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const x = t - 1
  return x * x * ((tension + 1) * x + tension) + 1
}
const SCROLL_BUTTON_PRESS_IN = { duration: 80 }
const SCROLL_BUTTON_PRESS_OUT = { duration: 350, easing: overshoot(2) }

interface ScrollToBottomButtonProps {
  isEnabled: boolean
  isVisible: boolean
  /** The button's show/hide progress, 0 to 1. */
  opacity: SharedValue<number>
  unreadCount: number
  onPress: () => void
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  scrollToBottomComponent?: () => React.ReactNode
}

/**
 * The page-down button over the list. Always mounted with the list, so its press animation
 * outlives the button itself; it renders nothing while hidden.
 */
export function ScrollToBottomButton ({
  isEnabled,
  isVisible,
  opacity: scrollToBottomOpacity,
  unreadCount,
  onPress: handleScrollToBottomPress,
  style: scrollToBottomStyle,
  contentStyle: scrollToBottomContentStyle,
  scrollToBottomComponent: scrollToBottomComponentProp,
}: ScrollToBottomButtonProps) {
  const themedStyles = useThemedStyles(createThemedStyles)
  const theme = useTheme()

  const scrollToBottomPressScale = useSharedValue(1)
  // The pressed state is the icon color at 15% over the circle.
  const scrollToBottomPressed = useSharedValue(0)
  const scrollToBottomPressedStyle = useAnimatedStyle(() => ({ opacity: scrollToBottomPressed.value }))
  const scrollToBottomStyleAnim = useAnimatedStyle(() => ({
    opacity: scrollToBottomOpacity.value,
    transform: [
      { translateY: (1 - scrollToBottomOpacity.value) * SCROLL_BUTTON_RISE },
      { scale: (0.7 + 0.3 * scrollToBottomOpacity.value) * scrollToBottomPressScale.value },
    ],
  }))

  const renderScrollBottomComponent = useCallback(() => {
    if (scrollToBottomComponentProp)
      return scrollToBottomComponentProp()

    // A down chevron in the glass icon color.
    return (
      <Icon
        name='chevronDown'
        color={themedStyles.chevronColor.color}
        size={26}
        fallback={<View style={themedStyles.scrollChevron} />}
      />
    )
  }, [scrollToBottomComponentProp, themedStyles])

  const handleScrollToBottomPressIn = useCallback(() => {
    scrollToBottomPressScale.set(withTiming(SCROLL_BUTTON_PRESSED, SCROLL_BUTTON_PRESS_IN))
    scrollToBottomPressed.set(1)
  }, [scrollToBottomPressScale, scrollToBottomPressed])

  const handleScrollToBottomPressOut = useCallback(() => {
    scrollToBottomPressScale.set(withTiming(1, SCROLL_BUTTON_PRESS_OUT))
    scrollToBottomPressed.set(withTiming(0, { duration: 150 }))
  }, [scrollToBottomPressScale, scrollToBottomPressed])

  const scrollToBottomContent = useMemo(() => {
    return (
      <Animated.View
        style={[
          stylesCommon.centerItems,
          styles.scrollToBottomContent,
          scrollToBottomContentStyle,
          scrollToBottomStyleAnim,
        ]}
      >
        <GlassSurface
          color={theme.colors.scrollToBottomBackground}
          borderColor={theme.colors.inputFieldBorder}
          style={styles.scrollToBottomSurface}
        />
        <Animated.View
          pointerEvents='none'
          style={[styles.scrollToBottomPressed, themedStyles.scrollToBottomPressed, scrollToBottomPressedStyle]}
        />
        {renderScrollBottomComponent()}
        <PageDownCounter
          count={unreadCount}
          style={[styles.scrollToBottomBadge, themedStyles.scrollToBottomBadge]}
          textStyle={themedStyles.scrollToBottomBadgeText}
        />
      </Animated.View>
    )
  }, [scrollToBottomStyleAnim, scrollToBottomContentStyle, renderScrollBottomComponent, themedStyles, unreadCount, theme, scrollToBottomPressedStyle])

  if (!isEnabled || !isVisible)
    return null

  return (
    <Pressable
      style={[styles.scrollToBottom, scrollToBottomStyle]}
      onPress={handleScrollToBottomPress}
      onPressIn={handleScrollToBottomPressIn}
      onPressOut={handleScrollToBottomPressOut}
      accessibilityRole='button'
      hitSlop={6}
    >
      {scrollToBottomContent}
    </Pressable>
  )
}
