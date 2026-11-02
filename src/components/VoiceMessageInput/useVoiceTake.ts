import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useLabels } from '../../hooks/useLabels'
import { IMessage } from '../../Models'
import { stopAllPlayback } from '../mediaPlayback'
import { RecordButtonPhase } from '../RecordButton'
import { createRecordingMeter, RecordingMeterContext } from '../recordingMeter'
import { clipsDuration, clipsLevels, createClip, isVoiceTrimAvailable, renderClips, VoiceClip } from '../voiceEditing'
import { CANCEL_ARMED_PROGRESS, DEFAULT_MIN_DURATION_MS, IDLE_STATE, LEVEL_HISTORY, MIN_CLIP_MS } from './constants'
import { expoAudio, normalizeMetering, releaseAudioSession, stopRecorderQuietly, viewOnceFields } from './recorder'
import { PendingFinish, VoiceMessageInputHandle, VoiceMessageInputProps, VoiceRecordingPreview } from './types'
import { useLazyRecorder } from './useLazyRecorder'
import { useStateReport } from './useStateReport'
import { useTakePreviewActions } from './useTakePreviewActions'

type UseVoiceTakeOptions = Pick<VoiceMessageInputProps, 'config' | 'onSend' | 'onStateChange'>

/**
 * The voice take's state machine: recording, locked, paused into a preview,
 * resumed, and finally sent or dropped. Owns the recorder, its 100ms tick
 * into the recording meter, and what `onStateChange` reports.
 */
export function useVoiceTake (
  { config, onSend, onStateChange }: UseVoiceTakeOptions,
  ref: React.Ref<VoiceMessageInputHandle>
) {
  const { recorderOptions, recorderRef, getRecorder } = useLazyRecorder()
  const labels = useLabels()

  const [isRecording, setIsRecording] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [cancelArmed, setCancelArmed] = useState(false)
  // The running time and loudness tick ten times a second, so they go to the meter's stores
  // (the composer's, inside one) instead of state: a tick re-renders the timer alone.
  const contextMeter = useContext(RecordingMeterContext)
  const [ownMeter] = useState(createRecordingMeter)
  const meter = contextMeter ?? ownMeter
  // The recent levels, oldest first, for `onStateChange`.
  const levelsRef = useRef<number[]>([])
  const [preview, setPreview] = useState<VoiceRecordingPreview | null>(null)
  // Between the resume tap and the recorder going live, so the bar and the
  // button stay on the locked take instead of flashing the idle composer.
  const [isResuming, setIsResuming] = useState(false)
  // While a paused take is being joined into its preview file, which takes
  // a moment once it has been trimmed, so the bar stays put meanwhile.
  const [isJoining, setIsJoining] = useState(false)
  // View-once: off at the start of a take but kept across its
  // pauses and resumes, read when it is sent.
  const [isViewOnce, setIsViewOnce] = useState(false)
  const isViewOnceRef = useRef(false)
  useLayoutEffect(() => {
    isViewOnceRef.current = isViewOnce
  })
  const toggleViewOnce = useCallback(() => setIsViewOnce(current => !current), [])

  const startedAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Every amplitude of the clip being recorded, for the preview's waveform.
  const allLevelsRef = useRef<number[]>([])
  // The take so far: one clip per stretch between resumes.
  const clipsRef = useRef<VoiceClip[]>([])
  // What the clips before the live one add to the timer.
  const baseElapsedRef = useRef(0)
  // The preview's trim handles, read when the take is resumed or sent.
  const trimRef = useRef({ start: 0, end: 1 })
  // `start` is async (permission -> audio mode -> prepare), so a quick tap can
  // release the gesture before the recorder is live. These two refs let the
  // release be remembered and applied once `start` finishes, instead of being
  // dropped and leaving a recording nothing can stop.
  const startTokenRef = useRef(0)
  const pendingFinishRef = useRef<PendingFinish>(null)

  const minDurationMs = config?.minDurationMs ?? DEFAULT_MIN_DURATION_MS
  const maxDurationMs = config?.maxDurationMs ?? 600000


  const isActive = isRecording || isResuming || isJoining
  useStateReport({ onStateChange, isActive, isLocked, cancelArmed, preview, meter, levelsRef })


  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Reads and clears the deferred release, in its own scope so that clearing it
   * inside `start` doesn't narrow the ref to `null` for the later read. */
  const takePendingFinish = useCallback((): PendingFinish => {
    const pending = pendingFinishRef.current
    pendingFinishRef.current = null
    return pending
  }, [])

  /**
   * Stops the recorder and decides what the take becomes: sent, kept for a
   * preview, or dropped (cancelled, or too short).
   */
  const stopTake = useCallback(async (outcome: 'send' | 'cancel' | 'preview') => {
    if (!isRecordingRef.current) {
      // A release that lands while `start` is still awaiting natives: remember
      // it so `start` can apply it the moment the recorder is actually live.
      if (startTokenRef.current > 0 && outcome !== 'preview')
        pendingFinishRef.current = { cancelled: outcome === 'cancel' }

      return
    }

    isRecordingRef.current = false
    const duration = Date.now() - startedAtRef.current

    clearTimer()
    setIsRecording(false)
    setCancelArmed(false)
    if (outcome === 'preview')
      setIsJoining(true)
    else
      setIsLocked(false)

    // A promise chain rather than try/finally, which the compiler cannot lower: the cleanup
    // still runs after every outcome, the early returns and a throwing `onError` included.
    await (async () => {
      const recorder = getRecorder()
      await recorder.stop()
      const uri = recorder.uri
      const earlier = clipsRef.current

      if (outcome === 'cancel' || !uri) {
        clipsRef.current = []
        return
      }

      // Pausing a take that is too short drops it too (`toggleRecordingPause`).
      if (!earlier.length && duration <= minDurationMs) {
        config?.onTooShort?.()
        return
      }

      const clips = duration >= MIN_CLIP_MS
        ? [...earlier, createClip(uri, duration, allLevelsRef.current)]
        : earlier
      clipsRef.current = clips

      // A paused take is joined into one file right away,
      // so the preview plays exactly what would be sent.
      const joined = await renderClips(clips)
      const durationMs = clipsDuration(clips)

      if (outcome === 'preview') {
        trimRef.current = { start: 0, end: 1 }
        setPreview({ uri: joined, durationMs, levels: clipsLevels(clips), isTrimmable: isVoiceTrimAvailable() })
        return
      }

      clipsRef.current = []
      onSend?.({ audio: joined, duration: Math.round(durationMs / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
    })()
      .catch(error => {
        clipsRef.current = []
        config?.onError?.(error)
      })
      .finally(() => {
        setIsJoining(false)
        setIsLocked(false)
        releaseAudioSession()
      })
  }, [getRecorder, minDurationMs, onSend, config, clearTimer])

  const stopTakeRef = useRef(stopTake)
  useLayoutEffect(() => {
    stopTakeRef.current = stopTake
  })

  /** Starts a take, or with `isResume` a new clip of the paused one. */
  const start = useCallback(async (isResume = false) => {
    if (isRecordingRef.current || startTokenRef.current > 0)
      return

    const token = Date.now()
    startTokenRef.current = token
    pendingFinishRef.current = null
    if (!isResume) {
      clipsRef.current = []
      setIsViewOnce(false)
    }
    baseElapsedRef.current = clipsDuration(clipsRef.current)
    setPreview(null)

    // Recording takes the audio over: pause whatever note is
    // playing so it does not bleed into the take.
    stopAllPlayback()

    // A promise chain rather than try/finally, which the compiler cannot lower.
    await (async () => {
      const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync()
      if (!permission?.granted) {
        config?.onPermissionDenied?.()
        return
      }

      await expoAudio.setAudioModeAsync?.({ allowsRecording: true, playsInSilentMode: true })
      // Passing the options makes iOS build a new recorder, and so a new file.
      // Without them it reuses the last one and a resumed clip overwrites the
      // clip before it (Android makes a new file either way).
      const recorder = getRecorder()
      await recorder.prepareToRecordAsync(recorderOptions)

      // The component may have unmounted while we were awaiting natives.
      if (startTokenRef.current !== token)
        return

      recorder.record()

      startedAtRef.current = Date.now()
      isRecordingRef.current = true
      allLevelsRef.current = []
      levelsRef.current = []
      meter.level.set(0)
      meter.elapsed.set(baseElapsedRef.current)
      setIsRecording(true)

      clearTimer()
      // 100ms drives the tenths in the timer and the halo smoothly
      // enough while staying cheap.
      timerRef.current = setInterval(() => {
        const ms = baseElapsedRef.current + Date.now() - startedAtRef.current

        // The halo tracks real loudness rather than pulsing on a fixed loop.
        const next = normalizeMetering(recorder.getStatus?.()?.metering)
        allLevelsRef.current.push(next)
        const previous = levelsRef.current
        const kept = previous.length >= LEVEL_HISTORY
          ? previous.slice(previous.length - LEVEL_HISTORY + 1)
          : previous
        levelsRef.current = [...kept, next]
        meter.level.set(next)
        meter.elapsed.set(ms)

        if (ms >= maxDurationMs)
          stopTakeRef.current('send')
      }, 100)
    })()
      .catch(error => {
        config?.onError?.(error)
        isRecordingRef.current = false
        clipsRef.current = []
        setIsRecording(false)
        setIsLocked(false)
        clearTimer()
        releaseAudioSession()
      })
      .finally(() => {
        setIsResuming(false)
        if (startTokenRef.current === token) {
          startTokenRef.current = 0

          // Apply a release that arrived while we were starting up. Without this
          // a quick tap leaves a live recording with no control to end it.
          const pending = takePendingFinish()
          if (pending)
            stopTakeRef.current(pending.cancelled ? 'cancel' : 'send')
        }
      })
  }, [getRecorder, recorderOptions, config, clearTimer, maxDurationMs, takePendingFinish, meter])

  // Tear the recorder down with the component: without this the mic stays hot
  // (and the iOS recording indicator lit) after navigating away mid-recording,
  // and the toolbar is left showing a frozen recording bar.
  useEffect(() => () => {
    clearTimer()
    startTokenRef.current = 0
    pendingFinishRef.current = null

    if (isRecordingRef.current) {
      isRecordingRef.current = false
      stopRecorderQuietly(recorderRef.current)
    }

    releaseAudioSession()
    onStateChange?.(IDLE_STATE)
  }, [clearTimer, onStateChange, recorderRef])

  const { sendPreview, resume } = useTakePreviewActions({
    ref,
    config,
    onSend,
    labels,
    meter,
    preview,
    setPreview,
    setIsLocked,
    setIsResuming,
    clipsRef,
    trimRef,
    isViewOnceRef,
    start,
    stopTake,
  })

  const onSlideProgress = useCallback((progress: number) => {
    setCancelArmed(progress < CANCEL_ARMED_PROGRESS)
  }, [])

  const phase: RecordButtonPhase = preview
    ? 'preview'
    : isActive
      ? (isLocked ? 'locked' : 'recording')
      : 'idle'

  return {
    phase,
    meter,
    labels,
    preview,
    isViewOnce,
    toggleViewOnce,
    start,
    stopTake,
    setIsLocked,
    resume,
    sendPreview,
    onSlideProgress,
  }
}
