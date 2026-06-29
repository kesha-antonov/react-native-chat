import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { MediaCard } from './MediaCard'
import { PauseIcon, PlayIcon } from './MediaControls'

// Optional waveform engine. Resolved through a try/catch require so the bundle
// works whether or not the consumer installed `react-native-audio-api`.
let audioApi: any = null
try {
  audioApi = require('react-native-audio-api')
} catch {
  audioApi = null
}

export const isWaveformAvailable = !!audioApi?.AudioContext

const BAR_COUNT = 40

export interface WaveformPlayerProps {
  uri: string
  position?: 'left' | 'right'
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
 * Telegram-style voice note: a decoded waveform with a play/pause control and a
 * progress cursor. Powered by react-native-audio-api (decode + playback). Falls
 * back to a tappable MediaCard if decoding fails. Only mounted when audio-api
 * is available.
 */
export function WaveformPlayer ({ uri, position = 'left' }: WaveformPlayerProps) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)

  const [bars, setBars] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const ctxRef = useRef<any>(null)
  const bufferRef = useRef<any>(null)
  const sourceRef = useRef<any>(null)
  const startedAtRef = useRef(0)
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const durationRef = useRef(0)

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
        const buffer = await ctx.decodeAudioDataSource(uri)
        if (cancelled)
          return

        bufferRef.current = buffer
        durationRef.current = buffer.duration ?? 0
        setBars(downsample(buffer.getChannelData(0), BAR_COUNT))
      } catch {
        if (!cancelled)
          setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      stopRaf()
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
  }, [uri, stopRaf])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    const duration = durationRef.current
    if (!ctx || duration <= 0)
      return

    const elapsed = ctx.currentTime - startedAtRef.current
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

  const play = useCallback(() => {
    const ctx = ctxRef.current
    const buffer = bufferRef.current
    if (!ctx || !buffer)
      return

    try {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        setIsPlaying(false)
        setProgress(0)
        stopRaf()
      }
      const offset = progress > 0 && progress < 1 ? progress * durationRef.current : 0
      startedAtRef.current = ctx.currentTime - offset
      source.start(0, offset)
      sourceRef.current = source
      setIsPlaying(true)
      stopRaf()
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setFailed(true)
    }
  }, [progress, tick, stopRaf])

  const pause = useCallback(() => {
    try {
      sourceRef.current?.stop?.()
    } catch {
      // already stopped
    }
    sourceRef.current = null
    stopRaf()
    setIsPlaying(false)
  }, [stopRaf])

  const togglePlayback = useCallback(() => {
    if (isPlaying)
      pause()
    else
      play()
  }, [isPlaying, play, pause])

  if (failed)
    return <MediaCard kind='audio' uri={uri} position={position} />

  const playedBars = Math.round(progress * (bars.length || BAR_COUNT))
  const elapsedTime = isPlaying || progress > 0 ? progress * durationRef.current : durationRef.current

  return (
    <View style={styles.row}>
      <Pressable
        onPress={togglePlayback}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'pause' : 'play'}
        style={styles.playCircle}
      >
        {isPlaying
          ? <Icon name='pause' color='#fff' size={14} fallback={<PauseIcon color='#fff' size={14} />} />
          : <Icon name='play' color='#fff' size={14} fallback={<PlayIcon color='#fff' size={14} />} />}
      </Pressable>
      <View style={styles.waveform}>
        {(bars.length ? bars : new Array(BAR_COUNT).fill(0.2)).map((value, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { height: 4 + value * 20 },
              index < playedBars ? styles.barPlayed : styles.barUnplayed,
            ]}
          />
        ))}
      </View>
      <Text style={styles.time}>{formatTime(elapsedTime)}</Text>
    </View>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const inactive = position === 'right' ? theme.colors.outgoingMeta : theme.colors.incomingMeta
  const metaColor = position === 'right' ? theme.colors.outgoingMeta : theme.colors.incomingMeta

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      gap: 10,
      minWidth: 220,
    },
    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waveform: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 26,
      gap: 2,
    },
    bar: {
      flex: 1,
      borderRadius: 2,
      minWidth: 2,
    },
    barPlayed: {
      backgroundColor: theme.colors.accent,
    },
    barUnplayed: {
      backgroundColor: inactive,
      opacity: 0.5,
    },
    time: {
      fontSize: 12,
      color: metaColor,
      minWidth: 34,
      textAlign: 'right',
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')
