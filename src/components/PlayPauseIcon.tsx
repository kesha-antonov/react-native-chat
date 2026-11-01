import React, { useEffect, useRef } from 'react'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'

import { useIcons } from '../hooks/useIcons'
import { getSvg } from '../optional'
import { Icon } from './Icon'
import { PauseIcon, PlayIcon } from './MediaControls'

// Optional SVG, as everywhere else: without it the button swaps static glyphs.
const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedPath: any = svg?.Path ? Animated.createAnimatedComponent(svg.Path) : null

/** Telegram's play <-> pause transition (`MediaActionDrawable.setIcon`). */
const MORPH_MS = 300

// The transition runs on a 500-step timeline (`ms = 500 * p`): the icon turns a
// quarter, overshooting by 5 degrees, while the shape changes in the middle.
const TIMELINE = 500
const TURN_END = 384
const SETTLE = 100
const SHAPE_FROM = 166
const SHAPE_TO = 383

// Points of one half of the icon, in a 24-unit box centred on 0. The lower half
// is the mirror image. Play points right; pause is two bars lying flat, which
// the quarter turn stands upright.
type Quad = [number, number, number, number, number, number, number, number]
const PLAY_HALF: Quad = [-6.5, -8, 0.5, -4, 7.5, 0, -6.5, 0]
const PAUSE_HALF: Quad = [-6.5, -7.5, 6.5, -7.5, 6.5, -2.5, -6.5, -2.5]

// Telegram's `CubicBezierInterpolator.EASE_BOTH`. Reanimated's Jest mock
// returns a non-function here, hence the linear stand-in.
const bezier = Easing.bezierFn(0.42, 0, 0.58, 1)
const easeBoth = typeof bezier === 'function'
  ? bezier
  : (x: number) => {
    'worklet'
    return x
  }

const clamp01 = (value: number) => {
  'worklet'
  return Math.min(1, Math.max(0, value))
}

/** Rotation in degrees and shape mix (0 play, 1 pause) at a point of the transition. */
const frame = (t: number, isToPause: boolean) => {
  'worklet'
  const p = isToPause ? t : 1 - t
  const ms = TIMELINE * p
  let rotation: number
  if (isToPause)
    if (ms < TURN_END)
      rotation = 95 * easeBoth(ms / TURN_END)
    else if (ms < TURN_END + SETTLE)
      rotation = 95 - 5 * easeBoth((ms - TURN_END) / SETTLE)
    else
      rotation = 90
  else
    if (ms < SETTLE)
      rotation = -5 * easeBoth(ms / SETTLE)
    else if (ms < TURN_END + SETTLE)
      rotation = -5 + 95 * easeBoth((ms - SETTLE) / TURN_END)
    else
      rotation = 90

  const shapeAt = isToPause ? ms + SETTLE : ms
  const shape = easeBoth(clamp01((shapeAt - SHAPE_FROM) / (SHAPE_TO - SHAPE_FROM)))
  return { rotation, shape, p }
}

const buildPath = (t: number, isToPause: boolean) => {
  'worklet'
  const { rotation, shape, p } = frame(t, isToPause)
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  // Play sits a touch right of centre so it looks centred (Telegram's 1dp).
  const nudge = 1 - p

  let d = ''
  for (const mirror of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const x = PLAY_HALF[i * 2] + (PAUSE_HALF[i * 2] - PLAY_HALF[i * 2]) * shape
      const y = mirror * (PLAY_HALF[i * 2 + 1] + (PAUSE_HALF[i * 2 + 1] - PLAY_HALF[i * 2 + 1]) * shape)
      const rx = x * cos - y * sin + nudge
      const ry = x * sin + y * cos
      d += `${i === 0 ? 'M' : 'L'}${rx.toFixed(2)} ${ry.toFixed(2)} `
    }
    d += 'Z '
  }
  return d
}

interface MorphProps {
  isPlaying: boolean
  color: string
  size: number
}

const MorphingIcon = ({ isPlaying, color, size }: MorphProps) => {
  // Mounted at rest, so a note does not animate as it scrolls into view.
  const progress = useSharedValue(1)
  const isToPause = useSharedValue(isPlaying)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    isToPause.value = isPlaying
    progress.value = 0
    progress.value = withTiming(1, { duration: MORPH_MS, easing: Easing.linear })
  }, [isPlaying, isToPause, progress])

  const animatedProps = useAnimatedProps(() => ({
    d: buildPath(progress.value, isToPause.value),
  }))

  return (
    <Svg width={size} height={size} viewBox='-12 -12 24 24'>
      {/* A round join softens the corners, as Telegram's glyph has. */}
      <AnimatedPath
        animatedProps={animatedProps}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin='round'
      />
    </Svg>
  )
}

export interface PlayPauseIconProps {
  isPlaying: boolean
  color: string
  size: number
}

/**
 * The play/pause glyph of a voice note. It morphs between the two like
 * Telegram's, unless the app overrides the `play` or `pause` icon, which is
 * then drawn as given.
 */
export function PlayPauseIcon ({ isPlaying, color, size }: PlayPauseIconProps) {
  const icons = useIcons()

  if (Svg && AnimatedPath && !icons.play && !icons.pause)
    return <MorphingIcon isPlaying={isPlaying} color={color} size={size} />

  return isPlaying
    ? <Icon name='pause' color={color} size={size} fallback={<PauseIcon color={color} size={size} />} />
    : <Icon name='play' color={color} size={size} fallback={<PlayIcon color={color} size={size} />} />
}
