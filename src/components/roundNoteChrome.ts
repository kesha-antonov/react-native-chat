import { useEffect } from 'react'
import { Easing, ReduceMotion, SharedValue, useSharedValue, withTiming } from 'react-native-reanimated'

/*
 * Numbers and state for the chrome drawn on a playing round note: the progress ring, the paused seek
 * knob and its vignette. Reimplemented from the observed behaviour.
 */

// The chat list animates a row's size change over 250ms on this curve.
export const NOTE_GROW_MS = 250
export const noteGrowEasing = Easing.bezier(0.199, 0.011, 0.279, 0.91)

/** The progress ring: white at 0x9f alpha, 3dp, round caps. */
export const RING_OPACITY = 0x9f / 255
export const RING_STROKE = 3
/** The ring sits 1.5dp inside the circle's edge... */
export const RING_EDGE_INSET = 1.5
/** ...4dp further in while the note plays grown (`isPlayingRound`)... */
export const RING_PLAYING_INSET = 4
/** ...and another 16dp in while paused, so the knob has room. */
export const RING_PAUSED_INSET = 16
/** A paused ring's stroke grows by half. */
export const RING_PAUSED_STROKE_GAIN = 0.5
/** The full track drawn under a paused ring, as a share of the ring alpha. */
export const TRACK_OPACITY = 0.3
/** Knob radius: 3dp, +5dp as the pause settles, +3dp while dragged. */
export const KNOB_RADIUS = 3
export const KNOB_PAUSED_GAIN = 5
export const KNOB_DRAG_GAIN = 3

/** `roundToPauseProgress` steps in over 220ms and back out over 150ms. */
export const PAUSE_IN_MS = 220
export const PAUSE_OUT_MS = 150
/** `roundProgressAlpha`, `roundToPauseProgress2`, `roundSeekbarOutAlpha`. */
export const FADE_MS = 150

/** The ring a paused note can be scrubbed along (`checkRoundSeekbar`, 64dp / 2). */
export const SEEK_RING_WIDTH = 32
/** Grabbing the knob itself: a 40dp box around it. */
export const SEEK_KNOB_SLOP = 20

/** The closed transcribe button beside a round note: a 32dp circle (`transcribeButton.setBounds`). */
export const ROUND_TRANSCRIBE_SIZE = 32
/** Its gap from the note's side. */
export const ROUND_TRANSCRIBE_GAP = 8
/** Grown to play, it slides in over the circle's empty corner: 40dp on an incoming note... */
export const ROUND_TRANSCRIBE_GROWN_IN = 40
/** ...28dp on an outgoing one, and an incoming one also rises 28dp (`playingRoundAlpha`). */
export const ROUND_TRANSCRIBE_GROWN_OUT = 28
export const ROUND_TRANSCRIBE_GROWN_LIFT = 28

/**
 * Where the transcribe button beside a round note:
 * just past the right side of an incoming note, or the left side of an
 * outgoing one, level with its bottom. As the note grows to fill the screen
 * width there is no room outside it, so the button moves in onto the corner of
 * the circle's square, which the video does not cover. `left` is from the
 * note's own left edge, `bottom` from its bottom; `grow` is 0..1.
 */
export const roundTranscribePosition = (isIncoming: boolean, size: number, grow: number) => {
  'worklet'
  if (isIncoming)
    return {
      left: size + ROUND_TRANSCRIBE_GAP - ROUND_TRANSCRIBE_GROWN_IN * grow,
      bottom: ROUND_TRANSCRIBE_GROWN_LIFT * grow,
    }
  return {
    left: -(ROUND_TRANSCRIBE_SIZE + ROUND_TRANSCRIBE_GAP) + ROUND_TRANSCRIBE_GROWN_OUT * grow,
    bottom: 0,
  }
}

/**
 * Android's `OvershootInterpolator` at its default tension of 2, which
 * applied to the ring moving in as a note pauses.
 */
export const overshoot = (t: number) => {
  'worklet'
  const u = t - 1
  return u * u * (3 * u + 2) + 1
}

/**
 * How far the pause has moved the ring in: overshooting on the way in, linear
 * on the way out, as `drawRoundProgress` switches on `drawPause`.
 */
export const pausedAmount = (raw: number, isPaused: number) => {
  'worklet'
  return isPaused ? overshoot(raw) : raw
}

/** Radius of the ring's centre line inside a note of `size`. */
export const ringRadius = (size: number, grow: number, pause: number) => {
  'worklet'
  return size / 2 - RING_EDGE_INSET - RING_PLAYING_INSET * grow - RING_PAUSED_INSET * pause
}

/**
 * Where the knob sits for `progress`, clockwise from 12 o'clock, in the
 * note's own coordinates.
 */
export const knobPoint = (size: number, radius: number, progress: number) => {
  'worklet'
  const angle = 2 * Math.PI * progress
  return {
    x: size / 2 + radius * Math.sin(angle),
    y: size / 2 - radius * Math.cos(angle),
  }
}

/** The playhead for a touch, clockwise from 12 o'clock, 0..1. */
export const angleToFraction = (size: number, x: number, y: number) => {
  'worklet'
  const half = size / 2
  let degrees = (Math.atan2(y - half, x - half) * 180) / Math.PI + 90
  if (degrees < 0)
    degrees += 360
  return degrees / 360
}

/**
 * Whether a touch may start a scrub: on the knob, or anywhere in the outer
 * band. The band reaches a little
 * past the edge so a touch landing just outside the circle still counts.
 */
export const isSeekTouch = (size: number, knob: { x: number, y: number }, x: number, y: number) => {
  'worklet'
  if (Math.abs(x - knob.x) <= SEEK_KNOB_SLOP && Math.abs(y - knob.y) <= SEEK_KNOB_SLOP)
    return true

  const half = size / 2
  const distance = Math.hypot(x - half, y - half)
  return distance >= half - SEEK_RING_WIDTH && distance <= half + 8
}

/** Dragging past 12 o'clock jumps the playhead across the whole circle. */
export const isWrap = (from: number, to: number) => {
  'worklet'
  return Math.abs(to - from) > 0.9
}

export interface RoundNoteChrome {
  /** Playhead, 0..1. Written straight from the sampler and the drag. */
  progress: SharedValue<number>
  /** `roundProgressAlpha`: 1 while current, fading out after. */
  ringAlpha: SharedValue<number>
  /** 0..1 with the note's grow (`isPlayingRound`). */
  grow: SharedValue<number>
  /** `roundToPauseProgress`, linear. */
  pause: SharedValue<number>
  /** 1 while paused, picking the overshoot curve for `pause`. */
  isPaused: SharedValue<number>
  /** `roundToPauseProgress2`: the knob swelling under a finger. */
  drag: SharedValue<number>
  /** `roundSeekbarOutAlpha` / `roundSeekbarOutProgress`: the arc left behind by a wrap. */
  wrapAlpha: SharedValue<number>
  wrapProgress: SharedValue<number>
}

/** The animated state behind a round note's ring, knob and vignette. */
export const useRoundNoteChrome = ({
  isCurrent,
  isPlaying,
  isGrown,
}: {
  isCurrent: boolean
  isPlaying: boolean
  isGrown: boolean
}): RoundNoteChrome => {
  const isPausedNow = isCurrent && !isPlaying
  // Mounted at rest, so nothing animates as a row scrolls into view.
  const progress = useSharedValue(0)
  const ringAlpha = useSharedValue(isCurrent ? 1 : 0)
  const grow = useSharedValue(isGrown ? 1 : 0)
  const pause = useSharedValue(isPausedNow ? 1 : 0)
  const isPaused = useSharedValue(isPausedNow ? 1 : 0)
  const drag = useSharedValue(0)
  const wrapAlpha = useSharedValue(0)
  const wrapProgress = useSharedValue(0)

  // The ring shows at full strength the moment a note becomes
  // current and only fades it once it stops, holding the last position.
  useEffect(() => {
    ringAlpha.value = isCurrent ? 1 : withTiming(0, { duration: FADE_MS })
  }, [isCurrent, ringAlpha])

  useEffect(() => {
    grow.value = withTiming(isGrown ? 1 : 0, { duration: NOTE_GROW_MS, easing: noteGrowEasing })
  }, [isGrown, grow])

  // The ring slides from the edge in to the paused track and back out on
  // play. It always animates: with the system's Reduce Motion on, Reanimated
  // would jump it, and the ring would seem to teleport between two sizes.
  useEffect(() => {
    isPaused.value = isPausedNow ? 1 : 0
    pause.value = withTiming(isPausedNow ? 1 : 0, {
      duration: isPausedNow ? PAUSE_IN_MS : PAUSE_OUT_MS,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    })
  }, [isPausedNow, isPaused, pause])

  return { progress, ringAlpha, grow, pause, isPaused, drag, wrapAlpha, wrapProgress }
}
