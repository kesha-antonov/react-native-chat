import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const unmountAfterFrames = (frames: number, unmount: () => void) => {
  if (frames <= 0)
    unmount()
  else
    requestAnimationFrame(() => unmountAfterFrames(frames - 1, unmount))
}

/**
 * Keeps an overlay mounted for its exit animation.
 *
 * A native `Modal` fade ends the moment `visible` turns false, so a Reanimated
 * exit needs the overlay to outlive that flag. `isMounted` turns true with
 * `visible` and only turns false once `animateOut` reports it has finished.
 *
 * `close(after)` is for exits the overlay starts itself (backdrop tap, a picked
 * item): it plays the exit first and calls `after` - usually the consumer's
 * `onDismiss` - once the exit has finished, so the callback never cuts the
 * animation short. A second call while closing is ignored, which also absorbs
 * the `visible = false` that `after` typically causes.
 *
 * `animateOut` must call `onDone` from its animation's completion callback
 * (through `runOnJS`) and only when the animation finished, so a reopen that
 * interrupts it does not unmount the overlay.
 *
 * `holdFrames` keeps the overlay mounted that many frames past `after`, for an
 * overlay whose `after` brings back what it covered: on Android a `Modal`'s window
 * goes the moment it unmounts, a frame before the screen under it redraws.
 */
export const useAnimatedPresence = (
  visible: boolean,
  animateIn: () => void,
  animateOut: (onDone: () => void) => void,
  holdFrames = 0
) => {
  const [isMounted, setIsMounted] = useState(visible)
  const [wasVisible, setWasVisible] = useState(visible)

  // Mount in the same render that `visible` turns true, so the first frame the
  // overlay paints is already the start of its entrance.
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible)
      setIsMounted(true)
  }

  const isOpenRef = useRef(false)
  const animateInRef = useRef(animateIn)
  const animateOutRef = useRef(animateOut)
  useLayoutEffect(() => {
    animateInRef.current = animateIn
    animateOutRef.current = animateOut
  })

  const close = useCallback((after?: () => void) => {
    if (!isOpenRef.current)
      return

    isOpenRef.current = false
    animateOutRef.current(() => {
      after?.()
      unmountAfterFrames(holdFrames, () => {
        // Reopened while held: it stays.
        if (!isOpenRef.current)
          setIsMounted(false)
      })
    })
  }, [holdFrames])

  useEffect(() => {
    if (visible) {
      isOpenRef.current = true
      animateInRef.current()
    } else {
      close()
    }
  }, [visible, close])

  return { isMounted, close }
}
