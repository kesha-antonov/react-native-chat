import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { IMessage, VideoRecordingProps } from '../../Models'
import { createStore, Store } from '../../store'
import { discardRecording } from '../discardRecording'
import { stopAllPlayback } from '../mediaPlayback'
import { recordingHaptic } from '../recordingFeedback'
import { expectSendFlight } from '../sendFlight'
import {
  VideoNoteRecorderController,
  getCameraPermissionStatus,
  getMicrophonePermissionStatus,
  isVisionCameraAvailable,
  requestCameraPermission,
  requestMicrophonePermission,
} from '../visionCamera'
import {
  DEFAULT_MIN_DURATION_MS,
  DIM_ANIMATION_MS,
  FINISH_TIMEOUT_MS,
  FLIGHT_CLOSE_MS,
  LIMIT_LEAD_MS,
  PAUSE_HIDE_LEAD_MS,
  SLIDE_OUT_MIN_MS,
} from './constants'
import { canPreview } from './optional'
import { buttonPhaseOf, overlayKindOf, ringProgressOf, withFileScheme } from './sessionState'
import { ClosingTake, Phase, VideoNoteSession } from './types'
import { VideoNoteCaptureView } from './VideoNoteCaptureView'
import { VideoNotePreviewView } from './VideoNotePreviewView'
import { VideoNoteStage } from './VideoNoteStage'

/**
 * The round video note take, driven by the composer's own record
 * button: hold to record, release to send, slide left to cancel, slide up to
 * lock. The camera opens
 * under the finger and starts recording as soon as it is initialized. A
 * locked take can be paused and resumed: the recorder holds its file open, so
 * the take goes on in the same video. The time limit stops into a looping
 * preview of the finished file instead of sending.
 *
 * Only used when vision-camera's native module is linked; the system-camera
 * fallback keeps its tap-to-open button.
 */
export function useVideoNoteSession<TMessage extends IMessage = IMessage> ({
  config,
  onSend,
  elapsedStore: elapsedStoreProp,
}: {
  config?: VideoRecordingProps
  onSend?: (message: Partial<TMessage>, shouldResetInputToolbar: boolean) => void
  /**
   * Where the running time goes, ten times a second: a store, so a tick re-renders only what
   * shows it (the bar's timer, the ring) and not the composer. Kept after the take ends.
   */
  elapsedStore?: Store<number>
}): VideoNoteSession {
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const [ownElapsedStore] = useState(() => createStore(0))
  const elapsedStore = elapsedStoreProp ?? ownElapsedStore
  // Flips once, near the limit, rather than reading the time on every render.
  const [isPastPauseLead, setIsPastPauseLead] = useState(false)
  const [isFlashOn, setIsFlashOn] = useState(false)
  // A note starts on the front camera.
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  // View-once: off at the start of every take, read on send.
  const [isViewOnce, setIsViewOnce] = useState(false)
  const isViewOnceRef = useRef(false)
  // After a take ends, the overlay stays up a moment longer so the circle can
  // close and the dim fade out.
  const [closing, setClosing] = useState<ClosingTake | null>(null)

  const phaseRef = useRef<Phase>('idle')
  const cameraRef = useRef<VideoNoteRecorderController | null>(null)
  const startedAtRef = useRef(0)
  const durationRef = useRef(0)
  // The same take length, for rendering the paused take's preview.
  const [takeDurationMs, setTakeDurationMs] = useState(0)
  const takeRef = useRef(0)
  const recordingRef = useRef<VideoNoteRecorderController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewUriRef = useRef<string | null>(null)
  // Mirrors `elapsed` for `close`, which records it so the ring holds its last share.
  const elapsedRef = useRef(0)
  const discardRef = useRef(config?.onDiscardRecording)
  const configRef = useRef(config)
  const onSendRef = useRef(onSend)
  useLayoutEffect(() => {
    isViewOnceRef.current = isViewOnce
    configRef.current = config
    onSendRef.current = onSend
  })

  const maxMs = (config?.maxDuration ?? 60) * 1000
  const minDurationMs = config?.minDurationMs ?? DEFAULT_MIN_DURATION_MS

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current)
      finishTimeoutRef.current = null
    }
  }, [])

  const close = useCallback((isFlight = false) => {
    takeRef.current++
    const was = phaseRef.current
    if (was !== 'idle') {
      const recordedMs = was === 'recording'
        ? Date.now() - startedAtRef.current
        : was === 'preparing' ? 0 : durationRef.current
      if (closingTimerRef.current)
        clearTimeout(closingTimerRef.current)
      setClosing({
        kind: was === 'preview' && previewUriRef.current ? 'preview' : 'capture',
        isSlideOut: recordedMs > SLIDE_OUT_MIN_MS,
        uri: previewUriRef.current,
        isFlight,
        fromPhase: was,
        elapsed: elapsedRef.current,
      })
      closingTimerRef.current = setTimeout(() => {
        closingTimerRef.current = null
        setClosing(null)
      }, isFlight ? FLIGHT_CLOSE_MS : DIM_ANIMATION_MS)
    }

    const uri = previewUriRef.current
    previewUriRef.current = null
    if (uri && !isFlight)
      void discardRecording(uri, discardRef.current)
    recordingRef.current = null
    clearTimers()
    startedAtRef.current = 0
    setPhase('idle')
    setIsLocked(false)
    elapsedRef.current = 0
    setIsFlashOn(false)
    setPreviewUri(null)
  }, [clearTimers, setPhase])

  const abort = useCallback(() => {
    const recorder = recordingRef.current
    close()
    void recorder?.cancelRecording().catch(() => {})
  }, [close])

  const onCameraError = useCallback((error: unknown) => {
    if (phaseRef.current === 'idle')
      return
    abort()
    configRef.current?.onError?.(error)
  }, [abort])

  const stopCapture = useCallback(() => {
    const take = takeRef.current
    finishTimeoutRef.current = setTimeout(abort, FINISH_TIMEOUT_MS)
    void recordingRef.current?.stopRecording().catch(error => {
      if (take === takeRef.current)
        onCameraError(error)
    })
  }, [abort, onCameraError])

  const sendVideo = useCallback((uri: string) => {
    // Before `onSend`, which is what adds the note the circle flies into.
    expectSendFlight('round')
    onSendRef.current?.({
      video: uri,
      videoNote: true,
      duration: Math.round(durationRef.current / 1000),
      ...(isViewOnceRef.current ? { isViewOnce: true } : null),
    } as Partial<TMessage>, false)
  }, [])

  /**
   * Ends a recording take. `send` keeps the camera up until the file is
   * written, then sends it; `preview` waits for the same file and plays it
   * back; `cancel` drops it at once.
   */
  const stopTake = useCallback((outcome: 'send' | 'preview') => {
    const current = phaseRef.current

    // Released before the camera was up: nothing was recorded, so this is a
    // take that was too short, the same as a quick tap on the button.
    if (current === 'preparing') {
      close()
      configRef.current?.onTooShort?.()
      return
    }

    if (current !== 'recording')
      return

    const duration = Date.now() - startedAtRef.current
    const isTooShort = duration < minDurationMs

    if (isTooShort) {
      // Cancel closes the camera.
      abort()
      configRef.current?.onTooShort?.()
      return
    }

    durationRef.current = duration
    setTakeDurationMs(duration)
    elapsedStore.set(duration)
    clearTimers()
    setPhase(outcome === 'preview' ? 'stopping' : 'finishing')
    stopCapture()
  }, [close, abort, clearTimers, setPhase, stopCapture, minDurationMs, elapsedStore])

  const stopTakeRef = useRef(stopTake)
  useLayoutEffect(() => {
    stopTakeRef.current = stopTake
  })

  const start = useCallback(() => {
    if (!configRef.current || AppState.currentState === 'background' || phaseRef.current !== 'idle' || !isVisionCameraAvailable)
      return

    // Recording takes the audio over: pause whatever note is
    // playing so it does not end up in the take.
    stopAllPlayback()

    const hasCamera = getCameraPermissionStatus() === 'authorized'
    const hasMicrophone = getMicrophonePermissionStatus() === 'authorized'

    // The permission prompt takes the finger off the button anyway, so ask and
    // stop here; the next hold records.
    if (!hasCamera || !hasMicrophone) {
      // `.catch` rather than try/catch: the compiler cannot lower the `||` and optional
      // calls inside a `try`.
      ;(async () => {
        const camera = hasCamera || await requestCameraPermission()
        const mic = hasMicrophone || await requestMicrophonePermission()
        if (!camera || !mic)
          configRef.current?.onPermissionDenied?.()
      })().catch(error => {
        configRef.current?.onError?.(error)
      })
      return
    }

    takeRef.current++
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current)
      closingTimerRef.current = null
    }
    setClosing(null)
    // Reset here rather than on close, so the closing circle does not flip.
    setFacing('front')
    setIsViewOnce(false)
    setPhase('preparing')
  }, [setPhase])

  /** Runs the take's clock from `fromMs`, as recording starts or resumes. */
  const startTicking = useCallback((fromMs: number) => {
    startedAtRef.current = Date.now() - fromMs
    setPhase('recording')
    clearTimers()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      elapsedRef.current = ms
      elapsedStore.set(ms)
      setIsPastPauseLead(ms >= maxMs - PAUSE_HIDE_LEAD_MS)
      // Out of time: stop into the preview, or send without a player for it.
      if (ms >= maxMs - LIMIT_LEAD_MS)
        stopTakeRef.current(canPreview ? 'preview' : 'send')
    }, 100)
  }, [clearTimers, setPhase, maxMs, elapsedStore])

  // The overlay's camera is ready: start the take. A flip mid-take
  // re-initializes the camera too, which this ignores.
  const onCameraReady = useCallback(() => {
    if (phaseRef.current !== 'preparing')
      return

    const recorder = cameraRef.current
    if (!recorder) {
      close()
      return
    }

    const take = takeRef.current
    const discard = configRef.current?.onDiscardRecording
    discardRef.current = discard
    recordingRef.current = recorder
    recorder.startRecording({
      onRecordingFinished: (video: { path: string }) => {
        const uri = withFileScheme(video.path)
        if (take !== takeRef.current) {
          void discardRecording(uri, discard)
          return
        }
        if (phaseRef.current === 'stopping') {
          clearTimers()
          previewUriRef.current = uri
          setPreviewUri(uri)
          setPhase('preview')
          return
        }
        if (phaseRef.current === 'finishing' && onSendRef.current) {
          close(true)
          sendVideo(uri)
          return
        }
        void discardRecording(uri, discard)
        if (phaseRef.current === 'finishing')
          close()
        else
          onCameraError(new Error('Recording interrupted'))
      },
      onRecordingError: (error: unknown) => {
        if (take === takeRef.current)
          onCameraError(error)
      },
    })

    // Tick when the round take actually starts recording.
    recordingHaptic()
    elapsedRef.current = 0
    elapsedStore.set(0)
    setIsPastPauseLead(false)
    startTicking(0)
  }, [close, clearTimers, setPhase, sendVideo, elapsedStore, startTicking, onCameraError])

  const lock = useCallback(() => {
    if (phaseRef.current === 'preparing' || phaseRef.current === 'recording')
      setIsLocked(true)
  }, [])

  const finish = useCallback((cancelled: boolean) => {
    if (cancelled) {
      abort()
      return
    }
    if (phaseRef.current === 'paused') {
      setPhase('finishing')
      stopCapture()
      return
    }

    if (phaseRef.current === 'preview') {
      const uri = previewUriRef.current
      if (uri && onSendRef.current) {
        close(true)
        sendVideo(uri)
      } else {
        close()
      }
      return
    }

    stopTake('send')
  }, [abort, stopTake, sendVideo, close, setPhase, stopCapture])

  const send = useCallback(() => finish(false), [finish])

  // Pause holds the recording open (vision-camera's recorder pauses natively), so Resume carries on
  // in the same file: nothing can join two takes afterwards. The camera stays live meanwhile.
  const pause = useCallback(() => {
    if (phaseRef.current !== 'recording')
      return
    const duration = Date.now() - startedAtRef.current
    durationRef.current = duration
    setTakeDurationMs(duration)
    elapsedRef.current = duration
    elapsedStore.set(duration)
    clearTimers()
    setPhase('paused')
    const take = takeRef.current
    void recordingRef.current?.pauseRecording().catch(error => {
      if (take === takeRef.current)
        onCameraError(error)
    })
  }, [clearTimers, setPhase, elapsedStore, onCameraError])

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused')
      return
    // The resume button plays its own tick.
    setIsLocked(true)
    startTicking(durationRef.current)
    const take = takeRef.current
    void recordingRef.current?.resumeRecording().catch(error => {
      if (take === takeRef.current)
        onCameraError(error)
    })
  }, [startTicking, onCameraError])

  // Leaving the chat mid-take must not leave the camera recording into an
  // orphaned file.
  useLayoutEffect(() => {
    if (!config && phaseRef.current !== 'idle')
      abort()
  }, [config, abort])

  useLayoutEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' && phaseRef.current !== 'idle' && phaseRef.current !== 'preview')
        abort()
    })
    return () => subscription?.remove()
  }, [abort])

  useLayoutEffect(() => () => {
    takeRef.current++
    clearTimers()
    if (closingTimerRef.current)
      clearTimeout(closingTimerRef.current)
    void recordingRef.current?.cancelRecording().catch(() => {})
    const uri = previewUriRef.current
    previewUriRef.current = null
    if (uri)
      void discardRecording(uri, discardRef.current)
  }, [clearTimers])

  const toggleViewOnce = useCallback(() => {
    setIsViewOnce(current => !current)
  }, [])

  const toggleFlash = useCallback(() => {
    setIsFlashOn(current => !current)
  }, [])

  // Flipping the camera works mid-take, thanks to
  // vision-camera's persistent recorder (`enablePersistentRecorder` below):
  // Android records with CameraX's persistent recording, which survives the
  // camera being rebound, and iOS keeps appending the new camera's frames to
  // the same asset writer.
  const flipCamera = useCallback(() => {
    setFacing(current => (current === 'front' ? 'back' : 'front'))
  }, [])

  const isRecording = phase === 'recording'
  const isClosing = phase === 'idle' && !!closing

  const isPaused = phase === 'paused'
  const progress = ringProgressOf(phase, closing, elapsedStore, maxMs)

  const overlayKind = overlayKindOf(phase, closing, previewUri)
  const overlayUri = previewUri ?? closing?.uri ?? null

  const overlay = !overlayKind
    ? null
    : (
      // One stage across capture -> preview -> closed, so the dim fades in
      // once and out once.
      <VideoNoteStage isClosing={isClosing}>
        {overlayKind === 'preview' && overlayUri
          ? (
            <VideoNotePreviewView
              uri={overlayUri}
              isClosing={isClosing}
              isSlideOut={!!closing?.isSlideOut}
              isFlight={!!closing?.isFlight}
            />
          )
          : (
            <VideoNoteCaptureView
              cameraRef={cameraRef}
              facing={facing}
              isFlashOn={isFlashOn}
              isRecording={isRecording}
              isPaused={isPaused}
              isClosing={isClosing}
              isSlideOut={!!closing?.isSlideOut}
              isFlight={!!closing?.isFlight}
              progress={progress}
              onReady={onCameraReady}
              onError={onCameraError}
              onToggleFlash={toggleFlash}
              onFlip={flipCamera}
            />
          )}
      </VideoNoteStage>
    )

  const buttonPhase = buttonPhaseOf(phase, isLocked)

  const canPause = isRecording && !isPastPauseLead

  return {
    isActive: phase !== 'idle',
    isLocked,
    isCapturing: isRecording,
    buttonPhase,
    preview: phase === 'preview' || isPaused ? { durationMs: takeDurationMs } : null,
    start,
    finish,
    lock,
    pause: canPause ? pause : undefined,
    resume: isPaused ? resume : undefined,
    send,
    isViewOnce,
    toggleViewOnce: config?.isViewOnceEnabled ? toggleViewOnce : undefined,
    overlay,
  }
}
