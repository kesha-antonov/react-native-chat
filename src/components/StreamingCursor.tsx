import React, { useEffect } from 'react'
import { StyleProp, TextStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

export interface StreamingCursorProps {
  /** Caret glyph. Defaults to a thin block. */
  char?: string
  /** Blink period in ms (one fade cycle). Default 600. */
  duration?: number
  style?: StyleProp<TextStyle>
}

/**
 * A blinking caret meant to be rendered inline at the end of a streaming
 * message. Rendered as nested <Text>, so it inherits the bubble text color.
 */
export function StreamingCursor ({
  char = '▍',
  duration = 600,
  style,
}: StreamingCursorProps): React.ReactElement {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
    return () => cancelAnimation(opacity)
  }, [opacity, duration])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.Text style={[style, animatedStyle]}>{char}</Animated.Text>
}
