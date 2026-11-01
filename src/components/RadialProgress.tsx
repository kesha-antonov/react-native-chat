import React, { useEffect, useRef } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { getSvg } from '../optional'
import { PlayPauseIcon } from './PlayPauseIcon'

/*
 * The media button: a filled circle drawing a glyph and a progress arc. The geometry and
 * timings below are specified in a 48-unit box.
 */

const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedPath: any = svg?.Path ? Animated.createAnimatedComponent(svg.Path) : null

/** What the button shows. */
export type MediaActionIcon = 'play' | 'pause' | 'download' | 'cancel' | 'none'

const PLAY = 0
const PAUSE = 1
const DOWNLOAD = 2
const CANCEL = 3
const NONE = 4

const ICON_CODES: Record<MediaActionIcon, number> = {
  play: PLAY,
  pause: PAUSE,
  download: DOWNLOAD,
  cancel: CANCEL,
  none: NONE,
}

/** The drawable's own size; everything scales by `size / 48`. */
const INTRINSIC = 48

/** Download -> cancel runs in three stages. */
const STAGE1 = 0.5
const STAGE2 = 0.2
const STAGE3 = 0.3

/** The arc turns once every 2.5s. */
export const RADIAL_SPIN_MS = 2500
/** And starts at 112 degrees whenever the cancel icon is set. */
const RAD_OFFSET_START = 112
/** Progress eases toward its target over 200ms, decelerating. */
export const RADIAL_PROGRESS_MS = 200
const DECELERATE = Easing.out(Easing.quad)

/** The transition length for a pair of icons. */
export const transitionDuration = (from: MediaActionIcon, to: MediaActionIcon) => {
  if ((from === 'play' && to === 'pause') || (from === 'pause' && to === 'play'))
    return 300
  if (from === 'download' && to === 'cancel')
    return 400
  return 220
}

/** Restarts the ring's turn from 112 degrees. */
const spinRing = (rad: SharedValue<number>) => {
  rad.value = RAD_OFFSET_START
  rad.value = withRepeat(
    withTiming(RAD_OFFSET_START + 360, { duration: RADIAL_SPIN_MS, easing: Easing.linear }),
    -1,
    false
  )
}

const isPlayPause = (icon: number) => {
  'worklet'
  return icon === PLAY || icon === PAUSE
}

const f = (value: number) => {
  'worklet'
  return Math.round(value * 100) / 100
}

/** An SVG elliptical arc, Android's `drawArc(rect, start, sweep)`: degrees, clockwise from 3 o'clock. */
export const arcPath = (cx: number, cy: number, rx: number, ry: number, start: number, sweep: number) => {
  'worklet'
  if (Math.abs(sweep) < 0.01)
    return ''

  // Two halves, so a full ring never has its ends land on the same point (which SVG
  // draws as nothing, or a dot with round caps).
  const clamped = Math.max(-360, Math.min(360, sweep))
  const point = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${f(cx + rx * Math.cos(a))} ${f(cy + ry * Math.sin(a))}`
  }
  const dir = clamped > 0 ? 1 : 0
  const mid = start + clamped / 2
  return `M${point(start)} A${f(rx)} ${f(ry)} 0 0 ${dir} ${point(mid)} `
    + `A${f(rx)} ${f(ry)} 0 0 ${dir} ${point(start + clamped)} `
}

const line = (x1: number, y1: number, x2: number, y2: number) => {
  'worklet'
  return `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} `
}

/** The two strokes of an ✕ of half-size `d`, scaled by `k` and turned `deg` about the centre. */
const crossLines = (c: number, d: number, k: number, deg: number) => {
  'worklet'
  if (d <= 0 || k <= 0)
    return []

  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r) * k
  const sin = Math.sin(r) * k
  const p = (x: number, y: number) => [c + x * cos - y * sin, c + x * sin + y * cos]
  return [...p(-d, -d), ...p(d, d), ...p(d, -d), ...p(-d, d)]
}

const cross = (c: number, d: number, k: number, deg: number) => {
  'worklet'
  if (d <= 0 || k <= 0)
    return ''

  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r) * k
  const sin = Math.sin(r) * k
  const p = (x: number, y: number) => [c + x * cos - y * sin, c + x * sin + y * cos]
  const [ax, ay] = p(-d, -d)
  const [bx, by] = p(d, d)
  const [cx2, cy2] = p(d, -d)
  const [dx, dy] = p(-d, d)
  return line(ax, ay, bx, by) + line(cx2, cy2, dx, dy)
}

export interface RadialFrame {
  /** Download arrow strokes (and the curl it makes into the ring), and their alpha. */
  arrow: string
  arrowAlpha: number
  /** The cancel ✕, and its alpha. */
  cross: string
  crossAlpha: number
  /** The progress arc, and its alpha. */
  arc: string
  arcAlpha: number
  /** The play/pause glyph's scale and alpha. */
  glyphScale: number
  glyphAlpha: number
  /**
   * The same strokes as numbers, for drawing without react-native-svg: the arrow's straight
   * strokes and the ✕'s, as flat `x1 y1 x2 y2` runs, and the arc's start, sweep and radius.
   */
  arrowLines: number[]
  crossLines: number[]
  arcStart: number
  arcSweep: number
  arcRadius: number
}

/**
 * One frame of the media action icon for a drawable `size` across. `t` is
 * `transitionProgress` (1 at rest), `saved` the `savedTransitionProgress` the transition
 * started from, `progress` the eased `animatedDownloadProgress` and `rad` the arc's
 * `downloadRadOffset`.
 */
export const radialFrame = (
  current: number,
  next: number,
  t: number,
  saved: number,
  progress: number,
  rad: number,
  size: number,
  isMini: boolean
): RadialFrame => {
  'worklet'
  const scale = size / INTRINSIC
  const c = size / 2
  const animating = current !== next && t < 1
  const out: RadialFrame = {
    arrow: '',
    arrowAlpha: 0,
    cross: '',
    crossAlpha: 0,
    arc: '',
    arcAlpha: 0,
    glyphScale: 0,
    glyphAlpha: 0,
    arrowLines: [],
    crossLines: [],
    arcStart: 0,
    arcSweep: 0,
    arcRadius: 0,
  }

  // The download arrow.
  if (current === DOWNLOAD || next === DOWNLOAD) {
    const yStart = c - 9 * scale
    const yEnd = c + 9 * scale
    const yEnd2 = c + 12 * scale
    let yStart2: number
    let transition: number
    if (current === CANCEL && next === DOWNLOAD) {
      out.arrowAlpha = Math.min(1, t / 0.5)
      transition = t
      yStart2 = c + 12 * scale
    } else {
      if (next !== CANCEL && next !== DOWNLOAD) {
        out.arrowAlpha = Math.min(1, saved / 0.5) * (1 - t)
        transition = saved
      } else {
        out.arrowAlpha = 1
        transition = t
      }
      yStart2 = c + 1 * scale
    }

    let y1: number
    let y2: number
    let x1: number
    let x2: number
    let y3: number
    if (animating) {
      let p = transition
      if (next === DOWNLOAD || p <= STAGE1) {
        let cur: number
        let back: number
        if (next === DOWNLOAD) {
          back = transition
          cur = 1 - back
        } else {
          cur = transition / STAGE1
          back = 1 - cur
        }
        y1 = yStart + (yStart2 - yStart) * cur
        y2 = yEnd + (yEnd2 - yEnd) * cur
        x1 = c - 8 * back * scale
        x2 = c + 8 * back * scale
        y3 = y2 - 8 * back * scale
      } else {
        // The stem curls into the start of the ring, then the ✕ turns in.
        let d = 13 * scale * scale + (isMini ? 2 : 0)
        p -= STAGE1
        const p3 = p / (STAGE2 + STAGE3)
        let p1: number
        let p2: number
        if (p > STAGE2) {
          p1 = 1
          p2 = (p - STAGE2) / STAGE3
        } else {
          p1 = p / STAGE2
          p2 = 0
        }
        const start = 100 * p2
        out.arrow += arcPath(c - d / 2, yEnd2, d / 2, d / 2, start, 104 * p3 - start)

        y1 = yStart2 + (yEnd2 - yStart2) * p1
        y2 = y3 = yEnd2
        x1 = x2 = c

        if (p2 > 0) {
          d = 7 * p2 * scale
          out.cross = cross(c, d, 1, -45 * (1 - p2))
          out.crossLines = crossLines(c, d, 1, -45 * (1 - p2))
          out.crossAlpha = p2
        }
      }
    } else {
      y1 = yStart
      y2 = yEnd
      x1 = c - 8 * scale
      x2 = c + 8 * scale
      y3 = y2 - 8 * scale
    }
    if (y1 !== y2) {
      out.arrow += line(c, y1, c, y2)
      out.arrowLines.push(c, y1, c, y2)
    }
    if (x1 !== c) {
      out.arrow += line(x1, y3, c, y2) + line(x2, y3, c, y2)
      out.arrowLines.push(x1, y3, c, y2, x2, y3, c, y2)
    }
  }

  // The cancel ✕ and the progress ring.
  if (current === CANCEL || (current === NONE && next === CANCEL)) {
    let d: number
    let rotation = 0
    let iconScale = 1
    let alpha: number
    if (next === DOWNLOAD) {
      if (t <= STAGE3 + STAGE2) {
        const back = 1 - t / (STAGE3 + STAGE2)
        d = 7 * back * scale
        alpha = back
      } else {
        d = 0
        alpha = 0
      }
    } else if (isPlayPause(next)) {
      const back = 1 - t
      iconScale = 1 - t
      d = 7 * back * scale
      alpha = Math.min(1, back * 2)
    } else if (next === NONE) {
      const back = 1 - t
      d = 7 * scale
      alpha = back
      iconScale = back
    } else if (next === CANCEL) {
      if (current === NONE) 
        iconScale = t
      else 
        rotation = 45 * (1 - t)
      
      d = 7 * scale
      alpha = t
    } else {
      d = 7 * scale
      alpha = 1
    }
    if (current === next) {
      rotation = 0
      iconScale = 1
      alpha = 1
      d = 7 * scale
    }

    out.cross = cross(c, d, iconScale, rotation)
    out.crossLines = crossLines(c, d, iconScale, rotation)
    out.crossAlpha = alpha
    if (alpha > 0) {
      // At least 4 degrees, so a download that has not started still shows a dot.
      const sweep = Math.max(4, 360 * progress)
      const inset = isMini ? 2 : 4
      const r = c - inset
      out.arc = arcPath(c, c, r, r, rad, sweep)
      out.arcAlpha = alpha
      out.arcStart = rad
      out.arcSweep = sweep
      out.arcRadius = r
    }
  }

  // Play / pause, drawn by `PlayPauseIcon`; here only how much of it shows.
  if (isPlayPause(current) || isPlayPause(next)) 
    if (isPlayPause(current) && isPlayPause(next)) {
      out.glyphScale = 1
      out.glyphAlpha = 1
    } else if (isPlayPause(next)) {
      out.glyphAlpha = animating ? t : 1
      // From the cancel ✕ it grows from nothing; from the arrow it is full size at half way.
      out.glyphScale = !animating
        ? 1
        : current === NONE || current === CANCEL
          ? t
          : Math.min(1, t / 0.5)
    } else {
      out.glyphAlpha = animating ? 1 - t : 0
      out.glyphScale = animating ? Math.max(0, 1 - t / 0.5) : 0
    }
  

  return out
}

/** One straight stroke of the frame with round caps, for drawing without react-native-svg. */
function FallbackStroke ({ frame, isCross, index, color, width }: {
  frame: SharedValue<RadialFrame>
  isCross: boolean
  index: number
  color: string
  width: number
}) {
  const style = useAnimatedStyle(() => {
    const lines = isCross ? frame.value.crossLines : frame.value.arrowLines
    const i = index * 4
    if (lines.length < i + 4)
      return { opacity: 0, width: 0 }

    const x1 = lines[i]
    const y1 = lines[i + 1]
    const x2 = lines[i + 2]
    const y2 = lines[i + 3]
    const length = Math.hypot(x2 - x1, y2 - y1) + width
    return {
      opacity: isCross ? frame.value.crossAlpha : frame.value.arrowAlpha,
      width: length,
      left: (x1 + x2) / 2 - length / 2,
      top: (y1 + y2) / 2 - width / 2,
      transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
    }
  })
  return <Animated.View style={[styles.stroke, { height: width, borderRadius: width / 2, backgroundColor: color }, style]} />
}

/**
 * The progress arc without react-native-svg: two half rings, each clipped to its half of the
 * circle and turned in from the other side, and the whole turned to the arc's start.
 */
function FallbackRing ({ frame, color, width, size, isMini }: {
  frame: SharedValue<RadialFrame>
  color: string
  width: number
  size: number
  isMini: boolean
}) {
  const radius = size / 2 - (isMini ? 2 : 4)
  const diameter = radius * 2 + width
  const offset = size / 2 - diameter / 2
  // Drawn from 12 o'clock; Android's arcs start at 3.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: frame.value.arcAlpha,
    transform: [{ rotate: `${frame.value.arcStart + 90}deg` }],
  }))
  const firstHalfStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${45 + Math.min(frame.value.arcSweep, 180) - 180}deg` }],
  }))
  // Hidden until it is needed: parked on the far side, its ends sit on the clip's edge and
  // antialias into a hairline there.
  const secondHalfStyle = useAnimatedStyle(() => ({
    opacity: frame.value.arcSweep > 180 ? 1 : 0,
    transform: [{ rotate: `${45 + Math.max(frame.value.arcSweep, 180) - 180}deg` }],
  }))
  const halfRing = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: width,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  }
  return (
    <Animated.View style={[styles.ring, { left: offset, top: offset, width: diameter, height: diameter }, ringStyle]}>
      <View style={[styles.half, { left: diameter / 2, width: diameter / 2, height: diameter }]}>
        <Animated.View style={[styles.halfRing, halfRing, { left: -diameter / 2 }, firstHalfStyle]} />
      </View>
      <View style={[styles.half, { left: 0, width: diameter / 2, height: diameter }]}>
        <Animated.View style={[styles.halfRing, halfRing, { left: 0 }, secondHalfStyle]} />
      </View>
    </Animated.View>
  )
}

export interface RadialProgressProps {
  /** The glyph. A change animates from the previous one. */
  icon: MediaActionIcon
  /**
   * Download or upload progress, 0..1, drawn as the ring while `icon` is `cancel`.
   * A shared value is followed on the UI thread without re-rendering.
   */
  progress?: number | SharedValue<number>
  /** Circle diameter: 44 for a voice note or file, 48 over a photo or video. */
  size?: number
  /** The glyph and ring. */
  color: string
  /** The filled circle behind them; omit for none. */
  backgroundColor?: string
  /** The mini variant: 2-wide strokes and a ring 2 in from the edge. */
  isMini?: boolean
  /** Glyph size of the play/pause icon. Default 18 for a 44 circle, scaled with `size`. */
  glyphSize?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The media button: a filled circle with a
 * play, pause, download or cancel glyph, and while cancelable a ring that grows with
 * `progress` and turns once every 2.5s. Every animation runs on the UI thread.
 */
export function RadialProgress ({
  icon,
  progress = 0,
  size = 44,
  color,
  backgroundColor,
  isMini = false,
  glyphSize,
  style,
}: RadialProgressProps) {
  const code = ICON_CODES[icon]
  const current = useSharedValue(code)
  const next = useSharedValue(code)
  const t = useSharedValue(1)
  const saved = useSharedValue(1)
  const arc = useSharedValue(0)
  const target = useSharedValue(typeof progress === 'number' ? progress : 0)
  const rad = useSharedValue(RAD_OFFSET_START)
  const previousIcon = useRef(icon)
  const fallbackProgress = useSharedValue(0)
  const progressSource = typeof progress === 'number' ? fallbackProgress : progress
  const numericProgress = typeof progress === 'number' ? progress : null

  const initialIcon = useRef(icon).current

  // The ring turns from the moment the cancel icon is set; mounted on it, too.
  useEffect(() => {
    if (initialIcon === 'cancel')
      spinRing(rad)

    return () => cancelAnimation(rad)
  }, [initialIcon, rad])

  useEffect(() => {
    const from = previousIcon.current
    if (from === icon)
      return

    previousIcon.current = icon
    const duration = transitionDuration(from, icon)
    // A new icon mid-transition starts from the icon being animated to.
    if (t.value < 1)
      current.value = next.value
    saved.value = t.value
    next.value = ICON_CODES[icon]
    if (icon === 'cancel') {
      arc.value = 0
      spinRing(rad)
    }
    t.value = 0
    t.value = withTiming(1, { duration, easing: Easing.linear }, finished => {
      if (!finished)
        return

      current.value = next.value
      if (next.value !== CANCEL)
        cancelAnimation(rad)
    })
  }, [icon, arc, current, next, rad, saved, t])

  // A number prop feeds the target from the JS side; a shared value from the UI thread.
  useEffect(() => {
    if (numericProgress != null)
      target.value = numericProgress
  }, [numericProgress, target])

  useAnimatedReaction(
    () => progressSource.value,
    value => {
      if (numericProgress == null)
        target.value = value
    }
  )

  useAnimatedReaction(
    () => target.value,
    value => {
      // A drop jumps; a rise eases over 200ms from where the ring is.
      if (value <= arc.value) {
        cancelAnimation(arc)
        arc.value = value
        return
      }
      arc.value = withTiming(value, { duration: RADIAL_PROGRESS_MS, easing: DECELERATE })
    }
  )

  // Each worklet reads the shared values itself: Reanimated subscribes a mapper only to the
  // values in its own closure, so reading them in a shared helper would freeze the paths.
  const arrowProps = useAnimatedProps(() => {
    const r = radialFrame(current.value, next.value, t.value, saved.value, arc.value, rad.value, size, isMini)
    return { d: r.arrow || 'M0 0', opacity: r.arrowAlpha }
  })
  const crossProps = useAnimatedProps(() => {
    const r = radialFrame(current.value, next.value, t.value, saved.value, arc.value, rad.value, size, isMini)
    return { d: r.cross || 'M0 0', opacity: r.crossAlpha }
  })
  const arcProps = useAnimatedProps(() => {
    const r = radialFrame(current.value, next.value, t.value, saved.value, arc.value, rad.value, size, isMini)
    return { d: r.arc || 'M0 0', opacity: r.arcAlpha }
  })
  // Only drawn without react-native-svg.
  const frame = useDerivedValue(() =>
    radialFrame(current.value, next.value, t.value, saved.value, arc.value, rad.value, size, isMini))

  const glyphStyle = useAnimatedStyle(() => {
    const result = radialFrame(current.value, next.value, t.value, saved.value, 0, 0, size, isMini)
    return { opacity: result.glyphAlpha, transform: [{ scale: result.glyphScale }] }
  })

  // The circle fades in from no icon and out to it.
  const circleStyle = useAnimatedStyle(() => {
    const isAnimating = current.value !== next.value && t.value < 1
    if (!isAnimating)
      return { opacity: next.value === NONE ? 0 : 1 }
    if (current.value === NONE)
      return { opacity: t.value }
    return { opacity: next.value === NONE ? 1 - t.value : 1 }
  })

  // The stroke drops to 2 when the button is under 0.7 of its intrinsic size.
  const strokeWidth = isMini || size / INTRINSIC < 0.7 ? 2 : 3
  const circle = { width: size, height: size, borderRadius: size / 2 }
  const glyph = glyphSize ?? Math.round((18 * size) / 44)

  return (
    <View
      pointerEvents='none'
      style={[styles.root, circle, style]}
    >
      {backgroundColor != null && (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor, borderRadius: size / 2 }, circleStyle]} />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, glyphStyle]}>
        <PlayPauseIcon isPlaying={icon === 'pause'} color={color} size={glyph} />
      </Animated.View>
      {Svg && AnimatedPath && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            animatedProps={arrowProps}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            fill='none'
          />
          <AnimatedPath
            animatedProps={crossProps}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            fill='none'
          />
          <AnimatedPath
            animatedProps={arcProps}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            fill='none'
          />
        </Svg>
      )}
      {!Svg && (
        <>
          <FallbackRing frame={frame} color={color} width={strokeWidth} size={size} isMini={isMini} />
          {[0, 1, 2].map(index => (
            <FallbackStroke key={`arrow${index}`} frame={frame} isCross={false} index={index} color={color} width={strokeWidth} />
          ))}
          {[0, 1].map(index => (
            <FallbackStroke key={`cross${index}`} frame={frame} isCross index={index} color={color} width={strokeWidth} />
          ))}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stroke: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
  },
  half: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  halfRing: {
    position: 'absolute',
    top: 0,
  },
})
