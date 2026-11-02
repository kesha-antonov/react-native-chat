import { usePanGesture } from 'react-native-gesture-handler'
import { SharedValue, useSharedValue } from 'react-native-reanimated'

export interface RowSwipeOptions {
  testID?: string
  isEnabled: boolean
  /** Which way the row moves: -1 to the left, 1 to the right. */
  sign: 1 | -1
  /** How far the finger goes sideways before the swipe takes the touch. */
  activeOffsetX: number
  /** How far it may go up or down first; past that the list scrolls instead. */
  failOffsetY: number
  /** How far the row must travel for letting go to act. */
  threshold: number
  /** Count the travel from where the swipe took the touch, so the row does not jump. */
  isMeasuredFromStart?: boolean
  /** The farthest the row follows the finger. */
  maxDistance?: number
  /** Worklet: the swipe took the touch. */
  onActivate?: () => void
  /** Worklet: the row moved, `distance` along `sign`, before `offset` is written. */
  onMove?: (distance: number) => void
  /** Worklet: the row crossed the threshold, either way. */
  onThresholdChange?: (isPast: boolean) => void
  /**
   * Worklet: the finger lifted. A cancelled swipe reports neither past the threshold nor any
   * velocity, so it only puts the row back. `velocity` is along `sign`. The row's `offset` is
   * handed in rather than read from the hook's result, which a worklet created in the same call
   * cannot capture yet.
   */
  onRelease?: (isPast: boolean, velocity: number, offset: SharedValue<number>) => void
  /** Worklet: the swipe ended, however it ended; animate `offset` back here. */
  onFinalize?: (offset: SharedValue<number>) => void
}

/**
 * A row that follows a sideways swipe and acts past a threshold: swipe-to-reply on a message,
 * swipe-to-archive in the chat list. It owns the gesture, the row's offset and the threshold
 * crossing; each caller draws its own action and decides how the row goes back.
 */
export function useRowSwipe ({
  testID,
  isEnabled,
  sign,
  activeOffsetX,
  failOffsetY,
  threshold,
  isMeasuredFromStart = false,
  maxDistance = Number.MAX_SAFE_INTEGER,
  onActivate,
  onMove,
  onThresholdChange,
  onRelease,
  onFinalize,
}: RowSwipeOptions) {
  // The gesture's callbacks must stay inline in `usePanGesture`'s config: compiled, they are
  // hoisted into memo blocks, where the worklets plugin no longer finds them, and the swipe runs
  // nothing on the UI thread. The 'worklet' directives below say it outright as well.
  'use no memo'
  // The row's offset along the swipe, signed; callers animate it back.
  const offset = useSharedValue(0)
  const isPast = useSharedValue(false)

  const gesture = usePanGesture({
    testID,
    enabled: isEnabled,
    activeOffsetX: sign < 0
      ? [-activeOffsetX, Number.MAX_SAFE_INTEGER]
      : [-Number.MAX_SAFE_INTEGER, activeOffsetX],
    failOffsetY: [-failOffsetY, failOffsetY],
    onActivate: () => {
      'worklet'
      onActivate?.()
    },
    onUpdate: event => {
      'worklet'
      const travelled = event.translationX * sign - (isMeasuredFromStart ? activeOffsetX : 0)
      const distance = Math.min(maxDistance, Math.max(0, travelled))
      onMove?.(distance)
      offset.set(distance * sign)

      // Only on a change: callers start animations and haptics here.
      const past = distance >= threshold
      if (past !== isPast.get()) {
        isPast.set(past)
        onThresholdChange?.(past)
      }
    },
    onDeactivate: event => {
      'worklet'
      onRelease?.(
        !event.canceled && isPast.get(),
        event.canceled ? 0 : event.velocityX * sign,
        offset
      )
    },
    onFinalize: () => {
      'worklet'
      onFinalize?.(offset)
      isPast.set(false)
    },
  })

  return { gesture, offset, isPast }
}
