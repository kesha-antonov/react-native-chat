import React, { useCallback, useEffect, useRef } from 'react'
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
    opacity.value = withTiming(activeOpacity, { duration: 150 }, () => {
      isAnimationInFinished.value = true
    })
  }, [activeOpacity, opacity, isAnimationInFinished])

  const handlePressOut = useCallback(() => {
    clearTimeout(pressOutTimeout.current)
    pressOutTimeout.current = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 150 })
      isAnimationInFinished.value = false
    }, isAnimationInFinished.value ? 0 : 150)
  }, [opacity, isAnimationInFinished])

  const handleActiveStateChange = useCallback((isActive: boolean) => {
    if (isActive)
      handlePressIn()
    else
      handlePressOut()
  }, [handlePressIn, handlePressOut])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const handlePress = useCallback(() => {
    onPress?.()
  }, [onPress])

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
        style={[style, animatedStyle, styles.content]}
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
