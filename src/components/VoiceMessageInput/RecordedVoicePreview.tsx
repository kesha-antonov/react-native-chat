import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'

import { useThemedStyles } from '../../hooks/useTheme'
import { claimPlayback, releasePlayback } from '../mediaPlayback'
import { PlayPauseIcon } from '../PlayPauseIcon'
import { formatElapsed } from './formatElapsed'
import { createPreviewStyles } from './previewStyles'
import {
  clamp,
  END_REPLAY_S,
  HANDLE_WIDTH,
  MIN_TRIM_MS,
  MIN_TRIM_WIDTH,
  PREVIEW_BARS,
  resample,
  TRIM_HANDLE_SLOP,
  TRIM_INSET,
} from './previewWaveform'
import { expoAudio } from './recorder'
import { VoiceRecordingPreview } from './types'

export interface RecordedVoicePreviewProps {
  preview: VoiceRecordingPreview
  /** The kept range moved, as fractions of the take. */
  onTrim?: (start: number, end: number) => void
}

type TrimDrag = { kind: 'start' | 'end' | 'seek', wasPlaying: boolean }

/**
 * The paused take in the composer: a
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

  // A drag spans many renders (each trim moves `range`); everything it reads
  // goes through this ref so one drag sees one consistent, current state.
  const live = useRef({ range, width, duration, isPlaying, play, pause, onTrim, player })
  useLayoutEffect(() => {
    live.current = { range, width, duration, isPlaying, play, pause, onTrim, player }
  })
  const dragRef = useRef<TrimDrag | null>(null)

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

  const trimGesture = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: event => {
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
    },
    onUpdate: event => {
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
    },
    onFinalize: () => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag)
        return

      const { range: current, duration: seconds } = live.current
      live.current.onTrim?.(current.start, current.end)

      // Keep playing from where the drag leaves off.
      if (drag.kind === 'seek')
        live.current.play()
      else if (drag.kind === 'start' && drag.wasPlaying)
        live.current.play(current.start * seconds)
      else if (drag.kind === 'end' && drag.wasPlaying)
        live.current.play(Math.max(current.start * seconds, current.end * seconds - END_REPLAY_S))
    },
  })

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
