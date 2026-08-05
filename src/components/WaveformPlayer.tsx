import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { MediaCard } from './MediaCard'
import { PauseIcon, PlayIcon } from './MediaControls'
import { getMediaPalette } from './mediaPalette'
import { claimPlayback, releasePlayback } from './mediaPlayback'

// Optional waveform engine. Resolved through a try/catch require so the bundle
// works whether or not the consumer installed `react-native-audio-api`.
let audioApi: any = null
try {
  audioApi = require('react-native-audio-api')
} catch {
  audioApi = null
}

export const isWaveformAvailable = !!audioApi?.AudioContext

// Bar geometry. The count is derived from the measured track width so the bars
// always fit: a fixed count with a min bar width overflowed its row and pushed
// the bubble past its max width.
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_MIN_HEIGHT = 3
const BAR_MAX_HEIGHT = 22
const FALLBACK_BAR_COUNT = 32
/** Telegram cycles through these on the speed pill. */
const SPEED_STEPS = [1, 1.5, 2] as const

export interface WaveformPlayerProps {
  uri: string
  position?: 'left' | 'right'
  /**
   * Length in seconds from the message, shown before the file has decoded so a
   * note is labelled immediately instead of reading 0:00.
   */
  duration?: number
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0)
    seconds = 0

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const downsample = (data: Float32Array, buckets: number) => {
  const block = Math.floor(data.length / buckets) || 1
  const out: number[] = []
  for (let i = 0; i < buckets; i++) {
    let sum = 0
    for (let j = 0; j < block; j++) {
      const v = data[i * block + j] || 0
      sum += v * v
    }
    out.push(Math.sqrt(sum / block))
  }
  const max = Math.max(...out, 0.0001)
  return out.map(v => Math.max(0.08, v / max))
}

/**
 * Telegram-style voice note: a decoded waveform with a play/pause control, a
 * progress cursor, drag-to-scrub and a playback-speed pill. Powered by
 * react-native-audio-api (decode + playback). Falls back to a tappable MediaCard
 * if decoding fails. Only mounted when audio-api is available.
 */
export function WaveformPlayer ({ uri, position = 'left', duration: durationProp }: WaveformPlayerProps) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const playerId = useId()

  const [bars, setBars] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [rate, setRate] = useState(1)
  const [trackWidth, setTrackWidth] = useState(0)

  const ctxRef = useRef<any>(null)
  const bufferRef = useRef<any>(null)
  const sourceRef = useRef<any>(null)
  const startedAtRef = useRef(0)
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const durationRef = useRef(durationProp ?? 0)
  const rateRef = useRef(1)
  // Latest progress, readable from callbacks that must not re-subscribe on
  // every frame (the scrub gesture and the resume offset).
  const progressRef = useRef(0)
  progressRef.current = progress

  const barCount = trackWidth > 0
    ? Math.max(8, Math.floor(trackWidth / (BAR_WIDTH + BAR_GAP)))
    : FALLBACK_BAR_COUNT

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
        setBars(downsample(buffer.getChannelData(0), barCount))
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
    // `barCount` intentionally omitted: it settles on first layout, and
    // re-decoding the file on a width change would be wasteful. The bar list is
    // re-bucketed separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, stopRaf, playerId, durationProp])

  // Re-bucket an already-decoded waveform when the measured width changes.
  useEffect(() => {
    const buffer = bufferRef.current
    if (!buffer || trackWidth <= 0)
      return

    setBars(downsample(buffer.getChannelData(0), barCount))
  }, [barCount, trackWidth])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    const duration = durationRef.current
    if (!ctx || duration <= 0)
      return

    const elapsed = (ctx.currentTime - startedAtRef.current) * rateRef.current
    const next = Math.min(1, elapsed / duration)
    setProgress(next)

    if (next >= 1) {
      setIsPlaying(false)
      setProgress(0)
      stopRaf()
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopRaf])

  const stopSource = useCallback(() => {
    try {
      sourceRef.current?.stop?.()
    } catch {
      // already stopped
    }
    sourceRef.current = null
    stopRaf()
    setIsPlaying(false)
  }, [stopRaf])

  const playFrom = useCallback((fraction: number) => {
    const ctx = ctxRef.current
    const buffer = bufferRef.current
    if (!ctx || !buffer)
      return

    try {
      // Replace any source already running (a scrub mid-playback).
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
      // `stop()` also fires `ended`, so a pause or a scrub would otherwise run
      // the completion handler and rewind the note. Only the source still owning
      // playback may reset the cursor.
      source.onended = () => {
        if (sourceRef.current !== source)
          return

        sourceRef.current = null
        releasePlayback(playerId)
        setIsPlaying(false)
        setProgress(0)
        stopRaf()
      }

      const offset = fraction > 0 && fraction < 1 ? fraction * durationRef.current : 0
      startedAtRef.current = ctx.currentTime - offset / rateRef.current
      source.start(0, offset)
      sourceRef.current = source
      setIsPlaying(true)
      // Starting stops whatever else was playing, the way Telegram does.
      claimPlayback(playerId, stopSource)
      stopRaf()
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setFailed(true)
    }
  }, [tick, stopRaf, playerId, stopSource])

  const pause = useCallback(() => {
    stopSource()
    releasePlayback(playerId)
  }, [stopSource, playerId])

  const togglePlayback = useCallback(() => {
    if (isPlaying)
      pause()
    else
      playFrom(progressRef.current)
  }, [isPlaying, pause, playFrom])

  const cycleRate = useCallback(() => {
    const next = SPEED_STEPS[(SPEED_STEPS.indexOf(rateRef.current as 1) + 1) % SPEED_STEPS.length]
    rateRef.current = next
    setRate(next)

    // Re-seat a running source so the new rate takes effect immediately.
    if (sourceRef.current)
      playFrom(progressRef.current)
  }, [playFrom])

  // Tap or drag anywhere on the waveform to seek, like Telegram's scrubber.
  const seekTo = useCallback((x: number) => {
    if (trackWidth <= 0 || durationRef.current <= 0)
      return

    const fraction = Math.max(0, Math.min(1, x / trackWidth))
    setProgress(fraction)
    progressRef.current = fraction

    if (sourceRef.current)
      playFrom(fraction)
  }, [trackWidth, playFrom])

  // A tap seeks; a horizontal drag scrubs. The pan must only claim horizontal
  // movement, or it fights the message list: without these offsets a vertical
  // drag over a voice note either scrolled *and* scrubbed, or was swallowed
  // entirely and left the note seeking to wherever the finger went down.
  const scrubGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Tap().onEnd(event => {
          runOnJS(seekTo)(event.x)
        }),
        Gesture.Pan()
          .activeOffsetX([-6, 6])
          .failOffsetY([-12, 12])
          .onUpdate(event => {
            runOnJS(seekTo)(event.x)
          })
      ),
    [seekTo]
  )

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width)
  }, [])

  if (failed)
    return <MediaCard kind='audio' uri={uri} position={position} />

  const displayBars = bars.length ? bars : new Array(barCount).fill(0).map((_, i) => 0.25 + 0.15 * Math.sin(i))
  const playedBars = Math.round(progress * displayBars.length)
  const elapsedTime = isPlaying || progress > 0
    ? progress * durationRef.current
    : (durationRef.current || durationProp || 0)

  return (
    <View style={styles.row}>
      <Pressable
        onPress={togglePlayback}
        disabled={isLoading}
        accessibilityRole='button'
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
        accessibilityLabel={isPlaying ? 'pause' : 'play'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.playCircle, isLoading && styles.playCircleLoading]}
      >
        {isPlaying
          ? <Icon name='pause' color={styles.glyphColor.color} size={14} fallback={<PauseIcon color={styles.glyphColor.color} size={14} />} />
          : <Icon name='play' color={styles.glyphColor.color} size={14} fallback={<PlayIcon color={styles.glyphColor.color} size={14} />} />}
      </Pressable>

      <GestureDetector gesture={scrubGesture}>
        <View
          style={styles.waveform}
          onLayout={onTrackLayout}
          accessibilityRole='adjustable'
          accessibilityLabel='seek'
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          {displayBars.map((value, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                // Heights are per-sample runtime values, so they stay inline.
                { height: BAR_MIN_HEIGHT + value * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) },
                index < playedBars ? styles.barPlayed : styles.barUnplayed,
                isLoading && styles.barLoading,
              ]}
            />
          ))}
        </View>
      </GestureDetector>

      <View style={styles.metaColumn}>
        <Text style={styles.time}>{formatTime(elapsedTime)}</Text>
        {(isPlaying || progress > 0) && (
          <Pressable
            onPress={cycleRate}
            accessibilityRole='button'
            accessibilityLabel={`playback speed ${rate}x`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.speedPill}
          >
            <Text style={styles.speedText}>{rate}x</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const palette = getMediaPalette(theme, position)

  return StyleSheet.create({
    // Carries the glyph color out of JSX and into the stylesheet.
    glyphColor: {
      color: palette.glyph,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      gap: 10,
      minWidth: 200,
    },
    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playCircleLoading: {
      opacity: 0.5,
    },
    waveform: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: BAR_MAX_HEIGHT + 4,
      gap: BAR_GAP,
    },
    bar: {
      width: BAR_WIDTH,
      borderRadius: BAR_WIDTH / 2,
    },
    barPlayed: {
      backgroundColor: palette.progress,
    },
    barUnplayed: {
      backgroundColor: palette.track,
    },
    // Decoding: the placeholder comb reads as inert rather than as real data.
    barLoading: {
      opacity: 0.4,
    },
    metaColumn: {
      alignItems: 'flex-end',
      gap: 3,
    },
    time: {
      fontSize: 12,
      color: palette.meta,
      minWidth: 34,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    speedPill: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: palette.track,
    },
    speedText: {
      fontSize: 10,
      fontWeight: '600',
      color: palette.meta,
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
