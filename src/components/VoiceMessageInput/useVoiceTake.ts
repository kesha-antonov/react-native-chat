import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { useLabels } from '../../hooks/useLabels'
import { IMessage } from '../../Models'
import { discardRecording } from '../discardRecording'
import { stopAllPlayback } from '../mediaPlayback'
import { RecordButtonPhase } from '../RecordButton'
import { createRecordingMeter, RecordingMeterContext } from '../recordingMeter'
import { clipsDuration, clipsLevels, createClip, isVoiceTrimAvailable, renderClips, VoiceClip } from '../voiceEditing'
import { CANCEL_ARMED_PROGRESS, DEFAULT_MIN_DURATION_MS, IDLE_STATE, LEVEL_HISTORY, MIN_CLIP_MS } from './constants'
import { acquireAudioSession, expoAudio, normalizeMetering, releaseAudioSession, releaseRecorder, stopRecorderQuietly, viewOnceFields } from './recorder'
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
  const startingRef = useRef(false)
  const pendingFinishRef = useRef<PendingFinish>(null)

  const mountedRef = useRef(false)
  const workRef = useRef<Promise<void> | null>(null)
  const cancelledRef = useRef(false)
  const statusListenerRef = useRef<{ remove: () => void } | null>(null)
  const releaseSessionRef = useRef<(() => Promise<void>) | null>(null)
  const filesRef = useRef(new Set<string>())
  const onStateChangeRef = useRef(onStateChange)
  useLayoutEffect(() => {
    onStateChangeRef.current = onStateChange
  })

  const discardFiles = useCallback((keep: string[] = []) => {
    for (const uri of filesRef.current)
      if (!keep.includes(uri)) {
        filesRef.current.delete(uri)
        void discardRecording(uri, config?.onDiscardRecording)
      }
  }, [config?.onDiscardRecording])
  const discardFilesRef = useRef(discardFiles)
  useLayoutEffect(() => {
    discardFilesRef.current = discardFiles
  })

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
    if (outcome === 'cancel') {
      cancelledRef.current = true
      setPreview(null)
    }
    if (!isRecordingRef.current) {
      if (startingRef.current && outcome === 'send' && !cancelledRef.current)
        pendingFinishRef.current = { cancelled: false }
      if (!workRef.current && outcome === 'cancel') {
        clipsRef.current = []
        discardFiles()
      }
      return
    }

    isRecordingRef.current = false
    const duration = Date.now() - startedAtRef.current
    clearTimer()
    setIsRecording(false)
    setCancelArmed(false)
    setIsJoining(true)

    let kept: string[] = []
    const work = (async () => {
      const recorder = getRecorder()
      const status = recorder.getStatus?.()
      if (status?.mediaServicesDidReset || status?.isRecording === false)
        cancelledRef.current = true
      let recordedUri: string | null = null
      await Promise.resolve().then(() => recorder.stop()).finally(() => {
        statusListenerRef.current?.remove()
        statusListenerRef.current = null
        recordedUri = recorder.uri
        if (recordedUri)
          filesRef.current.add(recordedUri)
        if (recorderRef.current === recorder) {
          recorderRef.current = null
          releaseRecorder(recorder)
        }
      })
      const uri = recordedUri
      if (cancelledRef.current || !mountedRef.current || !uri)
        return

      const earlier = clipsRef.current
      if (!earlier.length && (duration <= minDurationMs || duration < MIN_CLIP_MS)) {
        config?.onTooShort?.()
        return
      }

      const clips = duration >= MIN_CLIP_MS
        ? [...earlier, createClip(uri, duration, allLevelsRef.current)]
        : earlier
      const joined = await renderClips(clips)
      filesRef.current.add(joined)
      if (cancelledRef.current || !mountedRef.current)
        return

      const durationMs = clipsDuration(clips)
      if (outcome === 'preview') {
        kept = [joined, ...clips.map(clip => clip.uri)]
        clipsRef.current = clips
        trimRef.current = { start: 0, end: 1 }
        setPreview({ uri: joined, durationMs, levels: clipsLevels(clips), isTrimmable: isVoiceTrimAvailable() })
        return
      }

      if (onSend) {
        filesRef.current.delete(joined)
        onSend({ audio: joined, duration: Math.round(durationMs / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
      }
    })()
      .catch(error => {
        if (mountedRef.current && !cancelledRef.current)
          config?.onError?.(error)
      })
      .finally(async () => {
        await releaseSessionRef.current?.()
        releaseSessionRef.current = null
        if (cancelledRef.current || !mountedRef.current)
          kept = []
        if (!kept.length)
          clipsRef.current = []
        discardFiles(kept)
        if (mountedRef.current) {
          setIsJoining(false)
          setIsLocked(false)
        }
        workRef.current = null
      })
    workRef.current = work
    await work.catch(() => {})
  }, [getRecorder, minDurationMs, onSend, config, clearTimer, discardFiles, recorderRef])

  const stopTakeRef = useRef(stopTake)
  useLayoutEffect(() => {
    stopTakeRef.current = stopTake
  })

  /** Starts a take, or with `isResume` a new clip of the paused one. */
  const start = useCallback(async (isResume = false) => {
    if (!mountedRef.current || AppState.currentState === 'background' || isRecordingRef.current || workRef.current)
      return

    startingRef.current = true
    cancelledRef.current = false
    pendingFinishRef.current = null
    if (!isResume) {
      clipsRef.current = []
      discardFiles()
      setIsViewOnce(false)
    }
    baseElapsedRef.current = clipsDuration(clipsRef.current)
    setPreview(null)

    // Recording takes the audio over: pause whatever note is
    // playing so it does not bleed into the take.
    stopAllPlayback()

    // A promise chain rather than try/finally, which the compiler cannot lower.
    const isCurrent = () => mountedRef.current && !cancelledRef.current
    const work = (async () => {
      const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync()
      if (!isCurrent())
        return
      if (!permission?.granted) {
        config?.onPermissionDenied?.()
        return
      }

      releaseSessionRef.current = () => releaseAudioSession(config?.canReleaseAudioSession)
      await acquireAudioSession()
      if (!isCurrent())
        return
      const recorder = getRecorder()
      await Promise.resolve().then(() => recorder.prepareToRecordAsync(recorderOptions)).finally(() => {
        if (recorder.uri)
          filesRef.current.add(recorder.uri)
      })

      // The component may have unmounted while we were awaiting natives.
      if (!isCurrent()) {
        await stopRecorderQuietly(recorder)
        if (recorder.uri)
          filesRef.current.add(recorder.uri)
        return
      }

      statusListenerRef.current = recorder.addListener?.('recordingStatusUpdate', (status: { hasError?: boolean, mediaServicesDidReset?: boolean }) => {
        if (status.hasError || status.mediaServicesDidReset)
          void stopTakeRef.current('cancel')
      }) ?? null
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
        const status = recorder.getStatus?.()
        if (status?.mediaServicesDidReset || status?.isRecording === false) {
          void stopTakeRef.current('cancel')
          return
        }
        const next = normalizeMetering(status?.metering)
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
        if (isCurrent())
          config?.onError?.(error)
      })
      .finally(async () => {
        if (!isRecordingRef.current) {
          statusListenerRef.current?.remove()
          statusListenerRef.current = null
          const recorder = recorderRef.current
          if (recorder) {
            recorderRef.current = null
            if (recorder.uri)
              filesRef.current.add(recorder.uri)
            releaseRecorder(recorder)
          }
          clipsRef.current = []
          discardFiles()
          await releaseSessionRef.current?.()
          releaseSessionRef.current = null
        }
        startingRef.current = false
        workRef.current = null
        if (mountedRef.current) {
          setIsResuming(false)
          if (!isRecordingRef.current)
            setIsLocked(false)
          const pending = takePendingFinish()
          if (pending && !cancelledRef.current)
            void stopTakeRef.current('send')
        }
      })
    workRef.current = work
    await work.catch(() => {})
  }, [getRecorder, recorderOptions, config, clearTimer, maxDurationMs, takePendingFinish, meter, discardFiles, recorderRef])

  useLayoutEffect(() => {
    mountedRef.current = true
    const files = filesRef.current
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' && (isRecordingRef.current || workRef.current))
        void stopTakeRef.current('cancel')
    })
    return () => {
      subscription?.remove()
      mountedRef.current = false
      cancelledRef.current = true
      clearTimer()
      statusListenerRef.current?.remove()
      statusListenerRef.current = null
      const recorder = recorderRef.current
      const wasRecording = isRecordingRef.current
      const work = workRef.current
      recorderRef.current = null
      void Promise.resolve(work).finally(async () => {
        if (recorder) {
          if (wasRecording)
            await stopRecorderQuietly(recorder)
          if (recorder.uri && !work)
            files.add(recorder.uri)
          releaseRecorder(recorder)
        }
        const releaseSession = releaseSessionRef.current
        releaseSessionRef.current = null
        await releaseSession?.()
        discardFilesRef.current()
      }).catch(() => {})
      isRecordingRef.current = false
      onStateChangeRef.current?.(IDLE_STATE)
    }
  }, [clearTimer, recorderRef])

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
    workRef,
    mountedRef,
    cancelledRef,
    filesRef,
    discardFiles,
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
