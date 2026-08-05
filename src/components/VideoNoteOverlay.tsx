import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CloseIcon } from './MediaControls'

// Optional SVG, used to draw the circular progress ring. When absent the note
// still plays, just without the ring - the same optional-require pattern the
// recorder uses.
let Svg: any = null
let SvgCircle: any = null
try {
  const svg = require('react-native-svg')
  Svg = svg.Svg ?? svg.default
  SvgCircle = svg.Circle
} catch {
  Svg = null
  SvgCircle = null
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0)
    seconds = 0

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/** A speaker glyph, crossed through when muted. */
const SpeakerIcon = ({ size = 14, isMuted }: { size?: number, isMuted: boolean }) => {
  const styles = useMemo(() => createSpeakerStyles(size), [size])
  return (
    <View style={styles.wrapper}>
      <View style={styles.body} />
      <View style={styles.cone} />
      {isMuted && <View style={styles.slash} />}
    </View>
  )
}

export interface VideoNoteOverlayProps {
  /** Diameter of the note this overlays. */
  size: number
  /** Playback position, 0..1. */
  progress: number
  isMuted: boolean
  isPlaying: boolean
}

/**
 * Chrome drawn *on* a round video note: the progress ring sweeping its edge, a
 * mute badge while it is silent, and a stop target once it is playing.
 *
 * The duration is deliberately not here - Telegram renders it under the circle
 * on the chat background, so it lives in `MessageVideo` beside the note.
 *
 * Non-interactive: the note's own press target handles taps.
 */
export function VideoNoteOverlay ({
  size,
  progress,
  isMuted,
  isPlaying,
}: VideoNoteOverlayProps) {
  const stroke = 3
  const radius = size / 2 - stroke / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      {SvgCircle && clamped > 0 && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {/* Only the elapsed arc, no track - matching Telegram. */}
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke='#FFFFFF'
            strokeWidth={stroke}
            fill='none'
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      )}

      {isPlaying
        ? (
          // Playing: a stop target in the middle, as Telegram shows.
          <View style={styles.centerBadge}>
            <CloseIcon color='#fff' size={18} />
          </View>
        )
        : isMuted && (
          <View style={styles.muteBadge}>
            <SpeakerIcon isMuted size={14} />
          </View>
        )}
    </View>
  )
}

/** Duration and unwatched dot, rendered under the note on the chat background. */
export function VideoNoteMeta ({
  duration,
  isWatched,
}: {
  duration?: number
  isWatched: boolean
}) {
  if (duration == null)
    return null

  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaText}>{formatTime(duration)}</Text>
      {!isWatched && <View style={styles.unwatchedDot} />}
    </View>
  )
}

const styles = StyleSheet.create({
  centerBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'center',
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.45)',
    fontVariant: ['tabular-nums'],
  },
  // Telegram marks a note you have not played yet with a small accent dot.
  unwatchedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3390EC',
  },
})

const createSpeakerStyles = (size: number) => StyleSheet.create({
  wrapper: {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  body: {
    width: size * 0.3,
    height: size * 0.42,
    backgroundColor: '#FFFFFF',
  },
  cone: {
    width: 0,
    height: 0,
    borderTopWidth: size * 0.42,
    borderBottomWidth: size * 0.42,
    borderRightWidth: size * 0.34,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
    transform: [{ rotate: '180deg' }],
  },
  slash: {
    position: 'absolute',
    width: size * 1.1,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
})
