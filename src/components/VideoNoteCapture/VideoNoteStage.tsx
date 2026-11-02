import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useColorScheme } from '../../hooks/useColorScheme'
import { useTheme } from '../../hooks/useTheme'
import {
  BLUR_INTENSITY,
  BLUR_LAYER_ALPHA,
  BLUR_WASH_ALPHA,
  DIM_ANIMATION_MS,
  EASE_OUT_QUINT,
} from './constants'
import { BlurView } from './optional'
import { styles } from './styles'

/**
 * The layer behind the circle, kept across capture and preview: fades in over
 * 520ms and out the same way when the take ends. The chat is blurred
 * under it with `expo-blur`, and
 * without it a dim stands in.
 */
export function VideoNoteStage ({ isClosing, children }: { isClosing: boolean, children: React.ReactNode }) {
  const { colors } = useTheme()
  const isDark = useColorScheme() === 'dark'
  const dim = useSharedValue(0)
  useEffect(() => {
    dim.set(withTiming(isClosing ? 0 : 1, { duration: DIM_ANIMATION_MS, easing: EASE_OUT_QUINT }))
  }, [isClosing, dim])
  const isBlurred = !!BlurView
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * (isBlurred ? BLUR_LAYER_ALPHA : 1) }))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isClosing ? 'none' : 'box-none'}>
      {/* Blocks touches to the chat underneath while the camera is up. */}
      <Animated.View style={[isBlurred ? styles.blurLayer : styles.dim, dimStyle]} pointerEvents={isClosing ? 'none' : 'auto'}>
        {isBlurred && (
          <>
            <BlurView style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'default'} intensity={BLUR_INTENSITY} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.inputBarBackground, opacity: BLUR_WASH_ALPHA }]} />
          </>
        )}
      </Animated.View>
      {children}
    </View>
  )
}
