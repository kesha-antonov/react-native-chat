import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SharedValue } from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { AudioRecordingProps, IMessage } from '../Models'
import { ChatTheme } from '../Theme'
import { claimPlayback, releasePlayback, stopAllPlayback } from './mediaPlayback'
import { PlayPauseIcon } from './PlayPauseIcon'
import { RecordButton, RecordButtonPhase, RecordExitReason } from './RecordButton'
import { confirmTrimOnResume, shouldConfirmTrimOnResume } from './recordingFeedback'
import {
  clipsDuration,
  clipsLevels,
  createClip,
  isVoiceResumeAvailable,
  isVoiceTrimAvailable,
  renderClips,
  trimClips,
  VoiceClip,
} from './voiceEditing'

// Optional recorder. Resolved through a try/catch require so the bundle works
// whether or not the consumer installed `expo-audio` (Metro treats
// try/catch-wrapped requires as optional dependencies).
let expoAudio: any = null
try {
  expoAudio = require('expo-audio')
} catch {
  expoAudio = null
}

export const isVoiceRecordingAvailable = !!(
  expoAudio?.useAudioRecorder &&
  expoAudio?.RecordingPresets &&
  expoAudio?.AudioModule
)

export const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** A paused take, waiting to be replayed, trimmed, resumed, sent or deleted. */
export interface VoiceRecordingPreview {
  uri: string
  durationMs: number
  /** Microphone amplitudes over the whole take, 0..1, for the waveform. */
  levels: number[]
  /** The take can be cut down before it is sent or resumed. */
  isTrimmable: boolean
}

/** Live recording state surfaced to the InputToolbar so it can render the bar. */
export interface VoiceRecordingState {
  active: boolean
  locked: boolean
  elapsed: number
  /** Released here, the take would be cancelled. */
  cancelArmed: boolean
  /**
   * Recent microphone amplitudes, 0..1, oldest first.
   */
  levels: number[]
  /** Set while a paused take is shown for review instead of recording. */
  preview?: VoiceRecordingPreview | null
}

/** How many amplitude samples the live halo history keeps. */
const LEVEL_HISTORY = 48
/** Metering floor in dB; anything quieter reads as silence. */
const METERING_FLOOR_DB = -60
/** Telegram drops a voice take of 700ms or less (`MediaController`, `duration > 700`). */
const DEFAULT_MIN_DURATION_MS = 700
/**
 * A clip recorded after a resume and stopped at once has nothing worth
 * keeping, and an all but empty file can fail the join.
 */
const MIN_CLIP_MS = 200
/** Releasing past this share of the cancel slide cancels (matches `RecordButton`). */
const CANCEL_ARMED_PROGRESS = 0.45

/** Map an expo-audio metering value (dB) onto a 0..1 bar height. */
const normalizeMetering = (db: number | undefined) => {
  if (db == null || !Number.isFinite(db))
    return 0

  const clamped = Math.max(METERING_FLOOR_DB, Math.min(0, db))
  return (clamped - METERING_FLOOR_DB) / -METERING_FLOOR_DB
}

/** A release that landed before the recorder finished starting up. */
type PendingFinish = { cancelled: boolean } | null

/** The message field a view-once take adds (`IMessage.isViewOnce`). */
const viewOnceFields = (isViewOnce: boolean) => (isViewOnce ? { isViewOnce: true } : null)

export interface VoiceMessageInputHandle {
  /** Discard the in-progress or paused take (the bar's CANCEL / delete). */
  cancel: () => void
  /** The paused take's kept range, as fractions of it (the preview's trim handles). */
  trim: (start: number, end: number) => void
}

export interface VoiceMessageInputProps {
  config?: AudioRecordingProps
  onSend?: (
    message: Partial<IMessage>,
    shouldResetInputToolbar: boolean
  ) => void
  /** Reports recording state up so the toolbar can draw the timer/cancel bar. */
  onStateChange?: (state: VoiceRecordingState) => void
  /**
   * Single tap on the mic. When provided, the control switches to tap-to-toggle
   * (voice <-> video) and only records once the press is held, matching Telegram.
   */
  onTap?: () => void
  /** Tooltip shown above the idle button, e.g. after a mode switch. */
  hint?: string | null
  /** A take released within 100ms of starting - a tap rather than a hold. */
  onQuickRelease?: () => void
  /** The cancel slide's progress on the UI thread, for the toolbar's bar. */
  slideProgressValue?: SharedValue<number>
  /** How the record button ended the take, so the bar can animate out to match. */
  onExit?: (reason: RecordExitReason) => void
}

const IDLE_STATE: VoiceRecordingState = {
  active: false, locked: false, elapsed: 0, cancelArmed: false, levels: [], preview: null,
}

/**
 * Telegram-style hold-to-record voice notes. Hold the mic to record, slide left
 * to cancel, slide up to lock for hands-free recording, or release to send. A
 * locked take can be paused into a preview to replay before sending, as in
 * Telegram. A take of `minDurationMs` or less is discarded.
 *
 * This component owns the recorder; the button and its gesture are
 * `RecordButton`, and the bar - timer, "slide to cancel", the preview - is
 * drawn by the InputToolbar via `onStateChange`, so it can span the full
 * width of the input row. Only mounted when expo-audio is available, so its
 * hooks always run in a stable order.
 */
function VoiceMessageInputInner (
  { config, onSend, onStateChange, onTap, hint, onQuickRelease, slideProgressValue, onExit }: VoiceMessageInputProps,
  ref: React.Ref<VoiceMessageInputHandle>
) {
  // Metering drives the halo and the preview waveform, so it has to be
  // switched on with the preset - it is off by default.
  const recorderOptions = useMemo(
    () => ({ ...expoAudio.RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }),
    []
  )
  const recorder = expoAudio.useAudioRecorder(recorderOptions)
  const labels = useLabels()

  const [isRecording, setIsRecording] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cancelArmed, setCancelArmed] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [preview, setPreview] = useState<VoiceRecordingPreview | null>(null)
  // Between the resume tap and the recorder going live, so the bar and the
  // button stay on the locked take instead of flashing the idle composer.
  const [isResuming, setIsResuming] = useState(false)
  // While a paused take is being joined into its preview file, which takes
  // a moment once it has been trimmed, so the bar stays put meanwhile.
  const [isJoining, setIsJoining] = useState(false)
  // Telegram's `voiceOnce`: off at the start of a take but kept across its
  // pauses and resumes, read when it is sent.
  const [isViewOnce, setIsViewOnce] = useState(false)
  const isViewOnceRef = useRef(false)
  isViewOnceRef.current = isViewOnce
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

  const level = levels.length ? levels[levels.length - 1] : 0

  // Surface recording state to the toolbar (timer/cancel bar live there).
  const isActive = isRecording || isResuming || isJoining
  useEffect(() => {
    onStateChange?.({ active: isActive, locked: isLocked, elapsed, cancelArmed, levels, preview })
  }, [onStateChange, isActive, isLocked, elapsed, cancelArmed, levels, preview])

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

  // Leaves the audio session as we found it. Recording puts iOS into
  // PlayAndRecord, which routes playback to the quiet receiver; not restoring it
  // makes every voice note played afterwards sound muffled.
  const releaseAudioSession = useCallback(() => {
    try {
      expoAudio.setAudioModeAsync?.({ allowsRecording: false, playsInSilentMode: true })
    } catch {
      // best-effort; the session is not worth failing a send over
    }
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

    try {
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

      // As in Telegram, a paused take is joined into one file right away,
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
    } catch (error) {
      clipsRef.current = []
      config?.onError?.(error)
    } finally {
      setIsJoining(false)
      setIsLocked(false)
      releaseAudioSession()
    }
  }, [recorder, minDurationMs, onSend, config, clearTimer, releaseAudioSession])

  const stopTakeRef = useRef(stopTake)
  stopTakeRef.current = stopTake

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

    // Recording takes the audio over, as in Telegram: pause whatever note is
    // playing so it does not bleed into the take.
    stopAllPlayback()

    try {
      const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync()
      if (!permission?.granted) {
        config?.onPermissionDenied?.()
        return
      }

      await expoAudio.setAudioModeAsync?.({ allowsRecording: true, playsInSilentMode: true })
      // Passing the options makes iOS build a new recorder, and so a new file.
      // Without them it reuses the last one and a resumed clip overwrites the
      // clip before it (Android makes a new file either way).
      await recorder.prepareToRecordAsync(recorderOptions)

      // The component may have unmounted while we were awaiting natives.
      if (startTokenRef.current !== token)
        return

      recorder.record()

      startedAtRef.current = Date.now()
      isRecordingRef.current = true
      allLevelsRef.current = []
      setElapsed(baseElapsedRef.current)
      setLevels([])
      setIsRecording(true)

      clearTimer()
      // 100ms drives the tenths in the timer and the halo at roughly
      // Telegram's rate while staying cheap.
      timerRef.current = setInterval(() => {
        const ms = baseElapsedRef.current + Date.now() - startedAtRef.current
        setElapsed(ms)

        // The halo tracks real loudness rather than pulsing on a fixed loop.
        const next = normalizeMetering(recorder.getStatus?.()?.metering)
        allLevelsRef.current.push(next)
        setLevels(previous => {
          const kept = previous.length >= LEVEL_HISTORY
            ? previous.slice(previous.length - LEVEL_HISTORY + 1)
            : previous
          return [...kept, next]
        })

        if (ms >= maxDurationMs)
          stopTakeRef.current('send')
      }, 100)
    } catch (error) {
      config?.onError?.(error)
      isRecordingRef.current = false
      clipsRef.current = []
      setIsRecording(false)
      setIsLocked(false)
      clearTimer()
      releaseAudioSession()
    } finally {
      setIsResuming(false)
      if (startTokenRef.current === token) {
        startTokenRef.current = 0

        // Apply a release that arrived while we were starting up. Without this
        // a quick tap leaves a live recording with no control to end it.
        const pending = takePendingFinish()
        if (pending)
          stopTakeRef.current(pending.cancelled ? 'cancel' : 'send')
      }
    }
  }, [recorder, recorderOptions, config, clearTimer, maxDurationMs, releaseAudioSession, takePendingFinish])

  // Tear the recorder down with the component: without this the mic stays hot
  // (and the iOS recording indicator lit) after navigating away mid-recording,
  // and the toolbar is left showing a frozen recording bar.
  useEffect(() => () => {
    clearTimer()
    startTokenRef.current = 0
    pendingFinishRef.current = null

    if (isRecordingRef.current) {
      isRecordingRef.current = false
      try {
        const stopped = recorder.stop() as unknown as Promise<void> | undefined
        stopped?.catch?.(() => {})
      } catch {
        // already stopped
      }
    }

    releaseAudioSession()
    onStateChange?.(IDLE_STATE)
  }, [clearTimer, recorder, releaseAudioSession, onStateChange])

  const cancel = useCallback(() => {
    if (preview) {
      clipsRef.current = []
      setPreview(null)
      return
    }

    stopTake('cancel')
  }, [preview, stopTake])

  const trim = useCallback((startFraction: number, endFraction: number) => {
    trimRef.current = { start: startFraction, end: endFraction }
  }, [])

  useImperativeHandle(ref, () => ({ cancel, trim }), [cancel, trim])

  /** The clips cut down to the preview's trim handles. */
  const trimmedClips = useCallback(() => {
    const { start: from, end: to } = trimRef.current
    const clips = clipsRef.current
    if (from <= 0 && to >= 1)
      return clips

    const total = clipsDuration(clips)
    return trimClips(clips, from * total, to * total)
  }, [])

  const isTrimmed = () => trimRef.current.start > 0 || trimRef.current.end < 1

  const sendPreview = useCallback(async () => {
    if (!preview)
      return

    setPreview(null)

    // Untrimmed, the preview's file is already the whole take.
    if (!isTrimmed()) {
      clipsRef.current = []
      onSend?.({ audio: preview.uri, duration: Math.round(preview.durationMs / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
      return
    }

    const clips = trimmedClips()
    clipsRef.current = []
    try {
      const uri = await renderClips(clips)
      onSend?.({ audio: uri, duration: Math.round(clipsDuration(clips) / 1000), ...viewOnceFields(isViewOnceRef.current) } as Partial<IMessage>, false)
    } catch (error) {
      config?.onError?.(error)
    }
  }, [preview, onSend, config, trimmedClips])

  // Telegram's resume: cut the take to the handles, then record onto its end.
  const resume = useCallback(() => {
    const go = () => {
      clipsRef.current = trimmedClips()
      trimRef.current = { start: 0, end: 1 }
      setElapsed(clipsDuration(clipsRef.current))
      setIsLocked(true)
      setIsResuming(true)
      start(true)
    }

    // Telegram asks once before a trim throws audio away for good.
    if (isTrimmed() && shouldConfirmTrimOnResume() && Platform.OS !== 'web') {
      Alert.alert(labels.trimRecordingTitle, labels.trimRecordingText, [
        { text: labels.cancel, style: 'cancel' },
        {
          text: labels.ok,
          onPress: () => {
            confirmTrimOnResume()
            go()
          },
        },
      ])
      return
    }

    go()
  }, [labels, start, trimmedClips])

  const onSlideProgress = useCallback((progress: number) => {
    setCancelArmed(progress < CANCEL_ARMED_PROGRESS)
  }, [])

  const phase: RecordButtonPhase = preview
    ? 'preview'
    : isActive
      ? (isLocked ? 'locked' : 'recording')
      : 'idle'

  return (
    <RecordButton
      mode='voice'
      phase={phase}
      level={level}
      onTap={onTap}
      onStart={() => start()}
      onFinish={cancelled => stopTake(cancelled ? 'cancel' : 'send')}
      onLock={() => setIsLocked(true)}
      onPause={() => stopTake('preview')}
      onResume={preview && isVoiceResumeAvailable() ? resume : undefined}
      pauseHint={isVoiceTrimAvailable() ? labels.pauseToTrimOrReplay : null}
      onSend={preview ? sendPreview : () => stopTake('send')}
      onSlideProgress={onSlideProgress}
      slideProgressValue={slideProgressValue}
      onExit={onExit}
      hint={hint}
      onQuickRelease={onQuickRelease}
      onToggleViewOnce={config?.isViewOnceEnabled ? toggleViewOnce : undefined}
      isViewOnce={isViewOnce}
    />
  )
}

export const VoiceMessageInput = forwardRef(VoiceMessageInputInner)

/** Bars drawn for a paused take, resampled from its full amplitude history. */
const PREVIEW_BARS = 40

const resample = (values: number[], count: number) => {
  if (!values.length)
    return new Array(count).fill(0.1)

  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i / count) * values.length)
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * values.length))
    let peak = 0
    for (let j = from; j < to && j < values.length; j++)
      peak = Math.max(peak, values[j])
    out.push(Math.max(0.1, peak))
  }
  return out
}

/** Room at each end of the waveform for the trim handles. */
const TRIM_INSET = 10
const HANDLE_WIDTH = 3
/** How far from a handle a touch still grabs it. */
const TRIM_HANDLE_SLOP = 24
/** The kept range never gets shorter than a second or 30pt (`RecordedAudioPlayerView`). */
const MIN_TRIM_MS = 1000
const MIN_TRIM_WIDTH = 30
/** Dragging the end handle replays the last 1.5s of the range. */
const END_REPLAY_S = 1.5

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface RecordedVoicePreviewProps {
  preview: VoiceRecordingPreview
  /** The kept range moved, as fractions of the take. */
  onTrim?: (start: number, end: number) => void
}

type TrimDrag = { kind: 'start' | 'end' | 'seek', wasPlaying: boolean }

/**
 * The paused take in the composer, Telegram's `RecordedAudioPlayerView`: a
 * play button over the take's waveform and its length. When the take can be
 * trimmed, handles at either end of the waveform set the part that is kept,
 * and a drag between them seeks. Only rendered while voice recording is
 * available, so expo-audio is present.
 */
export function RecordedVoicePreview ({ preview, onTrim }: RecordedVoicePreviewProps) {
  const styles = useThemedStyles(createPreviewStyles)
  // Polled often enough that playback stops on the end handle, not past it.
  const player = expoAudio.useAudioPlayer(preview.uri, { updateInterval: 50 })
  const status = expoAudio.useAudioPlayerStatus(player)
  const playerId = useId()

  const [range, setRange] = useState({ start: 0, end: 1 })
  const [width, setWidth] = useState(0)

  const isPlaying = !!status?.playing
  const duration: number = status?.duration || preview.durationMs / 1000
  const currentTime: number = status?.currentTime ?? 0
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const bars = useMemo(() => resample(preview.levels, PREVIEW_BARS), [preview.levels])

  const pause = useCallback(() => {
    try {
      player.pause()
    } catch {
      // player already released
    }
  }, [player])

  useEffect(() => () => releasePlayback(playerId), [playerId])

  const play = useCallback((fromSeconds?: number) => {
    if (fromSeconds != null)
      player.seekTo(fromSeconds)
    player.play()
    claimPlayback(playerId, pause)
  }, [player, playerId, pause])

  // Playback ends at the end handle, back on the start one, ready to replay.
  useEffect(() => {
    if (!isPlaying || range.end >= 1 || currentTime < range.end * duration)
      return

    pause()
    releasePlayback(playerId)
    player.seekTo(range.start * duration)
  }, [isPlaying, currentTime, range, duration, pause, playerId, player])

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause()
      releasePlayback(playerId)
      return
    }

    const from = range.start * duration
    const to = range.end * duration
    const isOutside = currentTime < from || currentTime >= to - 0.05 || !!status?.didJustFinish
    play(isOutside ? from : undefined)
  }, [isPlaying, pause, playerId, range, duration, currentTime, status, play])

  // The gesture is built once; everything it reads goes through this ref.
  const live = useRef({ range, width, duration, isPlaying, play, pause, onTrim, player })
  live.current = { range, width, duration, isPlaying, play, pause, onTrim, player }
  const dragRef = useRef<TrimDrag | null>(null)

  const trimGesture = useMemo(() => {
    const usable = () => Math.max(1, live.current.width - TRIM_INSET * 2)
    const fractionAt = (x: number) => clamp((x - TRIM_INSET) / usable(), 0, 1)
    const minSpan = () => {
      const { duration: seconds } = live.current
      const byTime = seconds > 0 ? MIN_TRIM_MS / 1000 / seconds : 0
      return Math.min(1, Math.max(byTime, MIN_TRIM_WIDTH / usable()))
    }
    const seek = (x: number) => {
      const { range: current, duration: seconds, player: audio } = live.current
      audio.seekTo(clamp(fractionAt(x), current.start, current.end) * seconds)
    }

    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin(event => {
        const { range: current, isPlaying: wasPlaying } = live.current
        const startX = TRIM_INSET + current.start * usable()
        const endX = TRIM_INSET + current.end * usable()
        const toStart = Math.abs(event.x - startX)
        const toEnd = Math.abs(event.x - endX)

        let kind: TrimDrag['kind'] | null = null
        if (Math.min(toStart, toEnd) <= TRIM_HANDLE_SLOP)
          kind = toStart < toEnd ? 'start' : 'end'
        else if (event.x > startX && event.x < endX)
          kind = 'seek'

        if (!kind)
          return

        dragRef.current = { kind, wasPlaying }
        live.current.pause()
        if (kind === 'seek')
          seek(event.x)
      })
      .onUpdate(event => {
        const drag = dragRef.current
        if (!drag)
          return

        if (drag.kind === 'seek') {
          seek(event.x)
          return
        }

        const at = fractionAt(event.x)
        setRange(current => drag.kind === 'start'
          ? { ...current, start: clamp(at, 0, current.end - minSpan()) }
          : { ...current, end: clamp(at, current.start + minSpan(), 1) })
      })
      .onFinalize(() => {
        const drag = dragRef.current
        dragRef.current = null
        if (!drag)
          return

        const { range: current, duration: seconds } = live.current
        live.current.onTrim?.(current.start, current.end)

        // Telegram keeps playing from where the drag leaves off.
        if (drag.kind === 'seek')
          live.current.play()
        else if (drag.kind === 'start' && drag.wasPlaying)
          live.current.play(current.start * seconds)
        else if (drag.kind === 'end' && drag.wasPlaying)
          live.current.play(Math.max(current.start * seconds, current.end * seconds - END_REPLAY_S))
      })
  }, [])

  const keptSeconds = (range.end - range.start) * duration
  const shownSeconds = isPlaying || currentTime > range.start * duration + 0.05
    ? currentTime - range.start * duration
    : keptSeconds
  const usableWidth = Math.max(0, width - TRIM_INSET * 2)

  const waveform = (
    <View
      style={[styles.waveform, preview.isTrimmable && styles.waveformTrimmable]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {bars.map((value, index) => {
        const at = (index + 0.5) / bars.length
        const isKept = at >= range.start && at <= range.end
        return (
          <View
            key={index}
            style={[
              styles.bar,
              // Per-sample runtime height, so it stays inline.
              { height: 3 + value * 17 },
              !isKept ? styles.barCut : at < progress ? styles.barPlayed : styles.barUnplayed,
            ]}
          />
        )
      })}
      {preview.isTrimmable && width > 0 && (
        <>
          {/* Per-drag runtime positions, so they stay inline. */}
          <View pointerEvents='none' style={[styles.cut, styles.cutStart, { width: TRIM_INSET + range.start * usableWidth }]} />
          <View pointerEvents='none' style={[styles.cut, styles.cutEnd, { width: TRIM_INSET + (1 - range.end) * usableWidth }]} />
          <View pointerEvents='none' style={[styles.handle, { left: TRIM_INSET + range.start * usableWidth - HANDLE_WIDTH }]} />
          <View pointerEvents='none' style={[styles.handle, { left: TRIM_INSET + range.end * usableWidth }]} />
        </>
      )}
    </View>
  )

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'pause' : 'play'}
        style={styles.play}
      >
        <PlayPauseIcon isPlaying={isPlaying} color='#fff' size={12} />
      </Pressable>
      {preview.isTrimmable
        ? <GestureDetector gesture={trimGesture}>{waveform}</GestureDetector>
        : waveform}
      <Text style={styles.time}>{formatElapsed(Math.max(0, shownSeconds) * 1000)}</Text>
    </View>
  )
}

const createPreviewStyles = (theme: ChatTheme) => StyleSheet.create({
  // A pill in the accent color, like Telegram's recorded-audio panel.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 4,
    borderRadius: 17,
    backgroundColor: theme.colors.accent,
  },
  play: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  barPlayed: {
    backgroundColor: '#fff',
  },
  barUnplayed: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  barCut: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  waveformTrimmable: {
    paddingHorizontal: TRIM_INSET,
  },
  // Telegram darkens the pill outside the kept range.
  cut: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  cutStart: {
    left: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  cutEnd: {
    right: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  handle: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: HANDLE_WIDTH,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  time: {
    minWidth: 34,
    paddingRight: 8,
    textAlign: 'right',
    fontSize: 12,
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
})
