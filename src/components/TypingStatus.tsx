import React, { useEffect } from 'react'
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { ChatLabels, formatLabel } from '../i18n'
import { User } from '../Models'
import { getSvg } from '../optional'

const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const AnimatedPath: any = svg?.Path ? Animated.createAnimatedComponent(svg.Path) : null

/** What the other side is doing: typing, recording a note, sending media or picking a sticker. */
export type TypingAction =
  | 'typing'
  | 'recordingVoice'
  | 'recordingVideo'
  | 'sendingPhoto'
  | 'sendingVideo'
  | 'sendingFile'
  | 'choosingSticker'

const firstName = (user?: User) => (user?.name ?? '').split(' ')[0]

/**
 * The status line for who is typing: "typing" in a private chat; in a group "Anna is typing",
 * "Anna and Max are typing" or "Anna and 3 people are typing". Other actions read "recording a
 * voice message", "Anna is sending a photo"…
 */
export function getTypingText (users: User[], labels: ChatLabels, action: TypingAction = 'typing', isGroup = false): string {
  if (!users.length)
    return ''
  const name = firstName(users[0])
  if (action !== 'typing') {
    const key = ACTION_LABELS[action]
    return isGroup ? formatLabel(labels[`${key}Name`], { name }) : labels[key]
  }
  if (!isGroup)
    return labels.typingStatus
  if (users.length === 1)
    return formatLabel(labels.typingStatusName, { name })
  if (users.length === 2)
    return formatLabel(labels.typingStatusTwo, { name, other: firstName(users[1]) })
  return formatLabel(labels.typingStatusMany, { name, count: users.length - 1 })
}

const ACTION_LABELS = {
  recordingVoice: 'typingRecordingVoice',
  recordingVideo: 'typingRecordingVideo',
  sendingPhoto: 'typingSendingPhoto',
  sendingVideo: 'typingSendingVideo',
  sendingFile: 'typingSendingFile',
  choosingSticker: 'typingChoosingSticker',
} as const

export interface TypingStatusProps {
  /** Who is typing; nothing is drawn when empty. */
  users: User[]
  action?: TypingAction
  /** Names the people typing ("Anna is typing"), as a group does. */
  isGroup?: boolean
  /** The text and the animation. */
  color: string
  textStyle?: StyleProp<TextStyle>
  style?: StyleProp<ViewStyle>
}

/**
 * Who is typing, for a chat's header or a row in the chat list: an animation for the action
 * (three dots that swell in turn, waves for a recording, arrows for an upload) before the text.
 */
export function TypingStatus ({ users, action = 'typing', isGroup = false, color, textStyle, style }: TypingStatusProps) {
  const labels = useLabels()
  if (!users.length)
    return null

  return (
    <View style={[styles.row, style]}>
      {action === 'recordingVoice' || action === 'recordingVideo'
        ? <RecordWaves color={color} />
        : action === 'sendingPhoto' || action === 'sendingVideo' || action === 'sendingFile'
          ? <SendingArrows color={color} />
          : <TypingDots color={color} />}
      <Text style={[textStyle, { color }]} numberOfLines={1}>{getTypingText(users, labels, action, isGroup)}</Text>
    </View>
  )
}

/** A looping 0..1 clock. */
const useLoop = (period: number) => {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(progress)
  }, [period, progress])
  return progress
}

// Three dots 6 apart in an 18-wide box. Each swells from radius 1.33 to 2.33 over 320ms and back
// over the next 320ms on a decelerate curve, rests, and starts again every 800ms, each 150ms
// after the one before.
const DOT_PERIOD = 800
const DOT_GROW = 320
const DOT_MIN = 1.33
const decelerate = (t: number) => {
  'worklet'
  return 1 - (1 - t) * (1 - t)
}

function Dot ({ clock, delay, color }: { clock: SharedValue<number>, delay: number, color: string }) {
  const style = useAnimatedStyle(() => {
    const t = ((clock.value * DOT_PERIOD - delay) % DOT_PERIOD + DOT_PERIOD) % DOT_PERIOD
    const grow = t <= DOT_GROW
      ? decelerate(t / DOT_GROW)
      : t <= DOT_GROW * 2
        ? 1 - decelerate((t - DOT_GROW) / DOT_GROW)
        : 0
    return { transform: [{ scale: (DOT_MIN + grow) / (DOT_MIN + 1) }] }
  })
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
}

function TypingDots ({ color }: { color: string }) {
  const clock = useLoop(DOT_PERIOD)
  return (
    <View style={styles.dots}>
      <Dot clock={clock} delay={0} color={color} />
      <Dot clock={clock} delay={150} color={color} />
      <Dot clock={clock} delay={300} color={color} />
    </View>
  )
}

// A recording: four 30° arcs pointing ahead, 4 apart, moving out every 800ms; the innermost
// fades in and the outermost fades out. Without react-native-svg the dots stand in.
const WAVE_PERIOD = 800

const wavePath = (radius: number) => {
  'worklet'
  const a = (15 * Math.PI) / 180
  const x = 2 + radius * Math.cos(a)
  const y = radius * Math.sin(a)
  return `M${x} ${9 - y} A${radius} ${radius} 0 0 1 ${x} ${9 + y}`
}

function Wave ({ clock, index, color }: { clock: SharedValue<number>, index: number, color: string }) {
  const props = useAnimatedProps(() => {
    const p = clock.value
    const radius = Math.max(0.01, 4 * index + 4 * p)
    const opacity = index === 0 ? p : index === 3 ? 1 - p : 1
    return { d: wavePath(radius), strokeOpacity: opacity }
  })
  return <AnimatedPath animatedProps={props} stroke={color} strokeWidth={2} strokeLinecap='round' fill='none' />
}

function RecordWaves ({ color }: { color: string }) {
  const clock = useLoop(WAVE_PERIOD)
  if (!Svg || !AnimatedPath)
    return <TypingDots color={color} />
  return (
    <Svg width={20} height={18} style={styles.icon}>
      {[0, 1, 2, 3].map(index => <Wave key={index} clock={clock} index={index} color={color} />)}
    </Svg>
  )
}

// An upload: three ">" chevrons 5 apart sliding ahead every 500ms; the first fades in and the
// last fades out.
const ARROW_PERIOD = 500

function Arrow ({ clock, index, color }: { clock: SharedValue<number>, index: number, color: string }) {
  const style = useAnimatedStyle(() => {
    const p = clock.value
    return {
      opacity: index === 0 ? p : index === 2 ? 1 - p : 1,
      transform: [{ translateX: 5 * index + 5 * p }],
    }
  })
  return (
    <Animated.View style={[styles.arrow, style]}>
      <View style={[styles.arrowStroke, styles.arrowTop, { backgroundColor: color }]} />
      <View style={[styles.arrowStroke, styles.arrowBottom, { backgroundColor: color }]} />
    </Animated.View>
  )
}

function SendingArrows ({ color }: { color: string }) {
  const clock = useLoop(ARROW_PERIOD)
  return (
    <View style={styles.arrows}>
      {[0, 1, 2].map(index => <Arrow key={index} clock={clock} index={index} color={color} />)}
    </View>
  )
}

const DOT_SIZE = (DOT_MIN + 1) * 2

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  icon: {
    marginEnd: 4,
  },
  dots: {
    width: 18,
    height: 18,
    marginEnd: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3 - DOT_SIZE / 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  arrows: {
    width: 20,
    height: 18,
    marginEnd: 4,
  },
  arrow: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 5,
    height: 9,
  },
  arrowStroke: {
    position: 'absolute',
    left: -0.5,
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  arrowTop: {
    top: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  arrowBottom: {
    top: 5.5,
    transform: [{ rotate: '-45deg' }],
  },
})
