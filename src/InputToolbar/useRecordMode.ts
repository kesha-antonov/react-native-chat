import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { getLastRecordMode, setLastRecordMode } from '../components/recordingFeedback'
import { useLabels } from '../hooks/useLabels'

/** How long a record-button tooltip stays up. */
const HINT_DURATION_MS = 3000

interface UseRecordModeOptions {
  /** Both voice and video are offered, so a tap on the record button switches between them. */
  canToggleMode: boolean
  isVoiceEnabled: boolean
  isTakeInProgress: boolean
}

/**
 * Which note the record button takes, voice or video, and the tooltip over it that explains
 * a switch or a tap that was too short to record.
 */
export function useRecordMode ({ canToggleMode, isVoiceEnabled, isTakeInProgress }: UseRecordModeOptions) {
  const labels = useLabels()

  const [recordMode, setRecordMode] = useState<'voice' | 'video'>(getLastRecordMode)
  const mode = canToggleMode ? recordMode : (isVoiceEnabled ? 'voice' : 'video')

  // A tooltip over the record button: after a mode switch, or after a tap on a
  // single-mode button.
  const [recordHint, setRecordHint] = useState<string | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showRecordHint = useCallback((hint: string) => {
    if (hintTimerRef.current)
      clearTimeout(hintTimerRef.current)
    setRecordHint(hint)
    hintTimerRef.current = setTimeout(() => setRecordHint(null), HINT_DURATION_MS)
  }, [])
  useEffect(() => () => {
    if (hintTimerRef.current)
      clearTimeout(hintTimerRef.current)
  }, [])

  // Read through a ref so the callback stays stable: it is the record button's
  // `onTap`, and a new identity would rebuild the gesture mid-hold.
  const isTakeInProgressRef = useRef(isTakeInProgress)
  const labelsRef = useRef(labels)
  useLayoutEffect(() => {
    isTakeInProgressRef.current = isTakeInProgress
    labelsRef.current = labels
  })

  const toggleRecordMode = useCallback(() => {
    // Never switch under a take in progress.
    if (isTakeInProgressRef.current)
      return

    setRecordMode(current => {
      const next = current === 'voice' ? 'video' : 'voice'
      setLastRecordMode(next)
      showRecordHint(next === 'voice'
        ? labelsRef.current.holdToRecordAudioSwitch
        : labelsRef.current.holdToRecordVideoSwitch)
      return next
    })
  }, [showRecordHint])

  const onVoiceQuickRelease = useCallback(() => {
    showRecordHint(labelsRef.current.holdToRecordAudioOnly)
  }, [showRecordHint])

  const onVideoQuickRelease = useCallback(() => {
    showRecordHint(labelsRef.current.holdToRecordVideoOnly)
  }, [showRecordHint])

  return { mode, recordHint, toggleRecordMode, onVoiceQuickRelease, onVideoQuickRelease }
}
