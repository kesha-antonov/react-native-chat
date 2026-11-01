import React, { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated'

import { useTheme } from '../hooks/useTheme'
import { getSvg } from '../optional'
import { Icon } from './Icon'
import { CameraIcon, MicIcon } from './MediaControls'
import { PlayPauseIcon } from './PlayPauseIcon'
import { VOICE_FLIGHT_BLOB_SHARE, easeDefault, easeOutQuint } from './sendFlight'
import { SendIcon } from './SendIcon'

// Optional SVG for the morphing blobs behind the circle. Without it the circle
// still grows with the voice, just without the blobs - the same optional-require
// pattern `VideoNoteOverlay` uses.
const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedPath: any = svg?.Path ? Animated.createAnimatedComponent(svg.Path) : null

/** `RecordCircle.circleRadius` / `circleRadiusAmplitude`: 41dp, plus up to 30 with loudness. */
export const CIRCLE_RADIUS = 41
const CIRCLE_RADIUS_AMPLITUDE = 30
/** Exit and pause-to-preview both swell the circle by 16dp before it collapses. */
const EXIT_GROW = 16
/** The pause-to-preview morph shrinks the circle to an 8dp dot (`toRadius`). */
const SEEKBAR_RADIUS = 8
/** Icon size inside the circle (`sendRect`, 24dp). */
const ICON_SIZE = 24
/** The voice bubble's play glyph, as `WaveformPlayer` draws it. */
const FLIGHT_ICON_SIZE = 18
/** Room for the largest blob: 57dp scaled by up to 2.3. */
const BLOB_BOX = 280

/** How a take's circle leaves. */
export const EXIT_NONE = 0
/** Sent, or released past the cancel point: swell by 16, then collapse (`exitTransition`). */
export const EXIT_RELEASE = 1
/** Slid all the way: spring back into the button (`canceledByGesture`). */
export const EXIT_GESTURE = 2
/** Paused into the preview (`transformToSeekbar`). */
export const EXIT_PREVIEW = 3

/** Telegram's `CubicBezierInterpolator.EASE_BOTH` and `EASE_OUT`. */
const easeBoth = Easing.bezierFn(0.42, 0, 0.58, 1)
const easeOut = Easing.bezierFn(0, 0, 0.58, 1)

const clamp01 = (value: number) => {
  'worklet'
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/**
 * The circle's entry curve: overshoots to full size halfway through the
 * 300ms scale, dips to 0.9, then settles (`RecordCircle.onDraw`, `sc`).
 */
export const entryCurve = (scale: number) => {
  'worklet'
  if (scale <= 0.5)
    return scale / 0.5
  if (scale <= 0.75)
    return 1 - (scale - 0.5) / 0.25 * 0.1
  return 0.9 + (scale - 0.75) / 0.25 * 0.1
}

interface CircleFrame {
  radius: number
  alpha: number
  /** Common factor for both blobs; 0 hides them. */
  blobScale: number
}

/** Radius, alpha and blob scale for one frame, following `RecordCircle.onDraw`. */
const circleFrame = (scale: number, amplitude: number, slide: number, exit: number, exitKind: number): CircleFrame => {
  'worklet'
  const sc = entryCurve(scale)
  const isGesture = exitKind === EXIT_GESTURE
  const slideScale = isGesture ? 0.7 * easeOut(1 - slide) : 0.7 + 0.3 * slide
  let radius = (CIRCLE_RADIUS + CIRCLE_RADIUS_AMPLITUDE * amplitude) * sc * slideScale
  let alpha = 1
  let step1 = 0
  let step2 = 0
  let exit2 = 0

  if (exitKind === EXIT_PREVIEW) {
    step1 = easeBoth(clamp01(exit / 0.38))
    step2 = easeBoth(clamp01((exit - 0.38) / 0.25))
    const step3 = easeBoth(clamp01((exit - 0.63) / 0.37))
    radius += EXIT_GROW * step1
    radius = SEEKBAR_RADIUS + (radius - SEEKBAR_RADIUS) * (1 - step2)
    // Telegram stretches the dot into the preview's seekbar; we have no
    // seekbar under the circle, so the dot fades into the preview instead.
    alpha = 1 - step3
  } else if (exitKind === EXIT_RELEASE) {
    step1 = easeBoth(clamp01(exit / 0.6))
    exit2 = easeBoth(clamp01((exit - 0.6) / 0.4))
    radius += EXIT_GROW * step1
    radius *= 1 - exit2
    if (exit > 0.6)
      alpha = Math.max(0, 1 - (exit - 0.6) / 0.4)
  }

  if (isGesture) {
    if (slide < 1)
      radius = Math.max(radius, 19)
    if (slide > 0.7)
      alpha *= 1 - (slide - 0.7) / 0.3
  }

  const slide1 = slide > 0.7 ? 1 : slide / 0.7
  const hasBlobs = !isGesture && step2 < 1 && exit2 < 0.4 && slide1 > 0
  return { radius, alpha, blobScale: hasBlobs ? scale * (1 - step1) * slide1 : 0 }
}

/** One of `BlobDrawable`'s shapes: N points easing towards random targets. */
interface Blob {
  n: number
  minRadius: number
  maxRadius: number
  radius: number[]
  angle: number[]
  radiusNext: number[]
  angleNext: number[]
  progress: number[]
  speed: number[]
  /** Smoothed loudness (`BlobDrawable.amplitude`) and its per-ms step. */
  amplitude: number
  target: number
  step: number
}

/** `random.nextInt() % 100 / 100`: -1..1. */
const signedRandom = () => {
  'worklet'
  return Math.random() * 2 - 1
}

const generatePoint = (blob: Blob, i: number, isNext: boolean) => {
  'worklet'
  const angleDif = 360 / blob.n * 0.05
  const radius = blob.minRadius + Math.random() * (blob.maxRadius - blob.minRadius)
  const angle = 360 / blob.n * i + signedRandom() * angleDif
  if (isNext) {
    blob.radiusNext[i] = radius
    blob.angleNext[i] = angle
  } else {
    blob.radius[i] = radius
    blob.angle[i] = angle
  }
  blob.speed[i] = 0.017 + 0.003 * Math.random()
}

const createBlob = (n: number, minRadius: number, maxRadius: number): Blob => {
  'worklet'
  const blob: Blob = {
    n,
    minRadius,
    maxRadius,
    radius: [],
    angle: [],
    radiusNext: [],
    angleNext: [],
    progress: [],
    speed: [],
    amplitude: 0,
    target: 0,
    step: 0,
  }
  for (let i = 0; i < n; i++) {
    generatePoint(blob, i, false)
    generatePoint(blob, i, true)
    blob.progress[i] = 0
  }
  return blob
}

/**
 * `BlobDrawable.update`: every point eases towards its next target, faster
 * when louder. Telegram steps once per frame at 60fps; `frames` scales that to
 * the real frame time so 120Hz screens do not morph twice as fast.
 */
const updateBlob = (blob: Blob, speedScale: number, frames: number) => {
  'worklet'
  for (let i = 0; i < blob.n; i++) {
    blob.progress[i] += (blob.speed[i] * 0.8 + blob.amplitude * blob.speed[i] * 8.2 * speedScale) * frames
    if (blob.progress[i] >= 1) {
      blob.progress[i] = 0
      blob.radius[i] = blob.radiusNext[i]
      blob.angle[i] = blob.angleNext[i]
      generatePoint(blob, i, true)
    }
  }
}

/**
 * `BlobDrawable.setValue` / `updateAmplitude`: a new target sets a fixed
 * per-ms step that is walked until reached. `up` and `down` are the times
 * a full swing takes in each direction.
 */
const stepAmplitude = (blob: Blob, target: number, up: number, down: number, dt: number) => {
  'worklet'
  if (target !== blob.target) {
    blob.target = target
    blob.step = (target - blob.amplitude) / (target > blob.amplitude ? up : down)
  }
  if (blob.amplitude === blob.target)
    return

  blob.amplitude += blob.step * dt
  if ((blob.step > 0 && blob.amplitude > blob.target) || (blob.step < 0 && blob.amplitude < blob.target))
    blob.amplitude = blob.target
}

/**
 * A closed smooth path through the blob's points: one cubic per pair, with
 * the circle-approximating tangent length 4/3 * tan(pi / 2N).
 */
const blobPath = (blob: Blob, cx: number, cy: number, scale: number) => {
  'worklet'
  if (scale <= 0.001)
    return ''

  const tangent = (4 / 3) * Math.tan(Math.PI / (2 * blob.n))
  let d = ''
  for (let i = 0; i < blob.n; i++) {
    const j = i + 1 < blob.n ? i + 1 : 0
    const p1 = blob.progress[i]
    const p2 = blob.progress[j]
    const r1 = blob.radius[i] * (1 - p1) + blob.radiusNext[i] * p1
    const r2 = blob.radius[j] * (1 - p2) + blob.radiusNext[j] * p2
    const a1 = (blob.angle[i] * (1 - p1) + blob.angleNext[i] * p1) * Math.PI / 180
    const a2 = (blob.angle[j] * (1 - p2) + blob.angleNext[j] * p2) * Math.PI / 180
    const l = tangent * (r1 + r2) / 2
    const cos1 = Math.cos(a1)
    const sin1 = Math.sin(a1)
    const cos2 = Math.cos(a2)
    const sin2 = Math.sin(a2)
    // Points straight above the centre, rotated clockwise by the point's angle.
    const sx = cx + (r1 * sin1) * scale
    const sy = cy + (-r1 * cos1) * scale
    const c1x = cx + (l * cos1 + r1 * sin1) * scale
    const c1y = cy + (l * sin1 - r1 * cos1) * scale
    const c2x = cx + (-l * cos2 + r2 * sin2) * scale
    const c2y = cy + (-l * sin2 - r2 * cos2) * scale
    const ex = cx + (r2 * sin2) * scale
    const ey = cy + (-r2 * cos2) * scale
    if (i === 0)
      d += `M${sx.toFixed(1)} ${sy.toFixed(1)}`
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`
  }
  return d + 'Z'
}

interface CircleState {
  /** The circle's own smoothed loudness (`RecordCircle.amplitude`). */
  circle: Blob
  big: Blob
  tiny: Blob
  /** `wavesEnterAnimation`, 0..1. */
  waves: number
}

export interface RecordCircleValues {
  /** The 300ms entry scale, 0..1. */
  enter: SharedValue<number>
  /** 1 at rest, 0 at the cancel point. */
  slide: SharedValue<number>
  exit: SharedValue<number>
  exitKind: SharedValue<number>
  /** Loudness the circle and blobs head for, 0..1. */
  amplitude: SharedValue<number>
  /** 0 shows the mic (or camera), 1 the send arrow. */
  sendMorph: SharedValue<number>
  /** 1 once the blobs may show: always for voice, once the camera records for video. */
  showWaves: SharedValue<number>
  /** Blob state, rebuilt on the UI thread when reset to null. */
  state: SharedValue<CircleState | null>
  /** The send flight into the new message's play button, 0..1 linear. */
  flight: SharedValue<number>
  /** Where the flight goes, relative to the circle's centre when it took off. */
  flightDX: SharedValue<number>
  flightDY: SharedValue<number>
  /** The play button's radius, which the circle shrinks to. */
  flightRadius: SharedValue<number>
}

/** The shared values behind one `RecordCircle`, owned by the record button. */
export function useRecordCircleValues (): RecordCircleValues {
  const enter = useSharedValue(0)
  const slide = useSharedValue(1)
  const exit = useSharedValue(0)
  const exitKind = useSharedValue(EXIT_NONE)
  const amplitude = useSharedValue(0)
  const sendMorph = useSharedValue(0)
  const showWaves = useSharedValue(1)
  const state = useSharedValue<CircleState | null>(null)
  const flight = useSharedValue(0)
  const flightDX = useSharedValue(0)
  const flightDY = useSharedValue(0)
  const flightRadius = useSharedValue(CIRCLE_RADIUS)
  // Stable, so the memoized circle (and its frame callback) is not rebuilt
  // with every loudness update of the button.
  return useMemo(
    () => ({ enter, slide, exit, exitKind, amplitude, sendMorph, showWaves, state, flight, flightDX, flightDY, flightRadius }),
    [enter, slide, exit, exitKind, amplitude, sendMorph, showWaves, state, flight, flightDX, flightDY, flightRadius]
  )
}

/** Telegram's raw RMS is divided by 1800 (`WaveDrawable.MAX_AMPLITUDE`). */
const MAX_AMPLITUDE = 1800
const METERING_FLOOR_DB = -60

/**
 * Our level is metering mapped linearly from -60..0 dB; Telegram's amplitude
 * is the sample RMS over 1800, which is full scale from about -25 dBFS. Back
 * to dB, then to that scale, so the circle swells as much as Telegram's.
 */
export const levelToAmplitude = (level: number) => {
  if (!Number.isFinite(level) || level <= 0)
    return 0

  const db = METERING_FLOOR_DB + Math.min(1, level) * -METERING_FLOOR_DB
  return Math.min(1, Math.pow(10, db / 20) * 32768 / MAX_AMPLITUDE)
}

export interface RecordCircleProps {
  mode: 'voice' | 'video'
  values: RecordCircleValues
  /** How far the circle travels to the cancel point. */
  slideDistance: number
  /** -1 when cancelling slides left (LTR), 1 when it slides right (RTL). */
  cancelSign: number
  /** The send flight's target fill, blended in over the accent as it flies. */
  flightColor?: string
  /** The target's play glyph colour; the flight draws the glyph in as it lands. */
  flightIconColor?: string
}

const BLOB_CENTER = BLOB_BOX / 2

/** The icon keeps its size and only shrinks, and fades, with the circle. */
const iconFrame = (scale: number, amplitude: number, slide: number, exit: number, exitKind: number) => {
  'worklet'
  const { radius, alpha } = circleFrame(scale, amplitude, slide, exit, exitKind)
  return { scale: Math.min(1, radius / CIRCLE_RADIUS), alpha }
}

/**
 * Telegram's `RecordCircle`: the big accent circle over the composer while a
 * take records, swelling with the voice, with two morphing blobs behind it.
 * Purely visual - the touch stays on the record button underneath.
 */
export const RecordCircle = memo(function RecordCircle ({
  mode,
  values,
  slideDistance,
  cancelSign,
  flightColor,
  flightIconColor,
}: RecordCircleProps) {
  const { colors } = useTheme()
  const { enter, slide, exit, exitKind, amplitude, sendMorph, showWaves, state, flight, flightDX, flightDY, flightRadius } = values

  const circleAmplitude = useSharedValue(0)
  const bigPath = useSharedValue('')
  const tinyPath = useSharedValue('')
  const hasBlobs = !!AnimatedPath

  // Only runs while the circle is mounted, which is only while a take is live
  // or leaving.
  useFrameCallback(info => {
    'worklet'
    const dt = Math.min(64, info.timeSincePreviousFrame ?? 16)
    const frames = dt / (1000 / 60)
    let current = state.value
    if (!current) {
      // Built here, on the UI thread, so the arrays stay mutable in place.
      current = {
        circle: createBlob(0, 0, 0),
        big: createBlob(12, 50, 50 + 12 * 0.6),
        tiny: createBlob(11, 47, 47 + 15 * 0.6),
        waves: 0,
      }
      state.value = current
    }

    const target = amplitude.value
    // `animationSpeedCircle` 0.55; blobs: `ANIMATION_SPEED_WAVE_HUGE` 0.65 and
    // `_SMALL` 0.45, as (1 - speed).
    stepAmplitude(current.circle, target, 100 + 500 * 0.55, 100 + 500 * 0.55, dt)
    circleAmplitude.value = current.circle.amplitude

    if (!hasBlobs)
      return

    stepAmplitude(current.big, target, 100 + 300 * 0.35, 100 + 500 * 0.35, dt)
    stepAmplitude(current.tiny, target, 100 + 400 * 0.55, 100 + 500 * 0.55, dt)
    updateBlob(current.big, 1.01, frames)
    updateBlob(current.tiny, 1.02, frames)
    if (showWaves.value > 0 && current.waves < 1)
      current.waves = Math.min(1, current.waves + 0.04 * frames)

    const { blobScale } = circleFrame(enter.value, current.circle.amplitude, slide.value, exit.value, exitKind.value)
    // The send flight drops the blobs over its first 60% (`hideWavesProgress`).
    const flightWaves = 1 - clamp01(flight.value / VOICE_FLIGHT_BLOB_SHARE)
    const waves = easeOut(current.waves) * blobScale * flightWaves
    bigPath.value = blobPath(current.big, BLOB_CENTER, BLOB_CENTER, waves * (0.878 + 1.4 * current.big.amplitude))
    tinyPath.value = blobPath(current.tiny, BLOB_CENTER, BLOB_CENTER, waves * (0.926 + 1.4 * current.tiny.amplitude))
  })

  // Sideways only: the circle follows the cancel slide, never the finger up.
  // The send flight then carries it to the play button: x eased out-quint,
  // y on the default curve (`VoiceMessageEnterTransition.onDraw`).
  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cancelSign * slideDistance * (1 - slide.value) + flightDX.value * easeOutQuint(flight.value) },
      { translateY: flightDY.value * easeDefault(flight.value) },
    ],
  }))

  /** The circle's radius, lerped to the play button's while it flies. */
  const flightFrame = () => {
    'worklet'
    const { radius, alpha } = circleFrame(enter.value, circleAmplitude.value, slide.value, exit.value, exitKind.value)
    const p = easeDefault(flight.value)
    return { radius: radius + (flightRadius.value - radius) * p, alpha, p }
  }

  const circleStyle = useAnimatedStyle(() => {
    const { radius, alpha } = flightFrame()
    return {
      opacity: alpha,
      transform: [{ scale: radius / CIRCLE_RADIUS }],
    }
  })

  // Telegram blends the circle's colour into the play button's; a disc in the
  // target colour fading in over the accent one is the same blend.
  const flightDiscStyle = useAnimatedStyle(() => {
    const { radius, p } = flightFrame()
    return {
      opacity: flight.value > 0 ? p : 0,
      transform: [{ scale: radius / CIRCLE_RADIUS }],
    }
  })

  // The bubble's play glyph, drawn by the flight at the circle's scale relative
  // to the button and faded in with the colour (`setOverrideAlpha(progress)`).
  const flightIconStyle = useAnimatedStyle(() => {
    const { radius, p } = flightFrame()
    return {
      opacity: flight.value > 0 ? p : 0,
      transform: [{ scale: radius / Math.max(1, flightRadius.value) }],
    }
  })

  // Locking swaps the mic for the send arrow inside the same circle, 150ms.
  // Both fade out linearly as the flight goes (`drawIcon(…, 1 - moveProgress)`).
  const recordIconStyle = useAnimatedStyle(() => {
    const { scale, alpha } = iconFrame(enter.value, circleAmplitude.value, slide.value, exit.value, exitKind.value)
    const morph = sendMorph.value
    return { opacity: alpha * (1 - morph) * (1 - flight.value), transform: [{ scale: scale * (1 - morph) }] }
  })
  const sendIconStyle = useAnimatedStyle(() => {
    const { scale, alpha } = iconFrame(enter.value, circleAmplitude.value, slide.value, exit.value, exitKind.value)
    const morph = sendMorph.value
    return { opacity: alpha * morph * (1 - flight.value), transform: [{ scale: scale * morph }] }
  })

  const bigProps = useAnimatedProps(() => ({ d: bigPath.value }))
  const tinyProps = useAnimatedProps(() => ({ d: tinyPath.value }))

  return (
    <View style={styles.anchor} pointerEvents='none'>
      <Animated.View style={[styles.anchor, moveStyle]}>
        {hasBlobs && (
          <Svg width={BLOB_BOX} height={BLOB_BOX} style={styles.blobs}>
            {/* `CIRCLE_ALPHA_1` 0.30 for the 12-point blob, `_2` 0.15 for the 11-point one. */}
            <AnimatedPath animatedProps={bigProps} fill={colors.accent} fillOpacity={0.3} />
            <AnimatedPath animatedProps={tinyProps} fill={colors.accent} fillOpacity={0.15} />
          </Svg>
        )}
        <Animated.View style={[styles.circle, { backgroundColor: colors.accent }, circleStyle]} />
        {!!flightColor && (
          <Animated.View style={[styles.circle, { backgroundColor: flightColor }, flightDiscStyle]} />
        )}
        <Animated.View style={[styles.icon, recordIconStyle]}>
          {mode === 'video'
            ? <Icon name='camera' color='#fff' size={ICON_SIZE} fallback={<CameraIcon color='#fff' size={ICON_SIZE} />} />
            : <Icon name='mic' color='#fff' size={ICON_SIZE} fallback={<MicIcon color='#fff' size={ICON_SIZE} />} />}
        </Animated.View>
        <Animated.View style={[styles.icon, sendIconStyle]}>
          <Icon name='send' color='#fff' size={ICON_SIZE} fallback={<SendIcon color='#fff' size={ICON_SIZE} />} />
        </Animated.View>
        {!!flightIconColor && (
          <Animated.View style={[styles.flightIcon, flightIconStyle]}>
            <PlayPauseIcon isPlaying={false} color={flightIconColor} size={FLIGHT_ICON_SIZE} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  // A zero-size point on the record button's centre; everything hangs off it.
  anchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    zIndex: 3,
  },
  blobs: {
    position: 'absolute',
    left: -BLOB_CENTER,
    top: -BLOB_CENTER,
  },
  circle: {
    position: 'absolute',
    left: -CIRCLE_RADIUS,
    top: -CIRCLE_RADIUS,
    width: CIRCLE_RADIUS * 2,
    height: CIRCLE_RADIUS * 2,
    borderRadius: CIRCLE_RADIUS,
  },
  flightIcon: {
    position: 'absolute',
    left: -FLIGHT_ICON_SIZE / 2,
    top: -FLIGHT_ICON_SIZE / 2,
    width: FLIGHT_ICON_SIZE,
    height: FLIGHT_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
    left: -ICON_SIZE / 2,
    top: -ICON_SIZE / 2,
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
