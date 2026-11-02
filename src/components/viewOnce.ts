import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/**
 * A view-once note plays a single time. Once it has
 * started, finishing it - at its end, or by being stopped - spends it, and the
 * app is told exactly once so it can remove the message. A pause does not
 * spend it: the note is still being listened to.
 */
export interface ViewOnceTracker {
  /** Playback started. Returns false for a spent note, which must not play. */
  start: () => boolean
  /** The note ended or was stopped; spends it if it had started. */
  end: () => boolean
  hasStarted: () => boolean
  isSpent: () => boolean
}

const noop = () => {}

export const createViewOnceTracker = (isViewOnce: boolean, onEnd: () => void): ViewOnceTracker => {
  let hasStarted = false
  let isSpent = false

  return {
    start () {
      if (isSpent)
        return false
      if (isViewOnce)
        hasStarted = true
      return true
    },
    end () {
      if (!isViewOnce || !hasStarted || isSpent)
        return false
      isSpent = true
      onEnd()
      return true
    },
    hasStarted: () => hasStarted,
    isSpent: () => isSpent,
  }
}

/**
 * View-once state for one player. `onStart` gates playback; `onEnd` spends the
 * note. A note that started and then unmounts (scrolled away, chat closed)
 * counts as ended too, as closing a view-once player does.
 */
export const useViewOnce = <TMessage >(
  message: TMessage | undefined,
  messageId: string | number | undefined,
  isViewOnce: boolean,
  onViewOnceEnd: ((message: TMessage) => void) | undefined
) => {
  const [hasStarted, setHasStarted] = useState(false)
  const [isSpent, setIsSpent] = useState(false)
  const notifyRef = useRef(() => {})
  useLayoutEffect(() => {
    notifyRef.current = () => {
      if (message)
        onViewOnceEnd?.(message)
    }
  })

  const key = `${isViewOnce}:${messageId}`
  // One tracker per note: a recycled row showing another message starts afresh. The app is
  // told here, where `end()` reports spending the note, rather than through the tracker's
  // callback, so render never hands a ref-reading closure to it.
  const { tracker } = useMemo(
    () => ({ key, tracker: createViewOnceTracker(isViewOnce, noop) }),
    [key, isViewOnce]
  )

  useEffect(() => {
    setHasStarted(false)
    setIsSpent(false)
  }, [key])

  useEffect(() => () => {
    if (tracker.end())
      notifyRef.current()
  }, [tracker])

  return {
    hasStarted: isViewOnce && hasStarted,
    isSpent: isViewOnce && isSpent,
    onStart: () => {
      const canPlay = tracker.start()
      if (canPlay && isViewOnce)
        setHasStarted(true)
      return canPlay
    },
    onEnd: () => {
      if (!tracker.end())
        return
      notifyRef.current()
      setIsSpent(true)
    },
  }
}
