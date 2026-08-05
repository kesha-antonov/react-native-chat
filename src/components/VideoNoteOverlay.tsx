import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

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
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** A speaker glyph, crossed through when muted. Drawn with Views, no SVG. */
const SpeakerIcon = ({ size = 12, isMuted }: { size?: number, isMuted: boolean }) => {
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
  /** Length in seconds; falls back to the elapsed label when unknown. */
  duration?: number
  isMuted: boolean
  isPlaying: boolean
}

/**
 * Telegram's chrome on a round video note: a progress ring sweeping the circle's
 * edge, plus a duration pill carrying a speaker glyph so the note reads as
 * muted-until-tapped.
 *
 * Purely decorative - it never intercepts touches, so the note's own press
 * target keeps working.
 */
export function VideoNoteOverlay ({
  size,
  progress,
  duration,
  isMuted,
  isPlaying,
}: VideoNoteOverlayProps) {
  const stroke = 2.5
  const radius = size / 2 - stroke / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const remaining = duration != null
    ? (isPlaying || clamped > 0 ? duration * (1 - clamped) : duration)
    : undefined

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      {SvgCircle && clamped > 0 && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke='rgba(255,255,255,0.25)'
            strokeWidth={stroke}
            fill='none'
          />
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

      {remaining != null && (
        <View style={styles.pill}>
          <SpeakerIcon isMuted={isMuted} />
          <Text style={styles.pillText}>{formatTime(remaining)}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Sits inside the circle's lower edge, where a corner anchor would fall
  // outside the round shape.
  pill: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
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
