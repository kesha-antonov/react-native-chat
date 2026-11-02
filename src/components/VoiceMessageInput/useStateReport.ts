import { RefObject, useEffect, useLayoutEffect, useRef } from 'react'

import { RecordingMeter } from '../recordingMeter'
import { VoiceRecordingPreview, VoiceRecordingState } from './types'

interface UseStateReportOptions {
  onStateChange: ((state: VoiceRecordingState) => void) | undefined
  isActive: boolean
  isLocked: boolean
  cancelArmed: boolean
  preview: VoiceRecordingPreview | null
  meter: RecordingMeter
  levelsRef: RefObject<number[]>
}

/** Reports the take's state up through `onStateChange`, the running time on every tick. */
export function useStateReport ({
  onStateChange,
  isActive,
  isLocked,
  cancelArmed,
  preview,
  meter,
  levelsRef,
}: UseStateReportOptions) {
  // Surface recording state to the toolbar (timer/cancel bar live there).
  const reportRef = useRef<() => void>(() => {})
  useLayoutEffect(() => {
    reportRef.current = () => onStateChange?.({
      active: isActive,
      locked: isLocked,
      elapsed: meter.elapsed.get(),
      cancelArmed,
      levels: levelsRef.current,
      preview,
    })
  })
  useEffect(() => {
    reportRef.current()
  }, [onStateChange, isActive, isLocked, cancelArmed, preview])
  // The running time still reaches `onStateChange` on every tick.
  useEffect(() => meter.elapsed.subscribe(() => reportRef.current()), [meter])
}
