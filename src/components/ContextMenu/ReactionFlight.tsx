import React, { useEffect } from 'react'
import { StyleProp, Text, TextStyle } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import {
  BAR_EMOJI,
  BAR_EMOJI_BOX,
  DECELERATE,
  DEFAULT_CURVE,
  EASE_OUT_QUINT,
  FLIGHT_GROW_MS,
  FLIGHT_GROW_SCALE,
  FLIGHT_MS,
  PILL_EMOJI,
  REDUCE_MOTION,
  timing,
} from './constants'
import { Styles } from './styles'
import { Flight, FlightTarget } from './types'

/** The picked reaction growing in the bar, then flying into the message's reaction pill. */
export const ReactionFlight = ({
  flight,
  target,
  onEnd,
  emojiStyle,
  styles,
}: {
  flight: Flight
  /** Live: it follows the message if the list moves it mid-flight. */
  target: FlightTarget
  onEnd: () => void
  emojiStyle?: StyleProp<TextStyle>
  styles: Styles
}) => {
  const grow = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  useEffect(() => {
    grow.set(withTiming(1, timing(FLIGHT_GROW_MS, DECELERATE)))
    flyX.set(withDelay(FLIGHT_GROW_MS, withTiming(1, timing(FLIGHT_MS, EASE_OUT_QUINT)), REDUCE_MOTION))
    flyY.set(withDelay(FLIGHT_GROW_MS, withTiming(1, timing(FLIGHT_MS, DEFAULT_CURVE), finished => {
      if (finished)
        runOnJS(onEnd)()
    }), REDUCE_MOTION))
  }, [grow, flyX, flyY, onEnd])

  const dx = target.toX - flight.fromX
  const dy = target.toY - flight.fromY
  const flightStyle = useAnimatedStyle(() => {
    const grown = 1 + (FLIGHT_GROW_SCALE - 1) * grow.value
    const landed = PILL_EMOJI / BAR_EMOJI
    return {
      transform: [
        { translateX: dx * flyX.value },
        { translateY: dy * flyY.value },
        { scale: grown + (landed - grown) * flyY.value },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents='none'
      style={[
        styles.flight,
        { left: flight.fromX - BAR_EMOJI_BOX / 2, top: flight.fromY - BAR_EMOJI_BOX / 2 },
        flightStyle,
      ]}
    >
      <Text style={[styles.reactionEmoji, emojiStyle]} allowFontScaling={false}>{flight.emoji}</Text>
    </Animated.View>
  )
}
