import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { BaseButton } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

export type TouchableOpacityProps = Omit<React.ComponentProps<typeof BaseButton>, 'onPress'> & {
  activeOpacity?: number
  onPress?: () => void
} & React.ComponentProps<typeof Animated.View>

// Built on gesture-handler's `BaseButton`, not the `Touchable` 3.0 recommends in
// its place. `Touchable` handles the press natively, outside the gesture system,
// so a bubble's long-press could no longer win over a photo or play button
// inside it: holding a photo neither opened the menu nor stopped the release
// from opening the viewer. `BaseButton` is still a gesture, so it loses to the
// long-press the way it always did.
export const TouchableOpacity: React.FC<TouchableOpacityProps> = ({
  children,
  style,
  activeOpacity = 0.2,
  onPress,
  ...rest
}) => {
  const opacity = useSharedValue(1)
  const isAnimationInFinished = useSharedValue(false)
  // The press-out fade is deferred so a quick tap still shows the pressed state for a
  // full beat. That timer has to be cancellable: unmounting between press-out and the
  // fade (a button that dismisses its own sheet) would otherwise leave it pending.
  const pressOutTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => {
    clearTimeout(pressOutTimeout.current)
  }, [])

  const handlePressIn = useCallback(() => {
    opacity.set(withTiming(activeOpacity, { duration: 150 }, () => {
      isAnimationInFinished.set(true)
    }))
  }, [activeOpacity, opacity, isAnimationInFinished])

  const handlePressOut = useCallback(() => {
    clearTimeout(pressOutTimeout.current)
    pressOutTimeout.current = setTimeout(() => {
      opacity.set(withTiming(1, { duration: 150 }))
      isAnimationInFinished.set(false)
    }, isAnimationInFinished.get() ? 0 : 150)
  }, [opacity, isAnimationInFinished])

  const handleActiveStateChange = useCallback((isActive: boolean) => {
    if (isActive)
      handlePressIn()
    else
      handlePressOut()
  }, [handlePressIn, handlePressOut])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }))

  const handlePress = useCallback(() => {
    onPress?.()
  }, [onPress])

  // Every tappable in the library goes through this component - each message bubble, avatar,
  // action and attachment - so composing the style list inline handed Animated.View a fresh array
  // on each of those renders.
  const composedStyle = useMemo(() => [style, animatedStyle, styles.content], [style, animatedStyle])

  return (
    <BaseButton
      {...rest}
      onPress={handlePress}
      onActiveStateChange={handleActiveStateChange}
    >
      <Animated.View
        // The content view must not capture touches, otherwise it swallows the
        // BaseButton's press on Android (see #2714). pointerEvents in style is
        // the non-deprecated form on RN's New Architecture.
        style={composedStyle}
      >
        {children}
      </Animated.View>
    </BaseButton>
  )
}

const styles = StyleSheet.create({
  content: {
    pointerEvents: 'none',
  },
})
