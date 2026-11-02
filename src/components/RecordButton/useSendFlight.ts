import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { View } from 'react-native'
import { Easing, cancelAnimation, runOnJS, withTiming } from 'react-native-reanimated'

import { useRecordCircleValues } from '../RecordCircle'
import {
  SEND_FLIGHT_REVEAL_MS,
  SEND_FLIGHT_WAIT_MS,
  VOICE_FLIGHT_MS,
  VoiceFlightTarget,
  abandonSendFlight,
  finishSendFlight,
  onSendFlightTarget,
} from '../sendFlight'

interface SendFlightOptions {
  /** The button's container, measured in the window for the flight's start. */
  containerRef: React.RefObject<React.ComponentRef<typeof View> | null>
  setFlightTarget: (target: VoiceFlightTarget | null) => void
  /** Puts the circle away once the flight has landed. */
  exitDoneRef: React.RefObject<() => void>
  circle: ReturnType<typeof useRecordCircleValues>
  cancelSign: number
  slideDistance: number
}

/**
 * A sent voice take flies into the new message's play button
 * (`VoiceMessageEnterTransition`) instead of collapsing in place.
 */
export function useSendFlight ({
  containerRef,
  setFlightTarget,
  exitDoneRef,
  circle,
  cancelSign,
  slideDistance,
}: SendFlightOptions) {
  const { slide: slideProgress, flight, flightDX, flightDY, flightRadius } = circle
  // Stops waiting for a target, or reports a flight in the air as landed.
  const flightCleanupRef = useRef<(() => void) | null>(null)
  const flightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsFlightLanded = () => {
    flightCleanupRef.current = null
    finishSendFlight('voice')
    // The bubble's button fades in under the disc, then the disc goes, so the
    // two never show a half-transparent gap between them.
    flightTimerRef.current = setTimeout(() => {
      flightTimerRef.current = null
      exitDoneRef.current()
    }, SEND_FLIGHT_REVEAL_MS)
  }

  const startFlightRef = useRef<(fallback: () => void) => void>(() => {})
  useLayoutEffect(() => {
    startFlightRef.current = (fallback: () => void) => {
      flightCleanupRef.current?.()
      let isLanded = false
      let isWaiting = true
      let unsubscribe: (() => void) | undefined
      const stopWaiting = () => {
        isWaiting = false
        clearTimeout(timer)
        unsubscribe?.()
      }
      // Nothing landed in time (a take too short to send, a list that renders
      // elsewhere): give up and play the ordinary exit.
      const timer = setTimeout(() => {
        stopWaiting()
        flightCleanupRef.current = null
        abandonSendFlight('voice')
        fallback()
      }, SEND_FLIGHT_WAIT_MS)
      const onTarget = (target: VoiceFlightTarget) => {
        if (!isWaiting)
          return

        stopWaiting()
        isLanded = true
        const node = containerRef.current
        if (!node) {
          jsFlightLanded()
          return
        }

        node.measureInWindow((x, y, width, height) => {
          if (!isLanded)
            return

          // The circle hangs off the button's centre, shifted by the cancel
          // slide it was released at (`recordCircle.drawingCx`).
          const fromX = x + width / 2 + cancelSign * slideDistance * (1 - slideProgress.value)
          const fromY = y + height / 2
          flightDX.set(target.x - fromX)
          flightDY.set(target.y - fromY)
          flightRadius.set(target.radius)
          setFlightTarget(target)
          flight.set(0)
          flight.set(withTiming(1, { duration: VOICE_FLIGHT_MS, easing: Easing.linear }, finished => {
            if (finished)
              runOnJS(jsFlightLanded)()
          }))
        })
      }
      const off = onSendFlightTarget('voice', target => onTarget(target))
      // The target may already have landed, which ran `onTarget` before the
      // subscription was returned.
      if (isWaiting)
        unsubscribe = off
      else
        off()
      flightCleanupRef.current = () => {
        if (isWaiting) {
          stopWaiting()
          abandonSendFlight('voice')
        } else if (isLanded) {
          isLanded = false
          cancelAnimation(flight)
          finishSendFlight('voice')
        }
      }
    }
  })

  useEffect(() => () => {
    flightCleanupRef.current?.()
    if (flightTimerRef.current)
      clearTimeout(flightTimerRef.current)
  }, [])

  return { startFlightRef, flightCleanupRef, flightTimerRef }
}
