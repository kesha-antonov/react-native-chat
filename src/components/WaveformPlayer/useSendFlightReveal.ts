import React, { useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import {
  SEND_FLIGHT_REVEAL_MS,
  SEND_FLIGHT_SAFETY_MS,
  isSendFlightExpected,
  landSendFlight,
  onSendFlightFinished,
} from '../sendFlight'
import { VOICE_BUTTON_SIZE } from '../voiceWaveform'

interface SendFlightReveal {
  playRef: React.RefObject<React.ComponentRef<typeof View> | null>
  onPlayLayout: () => void
  playRevealStyle: React.ComponentProps<typeof Animated.View>['style']
}

/**
 * The record circle flies into this play button when the note was just sent
 * (`VoiceMessageEnterTransition`), and the button is not drawn until it has
 * landed (`setEnterTransitionInProgress`). Hidden from the first frame, so it
 * does not flash while it is measured.
 */
export const useSendFlightReveal = ({
  appearOnMount,
  flightColor,
  flightIconColor,
}: {
  appearOnMount: boolean
  flightColor: string
  flightIconColor: string
}): SendFlightReveal => {
  const playRef = useRef<React.ComponentRef<typeof View>>(null)
  const playReveal = useSharedValue(appearOnMount && isSendFlightExpected('voice') ? 0 : 1)
  const hasLandedRef = useRef(false)
  const flightCleanupRef = useRef<(() => void) | null>(null)

  const onPlayLayout = useCallback(() => {
    if (!appearOnMount || hasLandedRef.current)
      return

    hasLandedRef.current = true
    const node = playRef.current
    const reveal = () => {
      playReveal.set(withTiming(1, { duration: SEND_FLIGHT_REVEAL_MS }))
    }
    if (!node) {
      reveal()
      return
    }

    node.measureInWindow((x, y, width, height) => {
      const isLanded = width > 0 && landSendFlight('voice', {
        x: x + width / 2,
        y: y + height / 2,
        radius: VOICE_BUTTON_SIZE / 2,
        color: flightColor,
        iconColor: flightIconColor,
      })
      if (!isLanded) {
        playReveal.set(1)
        return
      }

      const safety = setTimeout(() => {
        off()
        reveal()
      }, SEND_FLIGHT_SAFETY_MS)
      const off = onSendFlightFinished('voice', () => {
        clearTimeout(safety)
        reveal()
      })
      flightCleanupRef.current = () => {
        clearTimeout(safety)
        off()
      }
    })
  }, [appearOnMount, playReveal, flightColor, flightIconColor])

  useEffect(() => () => flightCleanupRef.current?.(), [])

  const playRevealStyle = useAnimatedStyle(() => ({ opacity: playReveal.get() }))

  return { playRef, onPlayLayout, playRevealStyle }
}
