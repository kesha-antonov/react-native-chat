import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Reusable elapsed-time ticker that auto-stops at `maxMs`. */
export function useRecordingTimer (maxMs: number, onMax: () => void) {
  const [elapsed, setElapsed] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onMaxRef = useRef(onMax)
  useLayoutEffect(() => {
    onMaxRef.current = onMax
  })

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  const begin = useCallback(() => {
    startedAtRef.current = Date.now()
    setElapsed(0)
    setIsRecording(true)
    clear()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      if (ms >= maxMs)
        onMaxRef.current()
    }, 100)
  }, [clear, maxMs])

  const end = useCallback(() => {
    clear()
    setIsRecording(false)
  }, [clear])

  // Pausing freezes the clock; resuming shifts the start point forward by the
  // paused span so the elapsed time still matches the recorded footage.
  const pausedAtRef = useRef(0)

  const pause = useCallback(() => {
    pausedAtRef.current = Date.now()
    clear()
  }, [clear])

  const resume = useCallback(() => {
    if (pausedAtRef.current > 0) {
      startedAtRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = 0
    }

    clear()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      if (ms >= maxMs)
        onMaxRef.current()
    }, 100)
  }, [clear, maxMs])

  return { elapsed, isRecording, begin, end, pause, resume }
}
