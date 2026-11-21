import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Easing, ReduceMotion, SharedValue, withTiming } from 'react-native-reanimated'

import { useRaiseToListen } from '../earpiece'
import {
  StopReason,
  claimPlayback,
  releasePlayback,
  usePlaybackRate,
  useReportNowPlaying,
} from '../mediaPlayback'
import { useAutoPlay } from '../useAutoPlay'
import { useVoicePlaybackEvents } from '../useVoicePlaybackEvents'
import { getAudioContext, stopSourceNode } from './audio'

/** How often a playing note checks the audio clock; the bars move on the UI thread between. */
const PROGRESS_SYNC_MS = 250

interface ViewOnceGate {
  isSpent: boolean
  onStart: () => boolean
  onEnd: () => void
}

interface VoicePlaybackOptions {
  autoPlay?: boolean
  isReady: boolean
  onPlaybackEnded?: () => void
  playerId: string
  messageId: string | number | undefined
  position: 'left' | 'right'
  isMediaUnread: boolean | undefined
  progress: SharedValue<number>
  isDragging: SharedValue<boolean>
  viewOnce: ViewOnceGate
  markReadRef: RefObject<() => void>
  setFailed: (failed: boolean) => void
  bufferRef: RefObject<any>
  sourceRef: RefObject<any>
  tickTimerRef: RefObject<ReturnType<typeof setInterval> | null>
  durationRef: RefObject<number>
  pendingPlayRef: RefObject<boolean>
  playFromRef: RefObject<(fraction: number) => void>
  stopRaf: () => void
}

/**
 * Plays, pauses and seeks a decoded note, keeps `progress` on the audio clock while it plays,
 * and hands over to the next note when it ends.
 */
export const useVoicePlayback = ({
  autoPlay,
  isReady,
  onPlaybackEnded,
  playerId,
  messageId,
  position,
  isMediaUnread,
  progress,
  isDragging,
  viewOnce,
  markReadRef,
  setFailed,
  bufferRef,
  sourceRef,
  tickTimerRef,
  durationRef,
  pendingPlayRef,
  playFromRef,
  stopRaf,
}: VoicePlaybackOptions) => {
  const [isPlaying, setIsPlaying] = useState(false)
  // Progress as last rendered. The bars follow `progress` (a shared value) on
  // every frame; React only re-renders when the shown second changes.
  const [shownProgress, setShownProgress] = useState(0)
  // Shared across every note, so 2x picked on one carries to the next.
  const rate = usePlaybackRate()

  const ctxRef = useRef<any>(null)
  const startedAtRef = useRef(0)
  const rateRef = useRef(rate)
  useLayoutEffect(() => {
    rateRef.current = rate
  })
  // Latest exact progress, readable from callbacks that must not re-subscribe
  // on every frame (the resume offset).
  const progressRef = useRef(0)

  const viewOnceRef = useRef(viewOnce)
  useLayoutEffect(() => {
    viewOnceRef.current = viewOnce
  })

  const setProgressValue = useCallback((next: number) => {
    progressRef.current = next
    progress.set(next)
  }, [progress])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    const duration = durationRef.current
    if (!ctx || duration <= 0)
      return

    const elapsed = (ctx.currentTime - startedAtRef.current) * rateRef.current
    const next = Math.min(1, elapsed / duration)
    progressRef.current = next
    // A drag owns the visible progress, and the time, until it is released. Otherwise the
    // bars run to the end on the UI thread at the playback rate, and this check-in - four
    // times a second, not every frame - puts them back on the audio clock and moves the time.
    if (!isDragging.get()) {
      progress.set(next)
      progress.set(withTiming(1, {
        duration: (1 - next) * duration * 1000 / (rateRef.current || 1),
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }))
      setShownProgress(prev =>
        Math.floor(prev * duration) === Math.floor(next * duration) ? prev : next
      )
    }

    if (next >= 1) {
      setIsPlaying(false)
      setShownProgress(0)
      // After the stop, which leaves the bars where the UI thread had them.
      stopRaf()
      setProgressValue(0)
    }
  }, [stopRaf, isDragging, progress, setProgressValue, durationRef])

  const hasStarted = useRef(false)
  const { isUnread, markStarted, notifyEnded } = useVoicePlaybackEvents(
    messageId, position === 'left' && !!isMediaUnread, markReadRef, () => playFromRef.current(0), onPlaybackEnded
  )

  const stopSource = useCallback(() => {
    const source = sourceRef.current
    sourceRef.current = null
    stopSourceNode(source)
    stopRaf()
    setIsPlaying(false)
    setShownProgress(progressRef.current)
  }, [stopRaf, sourceRef])

  // Recording pauses this note where it is; another note starting resets it,
  // like any player that loses the audio.
  const onStop = useCallback((reason: StopReason) => {
    stopSource()
    if (reason === 'replaced') {
      setProgressValue(0)
      setShownProgress(0)
      // Stopped for good after starting: a view-once note is spent.
      viewOnceRef.current.onEnd()
    }
  }, [stopSource, setProgressValue])

  const playFrom = useCallback((fraction: number) => {
    const buffer = bufferRef.current
    const ctx = buffer ? getAudioContext() : null
    ctxRef.current = ctx
    if (!ctx || !buffer)
      return
    // A view-once note that has played does not play again.
    if (viewOnceRef.current.isSpent)
      return

    const offset = fraction > 0 && fraction < 1 ? fraction * durationRef.current : 0
    const isContextSuspended = ctx.state === 'suspended' || ctx.state === 'interrupted'
    try {
      // Replace any source already running (a seek mid-playback).
      const previous = sourceRef.current
      sourceRef.current = null
      stopSourceNode(previous)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (source.playbackRate)
        source.playbackRate.value = rateRef.current
      source.connect(ctx.destination)
      // `stop()` also fires `ended`, so a pause or a seek would otherwise run
      // the completion handler and rewind the note. Only the source still owning
      // playback may reset the cursor.
      source.onended = () => {
        if (sourceRef.current !== source)
          return

        sourceRef.current = null
        releasePlayback(playerId)
        setIsPlaying(false)
        setProgressValue(0)
        setShownProgress(0)
        stopRaf()
        viewOnceRef.current.onEnd()
        // Reached the end on its own (a pause or seek replaced the source
        // above), so hand over to the next note.
        notifyEnded()
      }

      const start = () => {
        if (sourceRef.current !== source)
          return
        startedAtRef.current = ctx.currentTime - offset / rateRef.current
        source.start(0, offset)
        viewOnceRef.current.onStart()
        setIsPlaying(true)
        stopRaf()
        tick()
        tickTimerRef.current = setInterval(tick, PROGRESS_SYNC_MS)
        hasStarted.current = true
        markStarted()
      }

      sourceRef.current = source
      claimPlayback(playerId, onStop)
      if (isContextSuspended)
        void Promise.resolve(ctx.resume()).then(start).catch(() => {
          if (sourceRef.current === source) {
            stopSource()
            releasePlayback(playerId)
          }
        })
      else
        start()
    } catch {
      stopSource()
      releasePlayback(playerId)
      setFailed(true)
    }
  }, [tick, stopRaf, stopSource, playerId, onStop, notifyEnded, markStarted, setProgressValue, bufferRef, durationRef, sourceRef, tickTimerRef, setFailed])

  useLayoutEffect(() => {
    playFromRef.current = playFrom
  })

  useAutoPlay(autoPlay, isReady, () => playFrom(0), hasStarted)

  // A paused note keeps its claim: it is still the current one, so a note
  // started later can reset it.
  const pause = useCallback(() => {
    stopSource()
  }, [stopSource])

  const togglePlayback = useCallback(() => {
    if (isPlaying)
      pause()
    else if (!bufferRef.current)
      pendingPlayRef.current = true
    else
      playFrom(progressRef.current)
  }, [isPlaying, pause, playFrom, bufferRef, pendingPlayRef])

  // The "now playing" bar's close: stop and rewind, as another note would.
  const stopFromBar = useCallback(() => {
    onStop('replaced')
    releasePlayback(playerId)
  }, [onStop, playerId])

  // Current: playing, or paused part-way.
  const isCurrent = isPlaying || shownProgress > 0
  useReportNowPlaying(messageId, 'voice', isCurrent, isPlaying, togglePlayback, stopFromBar)

  // Raise to listen: at the ear the note plays through the earpiece, from the
  // start if it was under a second in; lowered, it pauses.
  useRaiseToListen({
    isCurrent,
    getPositionSeconds: () => progressRef.current * durationRef.current,
    listen: fromStart => {
      if (fromStart)
        playFrom(0)
      else if (!sourceRef.current)
        playFrom(progressRef.current)
    },
    pause,
  })

  // Re-seat a running source so a new rate - picked here or on another note -
  // takes effect immediately.
  useEffect(() => {
    // Only a rate change should re-seat; `playFrom` changes identity with
    // `tick` and would restart the source for nothing, so it is read through its ref.
    if (sourceRef.current)
      playFromRef.current(progressRef.current)
  }, [rate, sourceRef, playFromRef])

  // The waveform seeks once, on release;
  // during the drag only the drawn progress moves. On a note that is not
  // playing this just sets where play will start.
  const commitSeek = useCallback((fraction: number) => {
    if (durationRef.current <= 0)
      return

    const next = Math.max(0, Math.min(1, fraction))
    setProgressValue(next)
    setShownProgress(next)
    if (sourceRef.current)
      playFrom(next)
  }, [playFrom, setProgressValue, durationRef, sourceRef])

  return {
    isPlaying,
    shownProgress,
    setShownProgress,
    isCurrent,
    isUnread,
    togglePlayback,
    commitSeek,
  }
}
