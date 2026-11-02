import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { IMessage } from '../../Models'
import { stopAllPlayback } from '../mediaPlayback'
import { VideoNoteRecorderController, createVideoNoteRecorder } from '../visionCamera'
import { withFileScheme } from './constants'
import { VideoNoteRecorderProps } from './types'
import { useRecordingTimer } from './useRecordingTimer'

interface Options<TMessage extends IMessage> extends VideoNoteRecorderProps<TMessage> {
  /** The vision-camera video output the recorder records through. */
  videoOutput: any
  /** A device and camera permission are both present. */
  canRecord: boolean
}

/**
 * The recording controller behind the live recorder: start / stop / pause on
 * the persistent recorder, the elapsed-time ticker, the lock and pause state,
 * and the abort paths that keep a cancelled take from being posted.
 */
export function useVideoNoteRecording<TMessage extends IMessage = IMessage> ({
  config,
  onClose,
  onSend,
  videoOutput,
  canRecord,
}: Options<TMessage>) {
  const recorder = useMemo(() => createVideoNoteRecorder(videoOutput), [videoOutput])
  const cameraRef = useRef<VideoNoteRecorderController>(recorder)
  useLayoutEffect(() => {
    cameraRef.current = recorder
  })
  const maxMs = (config?.maxDuration ?? 60) * 1000
  const minDurationMs = config?.minDurationMs ?? 800
  const startedAtRef = useRef(0)
  // Set once the user abandons the recorder, so a capture callback that lands
  // afterwards discards its file instead of posting the note they cancelled.
  const abortedRef = useRef(false)

  const finish = useCallback((uri: string | null) => {
    const duration = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0

    if (uri && !abortedRef.current)
      if (duration >= minDurationMs)
        onSend?.({
          video: uri,
          videoNote: true,
          duration: Math.round(duration / 1000),
        } as Partial<TMessage>, false)
      else
        config?.onTooShort?.()

    startedAtRef.current = 0
    onClose()
  }, [onSend, onClose, minDurationMs, config])

  const stopRef = useRef<() => void>(() => {})

  const { elapsed, isRecording, begin, end, pause, resume } = useRecordingTimer(maxMs, () => stopRef.current())

  const stopRecording = useCallback(async () => {
    end()
    try {
      await cameraRef.current.stopRecording()
    } catch (error) {
      config?.onError?.(error)
      finish(null)
    }
  }, [end, config, finish])
  useLayoutEffect(() => {
    stopRef.current = stopRecording
  })

  const startRecording = useCallback(() => {
    if (!canRecord)
      return

    // Pause whatever note is playing so it does not end up in the take.
    stopAllPlayback()
    begin()
    startedAtRef.current = Date.now()
    try {
      cameraRef.current.startRecording({
        onRecordingFinished: (video: { path: string }) => finish(withFileScheme(video.path)),
        onRecordingError: (error: unknown) => {
          config?.onError?.(error)
          finish(null)
        },
      })
    } catch (error) {
      config?.onError?.(error)
      finish(null)
    }
  }, [begin, finish, config, canRecord])

  // Abandoning the recorder must stop the capture: otherwise vision-camera keeps
  // recording into an orphaned file and its completion callback posts the note.
  const abort = useCallback(() => {
    abortedRef.current = true
    end()
    cameraRef.current.stopRecording().catch(() => {})
    onClose()
  }, [end, onClose])

  // Covers teardown routes that bypass the X button (Android hardware back,
  // a parent closing the modal): mark aborted and stop the capture.
  useEffect(() => () => {
    abortedRef.current = true
    cameraRef.current.stopRecording().catch(() => {})
  }, [])

  // Locking mirrors the voice recorder: slide up while holding the shutter and
  // recording continues hands-free until Send or the trash is pressed.
  const [isLocked, setIsLocked] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const onShutterStart = useCallback(() => {
    if (isRecording)
      return

    startRecording()
  }, [isRecording, startRecording])

  const onShutterStop = useCallback(() => {
    setIsLocked(false)
    stopRecording()
  }, [stopRecording])

  // Cancelling closes the recorder; it used to stay open
  // on a dimmed screen that then had to be dismissed by hand.
  const onShutterCancel = useCallback(() => {
    setIsLocked(false)
    abort()
  }, [abort])

  const togglePause = useCallback(async () => {
    try {
      if (isPaused) {
        await cameraRef.current.resumeRecording()
        setIsPaused(false)
        resume()
      } else {
        await cameraRef.current.pauseRecording()
        setIsPaused(true)
        pause()
      }
    } catch (error) {
      config?.onError?.(error)
    }
  }, [isPaused, config, pause, resume])

  return {
    elapsed,
    maxMs,
    isRecording,
    isLocked,
    setIsLocked,
    isPaused,
    onShutterStart,
    onShutterStop,
    onShutterCancel,
    abort,
    togglePause,
  }
}
