import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import {
  ROUND_FLIGHT_FADE_MS,
  ROUND_FLIGHT_MS,
  SEND_FLIGHT_WAIT_MS,
  abandonSendFlight,
  easeDefault,
  easeOutQuint,
  finishSendFlight,
  onSendFlightTarget,
} from '../sendFlight'
import { DECELERATE, ROUND_ANIMATION_MS, SLIDE_OUT_INSET } from './constants'

/**
 * The circle opens from 0.1 and half a
 * screen down over 180ms, and closes the same way - towards the left edge
 * when the take was long enough to send. A paused take's preview is already
 * open.
 */
export function useRoundAnimation ({ isClosing, isSlideOut, isOpen, area, isFlight, roundRef, roundSize }: {
  isClosing: boolean
  isSlideOut: boolean
  /** Starts open, without the rise (`fromPaused`). */
  isOpen: boolean
  area: { width: number, height: number }
  /** Sent: fly into the new note rather than close. */
  isFlight: boolean
  /** The view centred on the circle, measured for the flight. */
  roundRef: React.RefObject<React.ComponentRef<typeof View> | null>
  roundSize: number
}) {
  // No note landed in time: close the ordinary way after all.
  const [isFlightAbandoned, setIsFlightAbandoned] = useState(false)
  const isClosed = isClosing && (!isFlight || isFlightAbandoned)

  const open = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    open.set(withTiming(isClosed ? 0 : 1, { duration: ROUND_ANIMATION_MS, easing: DECELERATE }))
  }, [isClosed, open])

  // The ring and the buttons go as soon as the take ends, on a flight too
  // (`getButtonsLayout`, `getPaint` faded to 0).
  const chrome = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    chrome.set(withTiming(isClosing ? 0 : 1, { duration: ROUND_ANIMATION_MS, easing: DECELERATE }))
  }, [isClosing, chrome])

  // The round note flight: the camera circle moves onto the note
  // and scales to its size over 300ms - x on the default curve, y and scale
  // eased out-quint - then crossfades out over 100ms as the note shows.
  const fly = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  const flyScale = useSharedValue(1)
  const fade = useSharedValue(1)
  const roundSizeRef = useRef(roundSize)
  useLayoutEffect(() => {
    roundSizeRef.current = roundSize
  })

  const jsLanded = useCallback(() => {
    finishSendFlight('round')
    fade.set(withTiming(0, { duration: ROUND_FLIGHT_FADE_MS, easing: DECELERATE }))
  }, [fade])

  useEffect(() => {
    if (!isClosing || !isFlight)
      return

    let isWaiting = true
    let isFlying = false
    let off: (() => void) | undefined
    const timer = setTimeout(() => {
      isWaiting = false
      off?.()
      abandonSendFlight('round')
      setIsFlightAbandoned(true)
    }, SEND_FLIGHT_WAIT_MS)

    const unsubscribe = onSendFlightTarget('round', target => {
      if (!isWaiting)
        return

      isWaiting = false
      clearTimeout(timer)
      off?.()
      isFlying = true
      const node = roundRef.current
      const size = roundSizeRef.current
      if (!node || size <= 0) {
        isFlying = false
        jsLanded()
        return
      }

      node.measureInWindow((x, y, width, height) => {
        if (!isFlying)
          return

        flyX.set(target.x + target.size / 2 - (x + width / 2))
        flyY.set(target.y + target.size / 2 - (y + height / 2))
        flyScale.set(target.size / size)
        fly.set(withTiming(1, { duration: ROUND_FLIGHT_MS, easing: Easing.linear }, finished => {
          if (finished)
            runOnJS(jsLanded)()
        }))
      })
    })
    if (isWaiting)
      off = unsubscribe
    else
      unsubscribe()

    return () => {
      clearTimeout(timer)
      off?.()
      if (isWaiting)
        abandonSendFlight('round')
      // Torn down mid-flight: let the note show rather than stay hidden.
      if (isFlying && fly.value < 1)
        finishSendFlight('round')
      isFlying = false
    }
  }, [isClosing, isFlight, roundRef, fly, flyX, flyY, flyScale, jsLanded])

  const toX = isClosed && isSlideOut ? SLIDE_OUT_INSET - area.width / 2 : 0
  const toY = isOpen ? 0 : area.height / 2
  const roundStyle = useAnimatedStyle(() => {
    const quint = easeOutQuint(fly.value)
    return {
      opacity: open.value * fade.value,
      transform: [
        { translateX: toX * (1 - open.value) + flyX.value * easeDefault(fly.value) },
        { translateY: toY * (1 - open.value) + flyY.value * quint },
        { scale: (0.1 + 0.9 * open.value) * (1 + (flyScale.value - 1) * quint) },
      ],
    }
  })
  const controlsStyle = useAnimatedStyle(() => ({ opacity: open.value * chrome.value }))
  const ringStyle = useAnimatedStyle(() => ({ opacity: chrome.value }))
  return { roundStyle, controlsStyle, ringStyle }
}
