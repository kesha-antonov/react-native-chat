import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { IMessage } from '../../Models'
import { discardRecording } from '../discardRecording'
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
  const takeRef = useRef<{ recorder: VideoNoteRecorderController, duration: number | null } | null>(null)

  const finish = useCallback((uri: string | null, duration: number | null) => {
    takeRef.current = null
    startedAtRef.current = 0
    if (uri)
      if (duration !== null && duration >= minDurationMs && onSend) {
        onSend({
          video: uri,
          videoNote: true,
          duration: Math.round(duration / 1000),
        } as Partial<TMessage>, false)
      } else {
        void discardRecording(uri, config?.onDiscardRecording)
        if (duration === null)
          config?.onError?.(new Error('Recording interrupted'))
        else if (duration < minDurationMs)
          config?.onTooShort?.()
      }

    onClose()
  }, [onSend, onClose, minDurationMs, config])

  const stopRef = useRef<() => void>(() => {})

  const { elapsed, isRecording, begin, end, pause, resume } = useRecordingTimer(maxMs, () => stopRef.current())

  const stopRecording = useCallback(async () => {
    const take = takeRef.current
    if (!take || take.duration !== null)
      return
    take.duration = Date.now() - startedAtRef.current
    end()
    await take.recorder.stopRecording().catch(error => {
      if (take === takeRef.current) {
        void take.recorder.cancelRecording().catch(() => {})
        finish(null, null)
        config?.onError?.(error)
      }
    })
  }, [end, config, finish])
  useLayoutEffect(() => {
    stopRef.current = stopRecording
  })

  const startRecording = useCallback(() => {
    if (!canRecord || takeRef.current)
      return

    // Pause whatever note is playing so it does not end up in the take.
    stopAllPlayback()
    begin()
    startedAtRef.current = Date.now()
    const take: { recorder: VideoNoteRecorderController, duration: number | null } = { recorder: cameraRef.current, duration: null }
    takeRef.current = take
    take.recorder.startRecording({
      onRecordingFinished: (video: { path: string }) => {
        const uri = withFileScheme(video.path)
        if (take === takeRef.current)
          finish(uri, take.duration)
        else
          void discardRecording(uri, config?.onDiscardRecording)
      },
      onRecordingError: (error: unknown) => {
        if (take === takeRef.current) {
          finish(null, null)
          config?.onError?.(error)
        }
      },
    })
  }, [begin, finish, config, canRecord])

  const cancelCapture = useCallback(() => {
    const take = takeRef.current
    takeRef.current = null
    void take?.recorder.cancelRecording().catch(() => {})
  }, [])

  const abort = useCallback(() => {
    cancelCapture()
    end()
    onClose()
  }, [cancelCapture, end, onClose])

  useLayoutEffect(() => cancelCapture, [cancelCapture, recorder])

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
    const take = takeRef.current
    if (!take || take.duration !== null)
      return
    const operation = isPaused ? take.recorder.resumeRecording() : take.recorder.pauseRecording()
    await operation.then(() => {
      if (take !== takeRef.current || take.duration !== null)
        return
      setIsPaused(!isPaused)
      if (isPaused)
        resume()
      else
        pause()
    }).catch(error => {
      if (take === takeRef.current) {
        abort()
        config?.onError?.(error)
      }
    })
  }, [isPaused, config, pause, resume, abort])

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
