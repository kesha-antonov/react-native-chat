import { ComponentRef, RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import {
  SEND_FLIGHT_SAFETY_MS,
  isSendFlightExpected,
  landSendFlight,
  onSendFlightFinished,
} from '../components/sendFlight'

// A just-sent round note's row stays at alpha 0 while the
// camera circle flies onto it, then shows it at once: it is the same picture.
export const useSendFlightReveal = (
  animateAppear: boolean | undefined,
  noteRef: RefObject<ComponentRef<typeof View> | null>
) => {
  const [appearOnMount] = useState(!!animateAppear)
  const flightReveal = useSharedValue(appearOnMount && isSendFlightExpected('round') ? 0 : 1)
  const hasLandedRef = useRef(false)
  const flightCleanupRef = useRef<(() => void) | null>(null)
  const onNoteLayout = useCallback(() => {
    if (!appearOnMount || hasLandedRef.current)
      return

    hasLandedRef.current = true
    const node = noteRef.current
    if (!node) {
      flightReveal.set(1)
      return
    }

    node.measureInWindow((x, y, width) => {
      if (!(width > 0 && landSendFlight('round', { x, y, size: width }))) {
        flightReveal.set(1)
        return
      }

      const show = () => {
        clearTimeout(safety)
        off()
        flightReveal.set(1)
      }
      const safety = setTimeout(show, SEND_FLIGHT_SAFETY_MS)
      const off = onSendFlightFinished('round', show)
      flightCleanupRef.current = () => {
        clearTimeout(safety)
        off()
      }
    })
  }, [appearOnMount, flightReveal, noteRef])
  useEffect(() => () => flightCleanupRef.current?.(), [])
  const flightRevealStyle = useAnimatedStyle(() => ({ opacity: flightReveal.get() }))

  return { onNoteLayout, flightRevealStyle }
}
