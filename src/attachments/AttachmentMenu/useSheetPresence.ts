import { useCallback } from 'react'
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { CLOSE, DIM_IN, REDUCE_MOTION, SHEET_SPRING } from './constants'

/** The sheet's rise and the dim behind it, keeping the sheet mounted until it has left. */
export function useSheetPresence (visible: boolean, screenHeight: number) {
  const open = useSharedValue(0)
  const dim = useSharedValue(0)

  const animateIn = useCallback(() => {
    open.set(0)
    dim.set(0)
    open.set(withSpring(1, SHEET_SPRING))
    dim.set(withDelay(20, withTiming(1, DIM_IN), REDUCE_MOTION))
  }, [open, dim])
  const animateOut = useCallback((onDone: () => void) => {
    dim.set(withTiming(0, CLOSE))
    open.set(withTiming(0, CLOSE, finished => {
      if (finished)
        runOnJS(onDone)()
    }))
  }, [open, dim])
  const { isMounted, close } = useAnimatedPresence(visible, animateIn, animateOut)

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.value) * screenHeight }],
  }))
  const dimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, dim.value) }))

  return { isMounted, close, sheetStyle, dimStyle }
}
