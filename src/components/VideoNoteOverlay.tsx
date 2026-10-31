import React, { useEffect, useId, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useTheme } from '../hooks/useTheme'
import { PlayIcon } from './MediaControls'
import { PlayingBars, UnreadDot } from './NoteIndicators'
import {
  KNOB_DRAG_GAIN,
  KNOB_PAUSED_GAIN,
  KNOB_RADIUS,
  RING_OPACITY,
  RING_PAUSED_STROKE_GAIN,
  RING_STROKE,
  RoundNoteChrome,
  TRACK_OPACITY,
  pausedAmount,
  ringRadius,
} from './roundNoteChrome'
import { ViewOnceBadge } from './ViewOnceBadge'

/** Telegram's play <-> none transition on a media button (`MediaActionDrawable`). */
const BADGE_MS = 220

/** A badge that scales and fades in or out instead of popping. */
const FadingBadge = ({ isVisible, style, children }: { isVisible: boolean, style: object, children: React.ReactNode }) => {
  // Mounted in its resting state, so nothing animates as the row appears.
  const visibility = useSharedValue(isVisible ? 1 : 0)
  useEffect(() => {
    visibility.value = withTiming(isVisible ? 1 : 0, { duration: BADGE_MS })
  }, [isVisible, visibility])
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ scale: visibility.value }],
  }))

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
}

// Optional SVG, used to draw the ring, the paused knob and its vignette. When
// absent the note still plays, just without them - the same optional-require
// pattern the recorder uses.
let Svg: any = null
let SvgCircle: any = null
let SvgDefs: any = null
let SvgRadialGradient: any = null
let SvgStop: any = null
let AnimatedCircle: any = null
try {
  const svg = require('react-native-svg')
  Svg = svg.Svg ?? svg.default
  SvgCircle = svg.Circle
  SvgDefs = svg.Defs
  SvgRadialGradient = svg.RadialGradient
  SvgStop = svg.Stop
  AnimatedCircle = SvgCircle ? Animated.createAnimatedComponent(SvgCircle) : null
} catch {
  Svg = null
  SvgCircle = null
  AnimatedCircle = null
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0)
    seconds = 0

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/** A speaker glyph, crossed through when muted. */
export const SpeakerIcon = ({ size = 14, isMuted }: { size?: number, isMuted: boolean }) => {
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
  /** Diameter of the note this overlays, following its grow. */
  size: SharedValue<number>
  /** The largest the note gets, which sizes the ring's dash pattern. */
  maxSize: number
  chrome: RoundNoteChrome
  /** Owns playback, playing or paused (`isPlayingMessage`). */
  isCurrent: boolean
  /** Looping silently in the list (autoplay). */
  isMuted: boolean
  /** A view-once note (Telegram's `isRoundOnce`): the "1" marker on its play button. */
  isViewOnce?: boolean
  /** The view-once note has started; its marker is gone for good. */
  hasViewOnceStarted?: boolean
  /** Can no longer be played (a spent view-once note): the play button dims. */
  isDisabled?: boolean
}

/** `drawRadialProgress` puts the period badge 18dp right and down of the play button's centre. */
const ROUND_VIEW_ONCE_OFFSET = 18
/** The play button's own dim, which the badge disc shares, as Telegram blurs both from the frame. */
const BADGE_BACKGROUND = 'rgba(0, 0, 0, 0.45)'

/** Telegram's `RoundVideoProgressShadow`: clear to 70% of the radius, then black at 40/255. */
const VIGNETTE_OPACITY = 40 / 255

/**
 * The darkened rim behind a paused note's knob, so the white ring reads over
 * a bright frame. It fades in with the pause.
 *
 * Drawn once at the grown size and scaled with the note: a static SVG is not
 * redrawn when its view resizes, so a percentage-sized one kept the note's
 * resting size and sat in the top-left corner of a grown note.
 */
const Vignette = ({ size, maxSize, chrome }: { size: SharedValue<number>, maxSize: number, chrome: RoundNoteChrome }) => {
  const id = `note-vignette-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const style = useAnimatedStyle(() => ({
    opacity: chrome.pause.value,
    transform: [{ scale: maxSize > 0 ? size.value / maxSize : 1 }],
  }))

  return (
    <Animated.View
      style={[
        styles.vignette,
        { width: maxSize, height: maxSize, marginLeft: -maxSize / 2, marginTop: -maxSize / 2 },
        style,
      ]}
    >
      <Svg width={maxSize} height={maxSize}>
        <SvgDefs>
          <SvgRadialGradient id={id} cx='50%' cy='50%' r='50%'>
            <SvgStop offset='0' stopColor='#000000' stopOpacity={0} />
            <SvgStop offset='0.7' stopColor='#000000' stopOpacity={0} />
            <SvgStop offset='1' stopColor='#000000' stopOpacity={VIGNETTE_OPACITY} />
          </SvgRadialGradient>
        </SvgDefs>
        <SvgCircle cx={maxSize / 2} cy={maxSize / 2} r={maxSize / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

/**
 * Telegram's `drawRoundProgress`: the elapsed arc, and once paused a full
 * track, a knob at the playhead, and the arc a wrap past 12 o'clock leaves
 * behind. All of it is driven on the UI thread from `chrome`.
 *
 * The SVG is turned a quarter back so its circles start at 12 o'clock, which
 * is why the knob below is placed with cos / sin swapped from the note's own
 * coordinates (`knobPoint`).
 */
const Ring = ({ size, maxSize, chrome }: { size: SharedValue<number>, maxSize: number, chrome: RoundNoteChrome }) => {
  // A static dash longer than any circumference, so only the offset animates:
  // an animated dash array is not reliably applied to native SVG.
  const dash = Math.PI * maxSize
  const dashArray = [dash, dash]

  const trackProps = useAnimatedProps(() => {
    const pause = pausedAmount(chrome.pause.value, chrome.isPaused.value)
    return {
      r: Math.max(0, ringRadius(size.value, chrome.grow.value, pause)),
      strokeWidth: RING_STROKE * (1 + RING_PAUSED_STROKE_GAIN * chrome.pause.value),
      strokeOpacity: RING_OPACITY * TRACK_OPACITY * chrome.pause.value * chrome.ringAlpha.value,
    }
  })

  const arcProps = (progress: number, alpha: number) => {
    'worklet'
    const pause = pausedAmount(chrome.pause.value, chrome.isPaused.value)
    const radius = Math.max(0, ringRadius(size.value, chrome.grow.value, pause))
    return {
      r: radius,
      strokeWidth: RING_STROKE * (1 + RING_PAUSED_STROKE_GAIN * chrome.pause.value),
      strokeDashoffset: dash - 2 * Math.PI * radius * Math.max(0, Math.min(1, progress)),
      strokeOpacity: RING_OPACITY * chrome.ringAlpha.value * alpha,
    }
  }

  // While a wrap fades out, the new arc fades in against it.
  const progressProps = useAnimatedProps(() => arcProps(chrome.progress.value, 1 - chrome.wrapAlpha.value))
  const wrapProps = useAnimatedProps(() => arcProps(chrome.wrapProgress.value, chrome.wrapAlpha.value))

  // The knob is a plain view moved around the centre: a transform keeps it
  // where the ring is, whatever the note's size is at that moment.
  const knobStyle = useAnimatedStyle(() => {
    const pause = pausedAmount(chrome.pause.value, chrome.isPaused.value)
    const radius = ringRadius(size.value, chrome.grow.value, pause)
    const angle = 2 * Math.PI * chrome.progress.value
    const knob = Math.max(0, KNOB_RADIUS + KNOB_PAUSED_GAIN * pause + KNOB_DRAG_GAIN * chrome.drag.value)
    return {
      width: knob * 2,
      height: knob * 2,
      borderRadius: knob,
      marginLeft: -knob,
      marginTop: -knob,
      opacity: Math.min(1, Math.max(0, pause)) * chrome.ringAlpha.value,
      // Clockwise from 12 o'clock, in the note's own (unrotated) frame.
      transform: [
        { translateX: radius * Math.sin(angle) },
        { translateY: -radius * Math.cos(angle) },
      ],
    }
  })

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Centred by percentage rather than by animated `cx`/`cy`: an SVG
          circle that ever renders without its animated centre is drawn
          around the corner, a grey ring at the top-left of the note. */}
      <Svg width='100%' height='100%' style={styles.ringRotation}>
        <AnimatedCircle animatedProps={trackProps} cx='50%' cy='50%' stroke='#FFFFFF' fill='none' />
        <AnimatedCircle
          animatedProps={wrapProps}
          cx='50%'
          cy='50%'
          stroke='#FFFFFF'
          fill='none'
          strokeLinecap='round'
          strokeDasharray={dashArray}
        />
        <AnimatedCircle
          animatedProps={progressProps}
          cx='50%'
          cy='50%'
          stroke='#FFFFFF'
          fill='none'
          strokeLinecap='round'
          strokeDasharray={dashArray}
        />
      </Svg>
      <Animated.View style={[styles.knob, knobStyle]} />
    </View>
  )
}

/**
 * Chrome drawn *on* a round video note: the progress ring sweeping its edge,
 * the paused scrubber, a mute badge while it loops silently, and a play
 * button while it rests. Nothing sits in the middle of a current note,
 * playing or paused (Telegram's `ICON_NONE`) - a paused one shows its knob
 * instead.
 *
 * The duration is deliberately not here - Telegram renders it under the circle
 * on the chat background, so it lives in `MessageVideo` beside the note.
 *
 * Non-interactive: the note's own press target handles taps.
 */
export function VideoNoteOverlay ({
  size,
  maxSize,
  chrome,
  isCurrent,
  isMuted,
  isViewOnce = false,
  hasViewOnceStarted = false,
  isDisabled = false,
}: VideoNoteOverlayProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      {Svg && SvgRadialGradient && SvgStop && SvgDefs && <Vignette size={size} maxSize={maxSize} chrome={chrome} />}
      {Svg && AnimatedCircle && <Ring size={size} maxSize={maxSize} chrome={chrome} />}

      <FadingBadge isVisible={!isCurrent && isMuted} style={styles.muteBadge}>
        <SpeakerIcon isMuted size={14} />
      </FadingBadge>
      <FadingBadge isVisible={!isCurrent && !isMuted} style={styles.centerBadge}>
        <View style={isDisabled && styles.disabled}>
          <PlayIcon color='#fff' size={18} />
        </View>
      </FadingBadge>
      {isViewOnce && (
        <View style={styles.viewOnceAnchor}>
          {/* Telegram clears a ring round the badge so the frame shows
              through; here the cut is left transparent over the video. */}
          <ViewOnceBadge
            isVisible={!isCurrent && !hasViewOnceStarted}
            color={BADGE_BACKGROUND}
            glyphColor='#fff'
            cutColor='transparent'
            offset={ROUND_VIEW_ONCE_OFFSET}
          />
        </View>
      )}
    </View>
  )
}

/** Telegram's duration pill: 17dp tall, 6dp corners, 8dp in from the note. */
const META_HEIGHT = 17
const META_LEFT = 8
/** An outgoing note's pill rides right by a fifth of the grow (`offsetSize`). */
const META_OUTGOING_SHIFT = 0.2
/** The pill paints the service colour at half its own opacity. */
const META_BACKGROUND_OPACITY = 0.5

/**
 * The length in a small pill at the note's bottom-left, as Telegram draws it.
 * Beside it the unread dot, which shrinks into playing bars once the note is
 * heard; the bars move while it plays and hold still while it is paused.
 */
export function VideoNoteMeta ({
  duration,
  isWatched,
  isPlaying,
  grow,
  growDistance = 0,
  isOutgoing = false,
}: {
  duration?: number
  isWatched: boolean
  isPlaying: boolean
  /** 0..1 with the note's grow, from `useRoundNoteChrome`. */
  grow?: SharedValue<number>
  /** How much wider the note gets when it grows. */
  growDistance?: number
  isOutgoing?: boolean
}) {
  const theme = useTheme()
  const shift = isOutgoing ? growDistance * META_OUTGOING_SHIFT : 0
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift * (grow?.value ?? 0) }],
  }))
  if (duration == null)
    return null

  const color = theme.colors.dayPillText
  return (
    <Animated.View style={[styles.metaPill, shiftStyle]} pointerEvents='none'>
      {/* Faded on its own layer so the text keeps full strength. */}
      <View style={[styles.metaBackground, { backgroundColor: theme.colors.dayPillBackground }]} />
      <Text style={[styles.metaText, { color }]}>{formatTime(duration)}</Text>
      <View style={styles.metaIndicator}>
        {isWatched || isPlaying
          ? <PlayingBars isAnimating={isPlaying} color={color} />
          : <UnreadDot isVisible color={color} />}
      </View>
    </Animated.View>
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
  // The play button's box, without its fill, so the badge places like it does on a voice note.
  viewOnceAnchor: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
  },
  disabled: {
    opacity: 0.5,
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
  // In the empty corner of the circle's square, clear of the video. Width is
  // Telegram's text + 22dp: 4 before the text, then a 12dp indicator slot
  // starting 2 after it, then 4.
  metaPill: {
    position: 'absolute',
    left: META_LEFT,
    bottom: 0,
    height: META_HEIGHT,
    paddingLeft: 4,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 6,
    opacity: META_BACKGROUND_OPACITY,
  },
  metaIndicator: {
    width: 12,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringRotation: {
    transform: [{ rotate: '-90deg' }],
  },
  vignette: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  knob: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    backgroundColor: '#FFFFFF',
  },
  metaText: {
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
