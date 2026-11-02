import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SharedValue } from 'react-native-reanimated'

import { useLabels } from '../../hooks/useLabels'
import {
  countLockHint,
  countPauseHint,
  recordingHaptic,
  shouldShowLockHint,
  shouldShowPauseHint,
} from '../recordingFeedback'
import {
  LOCK_HINT_DELAY_MS,
  LOCK_HINT_HIDE_PROGRESS,
  ONCE_HINT_LIMIT,
  ONCE_HINT_MS,
  PAUSE_HINT_MS,
} from './constants'
import { RecordButtonPhase } from './types'

let onceHintCount = 0

interface RecordHintsOptions {
  phase: RecordButtonPhase
  isVideo: boolean
  pauseHint?: string | null
  onPause?: () => void
  onToggleViewOnce?: () => void
  isViewOnce: boolean
  /** The slide progress JS last heard, to skip the lock hint mid-slide. */
  lastReported: SharedValue<number>
}

/**
 * The button's tooltips: "Slide up to lock", "Pause to trim or replay" and the
 * view-once hint, each shown for the first few takes and on its own timer.
 */
export function useRecordHints ({
  phase,
  isVideo,
  pauseHint,
  onPause,
  onToggleViewOnce,
  isViewOnce,
  lastReported,
}: RecordHintsOptions) {
  const labels = useLabels()
  const isLocked = phase === 'locked'

  // "Slide up to lock" for the first few takes, once the finger has been down
  // 200ms, never again once one is locked.
  const [isLockHintVisible, setIsLockHintVisible] = useState(false)
  useEffect(() => {
    if (phase !== 'recording' || !shouldShowLockHint()) {
      setIsLockHintVisible(false)
      return
    }

    const timer = setTimeout(() => {
      if (lastReported.value < LOCK_HINT_HIDE_PROGRESS)
        return

      setIsLockHintVisible(true)
      countLockHint()
    }, LOCK_HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [phase, lastReported])

  // "Pause to trim or replay" when a take is locked, for a few seconds.
  const [isPauseHintVisible, setIsPauseHintVisible] = useState(false)
  const hasPauseHint = !!pauseHint && !!onPause
  useEffect(() => {
    if (phase !== 'locked' || !hasPauseHint || !shouldShowPauseHint()) {
      setIsPauseHintVisible(false)
      return
    }

    setIsPauseHintVisible(true)
    countPauseHint()
    const timer = setTimeout(() => setIsPauseHintVisible(false), PAUSE_HINT_MS)
    return () => clearTimeout(timer)
  }, [phase, hasPauseHint])

  // The view-once tooltip (`showOnceHint`): on lock for the first few takes,
  // and again each time the toggle is switched on; switching it off hides it.
  const hasOnce = !!onToggleViewOnce && (phase === 'locked' || phase === 'preview')
  const [onceHint, setOnceHint] = useState<string | null>(null)
  const onceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showOnceHint = (text: string | null) => {
    if (onceHintTimerRef.current) {
      clearTimeout(onceHintTimerRef.current)
      onceHintTimerRef.current = null
    }
    setOnceHint(text)
    if (text)
      onceHintTimerRef.current = setTimeout(() => {
        onceHintTimerRef.current = null
        setOnceHint(null)
      }, ONCE_HINT_MS)
  }
  const showOnceHintRef = useRef(showOnceHint)
  // Read through refs so that only the lock itself shows the hint; the toggle handles the rest.
  const isViewOnceRef = useRef(isViewOnce)
  const viewOnceHintRef = useRef(labels.viewOnceHint)
  useLayoutEffect(() => {
    showOnceHintRef.current = showOnceHint
    isViewOnceRef.current = isViewOnce
    viewOnceHintRef.current = labels.viewOnceHint
  })
  const hasOnceToggle = !!onToggleViewOnce
  useEffect(() => {
    if (!isLocked || !hasOnceToggle || isViewOnceRef.current || onceHintCount >= ONCE_HINT_LIMIT)
      return

    onceHintCount = onceHintCount + 1
    showOnceHintRef.current(viewOnceHintRef.current)
  }, [isLocked, hasOnceToggle])
  useEffect(() => {
    if (!hasOnce)
      showOnceHintRef.current(null)
  }, [hasOnce])
  useEffect(() => () => {
    if (onceHintTimerRef.current)
      clearTimeout(onceHintTimerRef.current)
  }, [])
  const toggleOnce = () => {
    recordingHaptic()
    showOnceHint(isViewOnce ? null : isVideo ? labels.viewOnceVideoEnabledHint : labels.viewOnceVoiceEnabledHint)
    onToggleViewOnce?.()
  }

  return {
    isLockHintVisible,
    setIsLockHintVisible,
    isPauseHintVisible,
    setIsPauseHintVisible,
    hasOnce,
    onceHint,
    toggleOnce,
  }
}
