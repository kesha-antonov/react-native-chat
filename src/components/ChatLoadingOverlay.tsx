import React from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { ServiceSpinner } from './ServiceSpinner'

/**
 * The spinner grows from 0.3 and fades in over 150ms, and shrinks back out the same way, on an
 * accelerate-decelerate curve.
 */
export const LOADING_OVERLAY_MS = 150
const FROM_SCALE = 0.3
const ACCELERATE_DECELERATE = Easing.bezier(0.37, 0, 0.63, 1)

export function ChatLoadingOverlay ({ isVisible }: { isVisible: boolean }) {
  const progress = useSharedValue(0)
  const { isMounted } = useAnimatedPresence(
    isVisible,
    () => {
      progress.value = withTiming(1, { duration: LOADING_OVERLAY_MS, easing: ACCELERATE_DECELERATE })
    },
    onDone => {
      progress.value = withTiming(0, { duration: LOADING_OVERLAY_MS, easing: ACCELERATE_DECELERATE }, finished => {
        if (finished)
          runOnJS(onDone)()
      })
    }
  )

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * progress.value }],
  }))

  if (!isMounted)
    return null

  return (
    <Animated.View testID='chat-loading' pointerEvents='none' style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={style}>
        <ServiceSpinner />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
