import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import { ChatTheme } from '../Theme'
import { useRaiseToListen } from './earpiece'
import { MediaCard } from './MediaCard'
import { getMediaPalette } from './mediaPalette'
import {
  StopReason,
  claimPlayback,
  releasePlayback,
  useNotePlaybackOptions,
  usePlaybackRate,
  usePlaylistEntry,
  useReportNowPlaying,
} from './mediaPlayback'
import { suppressPressAfterHold } from './messagePress'
import { UnreadDot } from './NoteIndicators'
import { PlayPauseIcon } from './PlayPauseIcon'
import {
  SEND_FLIGHT_REVEAL_MS,
  SEND_FLIGHT_SAFETY_MS,
  isSendFlightExpected,
  landSendFlight,
  onSendFlightFinished,
} from './sendFlight'
import { TranscribeButton, TranscriptionText, useTranscription } from './TranscribeButton'
import { useViewOnce } from './viewOnce'
import { ViewOnceBadge } from './ViewOnceBadge'
import {
  BAR_STEP,
  BAR_WIDTH,
  DRAG_SLOP,
  TRANSCRIBE_SLOT_WIDTH,
  VOICE_BUTTON_SIZE,
  VOICE_COLUMN_GAP,
  VOICE_META_HEIGHT,
  VOICE_ROW_PADDING_V,
  VOICE_TIME_FONT_SIZE,
  WAVEFORM_HEIGHT,
  barCountForWidth,
  barHeight,
  formatVoiceDuration,
  levelsFromSamples,
  voiceContentWidth,
  voiceTrackWidth,
} from './voiceWaveform'

// Optional waveform engine. Resolved through a try/catch require so the bundle
// works whether or not the consumer installed `react-native-audio-api`.
let audioApi: any = null
try {
  audioApi = require('react-native-audio-api')
} catch {
  audioApi = null
}

export const isWaveformAvailable = !!audioApi?.AudioContext

const ROW_PADDING_H = 8

// SeekBarWaveform's `appearFloat`: bars of a just-sent note grow left to right
// over 600ms after a 125ms delay, eased out-quint.
const APPEAR_DELAY_MS = 125
const APPEAR_MS = 600
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
// SeekBarWaveform's loading shimmer: 1.6 widths of travel every 270ms of
// `t^0.75`, which comes to one sweep about every 430ms, and `loadingFloat`
// fades it out over 150ms once the file is ready.
const SWEEP_MS = 432
const LOADING_FADE_MS = 150

export interface WaveformPlayerProps {
  uri: string
  position?: 'left' | 'right'
  /**
   * Length in seconds from the message, shown before the file has decoded so a
   * note is labelled immediately instead of reading 00:00.
   */
  duration?: number
  /**
   * Id of the message this note belongs to. Lets the chat start this note
   * when the one above it finishes, the way Telegram plays a run of notes.
   */
  messageId?: string | number
  /** Not played by its recipient yet: draws Telegram's unread dot. */
  isMediaUnread?: boolean
  /**
   * Grow the bars in once the waveform is ready, as Telegram does for a note
   * that has just been sent. Read on mount only.
   */
  animateAppear?: boolean
  /**
   * The message itself, handed to `mediaPlayback.onTranscribe` and
   * `onViewOnceEnd`.
   */
  message?: IMessage
  /** Telegram's view-once voice: plays a single time, cannot be seeked. */
  isViewOnce?: boolean
  /** Text shown under the waveform once transcribed. */
  transcription?: string
}

/*
 * How far a view-once waveform has burnt away: Telegram clips it to
 * `width * (1 - explodeProgress)` while it plays, and the note is gone once
 * it has played.
 */
const BURN_NONE = 0
const BURNING = 1
const BURNT = 2

/** A static row of bars, or a flat seek line when there is no waveform. */
const Bars = ({ heights, color, width }: { heights: number[], color: string, width?: number }) => (
  <View style={[barStyles.row, width != null && { width }]}>
    {heights.length
      ? heights.map((height, index) => (
        // Heights and color are per-bar runtime values, so they stay inline.
        <View key={index} style={[barStyles.bar, { height, backgroundColor: color }]} />
      ))
      : <View style={[barStyles.line, { backgroundColor: color }]} />}
  </View>
)

const AppearingBar = ({
  index,
  count,
  height,
  color,
  appear,
}: {
  index: number
  count: number
  height: number
  color: string
  appear: SharedValue<number>
}) => {
  // Each bar takes its own 1/count slice of the animation, from 1 tall, so
  // the waveform sweeps in left to right.
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, appear.value * count - index))
    return { height: 1 + (height - 1) * t }
  })

  return <Animated.View style={[barStyles.bar, { backgroundColor: color }, style]} />
}

/**
 * A band of the played color clipped to a window over the bars, moved by the
 * loading sweep. Stands in for Telegram's linear-gradient shader: two nested
 * bands of different widths approximate its soft falloff.
 */
const SweepBand = ({
  heights,
  color,
  width,
  sweep,
  loading,
  bandFraction,
  opacity,
}: {
  heights: number[]
  color: string
  width: number
  sweep: SharedValue<number>
  loading: SharedValue<number>
  bandFraction: number
  opacity: number
}) => {
  const bandStyle = useAnimatedStyle(() => {
    // The band's centre runs from -0.4 to 1.2 widths, as Telegram's gradient
    // peak does.
    const centre = (-0.4 + 1.6 * sweep.value) * width
    return {
      left: centre - (bandFraction * width) / 2,
      width: bandFraction * width,
      opacity: opacity * loading.value,
    }
  })
  const innerStyle = useAnimatedStyle(() => {
    const centre = (-0.4 + 1.6 * sweep.value) * width
    return { left: -(centre - (bandFraction * width) / 2) }
  })

  return (
    <Animated.View pointerEvents='none' style={[barStyles.clip, bandStyle]}>
      <Animated.View style={[barStyles.clipContent, innerStyle]}>
        <Bars heights={heights} color={color} width={width} />
      </Animated.View>
    </Animated.View>
  )
}

/**
 * Telegram-style voice note: a 44 play/pause circle, a 30-tall waveform beside
 * it and the time under the waveform. A tap on the waveform toggles playback;
 * a drag scrubs and seeks once on release. Powered by react-native-audio-api
 * (decode + playback). Falls back to a tappable MediaCard if decoding fails.
 * Only mounted when audio-api is available.
 */
export function WaveformPlayer ({
  uri,
  position = 'left',
  duration: durationProp,
  messageId,
  isMediaUnread,
  animateAppear,
  message,
  isViewOnce = false,
  transcription,
}: WaveformPlayerProps) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const playerId = useId()

  const [levels, setLevels] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  // Progress as last rendered. The bars follow `progress` (a shared value) on
  // every frame; React only re-renders when the shown second changes.
  const [shownProgress, setShownProgress] = useState(0)
  const [decodedDuration, setDecodedDuration] = useState(0)
  // Shared across every note, so 2x picked on one carries to the next.
  const rate = usePlaybackRate()
  const [trackWidth, setTrackWidth] = useState(0)

  const ctxRef = useRef<any>(null)
  const bufferRef = useRef<any>(null)
  const sourceRef = useRef<any>(null)
  const startedAtRef = useRef(0)
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const durationRef = useRef(durationProp ?? 0)
  const rateRef = useRef(rate)
  rateRef.current = rate
  // Latest exact progress, readable from callbacks that must not re-subscribe
  // on every frame (the resume offset).
  const progressRef = useRef(0)

  const progress = useSharedValue(0)
  const trackWidthSV = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const dragStart = useSharedValue(0)
  const fillAll = useSharedValue(false)
  const loading = useSharedValue(1)
  const sweep = useSharedValue(0)
  const [isSweepMounted, setIsSweepMounted] = useState(true)

  const appearOnMount = useRef(!!animateAppear).current
  const appear = useSharedValue(appearOnMount ? 0 : 1)
  const [isAppearing, setIsAppearing] = useState(appearOnMount)

  // The record circle flies into this play button when the note was just sent
  // (`VoiceMessageEnterTransition`), and the button is not drawn until it has
  // landed (`setEnterTransitionInProgress`). Hidden from the first frame, so it
  // does not flash while it is measured.
  const playRef = useRef<React.ComponentRef<typeof View>>(null)
  const playReveal = useSharedValue(appearOnMount && isSendFlightExpected('voice') ? 0 : 1)
  const hasLandedRef = useRef(false)
  const flightCleanupRef = useRef<(() => void) | null>(null)

  const { markReadRef, onTranscribe, onViewOnceEnd } = useNotePlaybackOptions(messageId)
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)
  const viewOnceRef = useRef(viewOnce)
  viewOnceRef.current = viewOnce

  const fullDuration = decodedDuration || durationProp || 0
  const contentWidth = voiceContentWidth(fullDuration, position === 'right')
  // The track's width before it has been measured, so the first decode
  // buckets close to the right count. The transcribe button takes its slot
  // out of the waveform, never out of the bubble's width.
  const expectedTrackWidth = voiceTrackWidth(contentWidth, ROW_PADDING_H, transcribe.isVisible)
  const barCount = barCountForWidth(trackWidth > 0 ? trackWidth : expectedTrackWidth)
  const barCountRef = useRef(barCount)
  barCountRef.current = barCount

  const setProgressValue = useCallback((next: number) => {
    progressRef.current = next
    progress.value = next
  }, [progress])

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const ctx = new audioApi.AudioContext()
    ctxRef.current = ctx

    ;(async () => {
      try {
        // `decodeAudioData(uri)` is the current API; `decodeAudioDataSource` was
        // its name in older react-native-audio-api releases and no longer exists
        // in 0.13+, where calling it silently degraded every voice note to the
        // MediaCard fallback. Support both so either version works.
        const decode = typeof ctx.decodeAudioData === 'function'
          ? (source: string) => ctx.decodeAudioData(source)
          : (source: string) => ctx.decodeAudioDataSource(source)

        const buffer = await decode(uri)
        if (cancelled)
          return

        bufferRef.current = buffer
        durationRef.current = buffer.duration ?? durationProp ?? 0
        setDecodedDuration(durationRef.current)
        setLevels(levelsFromSamples(buffer.getChannelData(0), barCountRef.current))
        setIsLoading(false)
      } catch {
        if (!cancelled) {
          setFailed(true)
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      stopRaf()
      releasePlayback(playerId)
      try {
        sourceRef.current?.stop?.()
      } catch {
        // already stopped
      }
      try {
        ctx.close?.()
      } catch {
        // noop
      }
    }
  }, [uri, stopRaf, playerId, durationProp])

  // Re-bucket an already-decoded waveform when the bar count changes.
  useEffect(() => {
    const buffer = bufferRef.current
    if (!buffer || barCount <= 0)
      return

    setLevels(levelsFromSamples(buffer.getChannelData(0), barCount))
  }, [barCount])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    const duration = durationRef.current
    if (!ctx || duration <= 0)
      return

    const elapsed = (ctx.currentTime - startedAtRef.current) * rateRef.current
    const next = Math.min(1, elapsed / duration)
    progressRef.current = next
    // A drag owns the visible progress, and the time, until it is released.
    if (!isDragging.value) {
      progress.value = next
      setShownProgress(prev =>
        Math.floor(prev * duration) === Math.floor(next * duration) ? prev : next
      )
    }

    if (next >= 1) {
      setIsPlaying(false)
      setProgressValue(0)
      setShownProgress(0)
      stopRaf()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopRaf, isDragging, progress, setProgressValue])

  // Lets the chat start this note when the previous one ends. `playFrom` is
  // declared below, so the entry reaches it through a ref.
  const playFromRef = useRef<(fraction: number) => void>(() => {})
  const onEndedRef = usePlaylistEntry(messageId, () => playFromRef.current(0))
  // Heard here already, before the app has updated `isMediaUnread`.
  const [isHeard, setIsHeard] = useState(false)
  const isIncoming = position === 'left'
  const isUnread = isIncoming && !!isMediaUnread && !isHeard

  // SeekBarWaveform paints an unheard incoming note entirely in the played
  // color, until it has any progress. A view-once note stays that way: it
  // burns away instead of filling in.
  const isFilledAlways = useSharedValue(isViewOnce)
  const burn = useSharedValue(BURN_NONE)
  useEffect(() => {
    fillAll.value = isUnread
    isFilledAlways.value = isViewOnce
  }, [fillAll, isUnread, isFilledAlways, isViewOnce])

  useEffect(() => {
    burn.value = viewOnce.isSpent ? BURNT : viewOnce.hasStarted ? BURNING : BURN_NONE
  }, [burn, viewOnce.isSpent, viewOnce.hasStarted])

  const stopSource = useCallback(() => {
    try {
      sourceRef.current?.stop?.()
    } catch {
      // already stopped
    }
    sourceRef.current = null
    stopRaf()
    setIsPlaying(false)
    setShownProgress(progressRef.current)
  }, [stopRaf])

  // Recording pauses this note where it is; another note starting resets it,
  // as Telegram's `cleanupPlayer` does.
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
    const ctx = ctxRef.current
    const buffer = bufferRef.current
    if (!ctx || !buffer)
      return
    // A view-once note that has played does not play again.
    if (!viewOnceRef.current.onStart())
      return

    try {
      // Replace any source already running (a seek mid-playback).
      try {
        sourceRef.current?.stop?.()
      } catch {
        // already stopped
      }
      sourceRef.current = null

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
        onEndedRef.current()
      }

      const offset = fraction > 0 && fraction < 1 ? fraction * durationRef.current : 0
      startedAtRef.current = ctx.currentTime - offset / rateRef.current
      source.start(0, offset)
      sourceRef.current = source
      setIsPlaying(true)
      // Starting stops whatever else was playing, the way Telegram does.
      claimPlayback(playerId, onStop)
      stopRaf()
      rafRef.current = requestAnimationFrame(tick)

      // Telegram marks an incoming note read the moment it starts playing.
      if (isIncoming && isMediaUnread) {
        setIsHeard(true)
        markReadRef.current()
      }
    } catch {
      setFailed(true)
    }
  }, [tick, stopRaf, playerId, onStop, onEndedRef, isIncoming, isMediaUnread, markReadRef, setProgressValue])

  playFromRef.current = playFrom

  // A paused note keeps its claim: it is still the current one, so a note
  // started later can reset it.
  const pause = useCallback(() => {
    stopSource()
  }, [stopSource])

  const togglePlayback = useCallback(() => {
    if (isPlaying)
      pause()
    else
      playFrom(progressRef.current)
  }, [isPlaying, pause, playFrom])

  // The "now playing" bar's close: stop and rewind, as another note would.
  const stopFromBar = useCallback(() => {
    onStop('replaced')
    releasePlayback(playerId)
  }, [onStop, playerId])

  // Current: playing, or paused part-way (Telegram's `isPlayingMessage`).
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
    if (sourceRef.current)
      playFrom(progressRef.current)
    // Only a rate change should re-seat; `playFrom` changes identity with
    // `tick` and would restart the source for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate])

  // SeekBarWaveform seeks once, on release (`onSeekBarDrag` in ACTION_UP);
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
  }, [playFrom, setProgressValue])

  // The gesture is built once; it reaches the latest handlers through refs.
  const toggleRef = useRef(togglePlayback)
  toggleRef.current = togglePlayback
  const commitSeekRef = useRef(commitSeek)
  commitSeekRef.current = commitSeek
  const onWaveformTap = useCallback(() => toggleRef.current(), [])
  const onWaveformDragEnd = useCallback((fraction: number) => commitSeekRef.current(fraction), [])

  // While dragging, the time follows the finger, as Telegram's does
  // (`onSeekBarContinuousDrag`); only a new whole second re-renders.
  const onWaveformDrag = useCallback((fraction: number) => {
    const duration = durationRef.current
    setShownProgress(prev =>
      duration > 0 && Math.floor(prev * duration) === Math.floor(fraction * duration) ? prev : fraction
    )
  }, [])

  // A tap toggles playback, like a tap on the button (ChatMessageCell's
  // `didPressButton` on an ACTION_UP that never started dragging). A drag only
  // starts past Telegram's 0.2cm slop, and must stay horizontal, or it fights
  // the message list. The drag is relative: the progress moves by the finger's
  // travel rather than jumping to where it went down (`thumbDX`).
  const waveformPan = usePanGesture({
    // Telegram never lets a view-once note be scrubbed
    // (`isSeekBarDragAllowed`).
    enabled: !isViewOnce,
    activeOffsetX: [-DRAG_SLOP, DRAG_SLOP],
    failOffsetY: [-12, 12],
    testID: 'voice-waveform-pan',
    onActivate: () => {
      isDragging.value = true
      dragStart.value = progress.value
    },
    onUpdate: event => {
      const width = trackWidthSV.value
      if (width <= 0)
        return

      progress.value = Math.max(0, Math.min(1, dragStart.value + event.translationX / width))
      runOnJS(onWaveformDrag)(progress.value)
    },
    onDeactivate: () => {
      runOnJS(onWaveformDragEnd)(progress.value)
    },
    onFinalize: () => {
      isDragging.value = false
    },
  })
  const waveformTap = useTapGesture({
    maxDistance: DRAG_SLOP,
    testID: 'voice-waveform-tap',
    onDeactivate: event => {
      if (!event.canceled)
        runOnJS(onWaveformTap)()
    },
  })
  const waveformGesture = useCompetingGestures(waveformPan, waveformTap)

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    trackWidthSV.value = width
    setTrackWidth(width)
  }, [trackWidthSV])

  // Loading shimmer while decoding and not playing; fades out once ready.
  // Telegram runs the same sweep while a transcription is on its way
  // (`TranscribeButton.setLoading` -> `seekBar.setLoading`).
  const isShimmering = (isLoading || transcribe.isLoading) && !isPlaying
  useEffect(() => {
    if (isShimmering) {
      setIsSweepMounted(true)
      loading.value = withTiming(1, { duration: LOADING_FADE_MS })
      sweep.value = 0
      sweep.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.poly(0.75) }), -1, false)
      return
    }

    loading.value = withTiming(0, { duration: LOADING_FADE_MS }, finished => {
      if (!finished)
        return

      cancelAnimation(sweep)
      runOnJS(setIsSweepMounted)(false)
    })
  }, [isShimmering, loading, sweep])

  const flightColor = String(styles.playCircle.backgroundColor)
  const flightIconColor = String(styles.glyphColor.color)
  const onPlayLayout = useCallback(() => {
    if (!appearOnMount || hasLandedRef.current)
      return

    hasLandedRef.current = true
    const node = playRef.current
    const reveal = () => {
      playReveal.value = withTiming(1, { duration: SEND_FLIGHT_REVEAL_MS })
    }
    if (!node) {
      reveal()
      return
    }

    node.measureInWindow((x, y, width, height) => {
      const isLanded = width > 0 && landSendFlight('voice', {
        x: x + width / 2,
        y: y + height / 2,
        radius: VOICE_BUTTON_SIZE / 2,
        color: flightColor,
        iconColor: flightIconColor,
      })
      if (!isLanded) {
        playReveal.value = 1
        return
      }

      const safety = setTimeout(() => {
        off()
        reveal()
      }, SEND_FLIGHT_SAFETY_MS)
      const off = onSendFlightFinished('voice', () => {
        clearTimeout(safety)
        reveal()
      })
      flightCleanupRef.current = () => {
        clearTimeout(safety)
        off()
      }
    })
  }, [appearOnMount, playReveal, flightColor, flightIconColor])

  useEffect(() => () => flightCleanupRef.current?.(), [])

  const playRevealStyle = useAnimatedStyle(() => ({ opacity: playReveal.value }))

  const hasLevels = levels.length > 0

  // Bars of a just-sent note grow in once there is a waveform to grow.
  useEffect(() => {
    if (!appearOnMount || !hasLevels || appear.value !== 0)
      return

    appear.value = withDelay(
      APPEAR_DELAY_MS,
      withTiming(1, { duration: APPEAR_MS, easing: EASE_OUT_QUINT }, finished => {
        if (finished)
          runOnJS(setIsAppearing)(false)
      })
    )
  }, [appearOnMount, hasLevels, appear])

  useEffect(() => () => {
    cancelAnimation(appear)
    cancelAnimation(sweep)
    cancelAnimation(loading)
  }, [appear, sweep, loading])

  // All bars in the track color, with the played color clipped at the exact
  // progress pixel on top, so a bar can be half filled (SeekBarWaveform draws
  // the inner paint, then the outer paint clipped to `progress * width`).
  const playedStyle = useAnimatedStyle(() => ({
    width: ((fillAll.value && progress.value <= 0) || isFilledAlways.value ? 1 : progress.value)
      * trackWidthSV.value,
    opacity: 1 - loading.value,
  }))

  // A view-once waveform burns away from its end as it plays.
  const burnStyle = useAnimatedStyle(() => ({
    width: burn.value === BURNT
      ? 0
      : burn.value === BURNING
        ? (1 - progress.value) * trackWidthSV.value
        : '100%',
  }))

  // SeekBarWaveform draws a view-once note's levels back to front
  // (`reverseWaveform`).
  const heights = useMemo(() => {
    const next = levels.map(barHeight)
    return isViewOnce ? next.reverse() : next
  }, [levels, isViewOnce])

  // The bubble lays its time over the note's bottom-right corner, so the
  // fallback card leaves it a line of its own.
  if (failed)
    return (
      <View style={styles.metaSpacer}>
        <MediaCard kind='audio' uri={uri} position={position} />
      </View>
    )

  // Telegram shows the elapsed time while this note is the current one -
  // playing, or paused part-way - and the full length otherwise.
  const timeLabel = formatVoiceDuration(isCurrent ? shownProgress * fullDuration : fullDuration)

  const isPlayDisabled = isLoading || viewOnce.isSpent

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <View style={styles.row}>
        <Animated.View ref={playRef} collapsable={false} onLayout={onPlayLayout} style={playRevealStyle}>
          <Pressable
            onPress={togglePlayback}
            {...suppressPressAfterHold}
            disabled={isPlayDisabled}
            accessibilityRole='button'
            accessibilityState={{ disabled: isPlayDisabled, busy: isLoading }}
            accessibilityLabel={isPlaying ? 'pause' : 'play'}
            accessibilityHint={isViewOnce ? 'plays once' : undefined}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.playCircle, isPlayDisabled && styles.playCircleLoading]}
          >
            <PlayPauseIcon isPlaying={isPlaying} color={styles.glyphColor.color} size={18} />
          </Pressable>
          {isViewOnce && (
            <ViewOnceBadge
              isVisible={!viewOnce.hasStarted}
              color={styles.playCircle.backgroundColor as string}
              glyphColor={styles.glyphColor.color}
              cutColor={styles.bubble.backgroundColor as string}
            />
          )}
        </Animated.View>

        <View style={styles.column}>
          <View style={styles.waveformRow}>
            <GestureDetector gesture={waveformGesture}>
              <View
                style={styles.waveform}
                onLayout={onTrackLayout}
                accessibilityRole='adjustable'
                accessibilityLabel='seek'
                accessibilityValue={{ min: 0, max: 100, now: Math.round(shownProgress * 100) }}
              >
                <Animated.View style={[barStyles.burn, burnStyle]}>
                  {isAppearing
                    ? (
                      <View style={barStyles.row}>
                        {heights.map((height, index) => (
                          <AppearingBar
                            key={index}
                            index={index}
                            count={heights.length}
                            height={height}
                            color={styles.colors.borderColor}
                            appear={appear}
                          />
                        ))}
                      </View>
                    )
                    : <Bars heights={heights} color={styles.colors.borderColor} />}

                  <Animated.View pointerEvents='none' style={[barStyles.clip, playedStyle]}>
                    <Bars heights={heights} color={styles.colors.backgroundColor} width={trackWidth} />
                  </Animated.View>

                  {isSweepMounted && trackWidth > 0 && (
                    <>
                      <SweepBand
                        heights={heights}
                        color={styles.colors.backgroundColor}
                        width={trackWidth}
                        sweep={sweep}
                        loading={loading}
                        bandFraction={0.4}
                        opacity={0.5}
                      />
                      <SweepBand
                        heights={heights}
                        color={styles.colors.backgroundColor}
                        width={trackWidth}
                        sweep={sweep}
                        loading={loading}
                        bandFraction={0.2}
                        opacity={1}
                      />
                    </>
                  )}
                </Animated.View>
              </View>
            </GestureDetector>

            {/* Telegram's transcribe button at the end of the waveform row. */}
            {transcribe.isVisible && (
              <View style={styles.transcribeSlot}>
                <TranscribeButton
                  isOpen={transcribe.isOpen}
                  isLoading={transcribe.isLoading}
                  onPress={transcribe.onPress}
                  color={styles.playCircle.backgroundColor as string}
                />
              </View>
            )}
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.time}>{timeLabel}</Text>
            {/* Telegram's unread dot: 6 across, centred 6 past the time, in the
                played color. */}
            <View style={styles.dotSlot}>
              <UnreadDot isVisible={isUnread} color={styles.colors.backgroundColor} />
            </View>
          </View>
        </View>
      </View>

      {transcribe.isVisible && (
        <View style={[styles.transcription, transcribe.isOpen && styles.metaSpacer]}>
          <TranscriptionText
            text={transcription}
            isOpen={transcribe.isOpen}
            color={styles.transcriptionColor.color}
          />
        </View>
      )}
    </View>
  )
}

const barStyles = StyleSheet.create({
  row: {
    height: WAVEFORM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_STEP - BAR_WIDTH,
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  line: {
    flex: 1,
    height: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  },
  clipContent: {
    position: 'absolute',
    top: 0,
  },
  burn: {
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  },
})

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const palette = getMediaPalette(theme, position)

  return StyleSheet.create({
    // Carries the glyph color out of JSX and into the stylesheet.
    glyphColor: {
      color: palette.glyph,
    },
    // Carries the bar colors: background = played, border = unplayed.
    colors: {
      backgroundColor: palette.progress,
      borderColor: palette.track,
    },
    // Carries the text colors of the bubble and the transcription.
    bubble: {
      backgroundColor: position === 'right' ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
    },
    transcriptionColor: {
      color: position === 'right' ? theme.colors.outgoingText : theme.colors.incomingText,
    },
    container: {
      maxWidth: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: VOICE_ROW_PADDING_V,
      paddingHorizontal: ROW_PADDING_H,
      gap: VOICE_COLUMN_GAP,
    },
    waveformRow: {
      height: WAVEFORM_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    transcribeSlot: {
      width: TRANSCRIBE_SLOT_WIDTH,
      alignItems: 'flex-end',
    },
    transcription: {
      paddingHorizontal: ROW_PADDING_H,
    },
    metaSpacer: {
      paddingBottom: VOICE_META_HEIGHT,
    },
    playCircle: {
      width: VOICE_BUTTON_SIZE,
      height: VOICE_BUTTON_SIZE,
      borderRadius: VOICE_BUTTON_SIZE / 2,
      backgroundColor: palette.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playCircleLoading: {
      opacity: 0.5,
    },
    // Waveform level with the button's top, time level with its bottom.
    column: {
      flex: 1,
      minHeight: VOICE_BUTTON_SIZE,
      justifyContent: 'space-between',
    },
    waveform: {
      flex: 1,
      height: WAVEFORM_HEIGHT,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    time: {
      fontSize: VOICE_TIME_FONT_SIZE,
      lineHeight: VOICE_BUTTON_SIZE - WAVEFORM_HEIGHT,
      color: palette.meta,
      fontVariant: ['tabular-nums'],
    },
    dotSlot: {
      marginLeft: 3,
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
