import { useCallback, useRef } from 'react'
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated'

import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { selectionHaptic } from '../haptics'
import {
  BAR_IN,
  CLOSE_MS,
  DECELERATE,
  EASE_OUT_QUINT,
  SCRIM_MS,
  timing,
} from './constants'

/**
 * The overlay's open and close: the scrim, the card unrolling, the bar popping out, and the
 * exit, which waits for a reaction still flying to the message (`isFlying`) before the
 * overlay unmounts.
 */
export const useMenuPresence = (visible: boolean, revealMs: number, isFlying: () => boolean) => {
  const scrim = useSharedValue(0)
  const reveal = useSharedValue(0)
  const barIn = useSharedValue(0)
  const closing = useSharedValue(0)
  const expand = useSharedValue(0)
  const menuFade = useSharedValue(1)

  const pendingRef = useRef(0)
  const exitDoneRef = useRef<(() => void) | null>(null)

  const settle = useCallback(() => {
    pendingRef.current -= 1
    if (pendingRef.current > 0)
      return

    const done = exitDoneRef.current
    exitDoneRef.current = null
    done?.()
  }, [])

  const onFlightEnd = useCallback(() => {
    selectionHaptic()
    settle()
  }, [settle])

  const animateIn = useCallback(() => {
    // The same overlay opens again for the next long-press, so every open starts from rest;
    // a panel left expanded would reopen empty.
    expand.set(0)
    closing.set(0)
    menuFade.set(1)
    barIn.set(0)
    reveal.set(0)
    scrim.set(withTiming(1, timing(SCRIM_MS, EASE_OUT_QUINT)))
    reveal.set(withTiming(1, timing(revealMs)))
    barIn.set(withTiming(1, BAR_IN))
  }, [scrim, reveal, barIn, closing, expand, menuFade, revealMs])

  const animateOut = useCallback((onDone: () => void) => {
    exitDoneRef.current = onDone
    // The flight (if any) and the scrim both have to finish.
    pendingRef.current = isFlying() ? 2 : 1

    closing.set(withTiming(1, timing(CLOSE_MS, DECELERATE)))
    scrim.set(withTiming(0, timing(SCRIM_MS, EASE_OUT_QUINT), finished => {
      if (finished)
        runOnJS(settle)()
    }))
  }, [scrim, closing, settle, isFlying])

  const { isMounted, close } = useAnimatedPresence(visible, animateIn, animateOut)

  return { scrim, reveal, barIn, closing, expand, menuFade, onFlightEnd, isMounted, close }
}
