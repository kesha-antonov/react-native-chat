import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useIcons } from '../hooks/useIcons'
import { getSvg } from '../optional'
import { Icon } from './Icon'
import { PendingClock, Ticks } from './Ticks'

const svg = getSvg()
const Svg: any = svg ? svg.default ?? svg.Svg : null
const Path: any = svg?.Path

/**
 * The box the status takes beside the time: a 12pt check with the half-check 4pt to
 * its right.
 */
export const STATUS_WIDTH = 16
const STATUS_HEIGHT = 12

// The checks are thin, round-capped strokes; the read state adds a second check whose
// short arm hides behind the first one's long arm.
const CHECK = 'M1.6 6.7 L4.5 9.5 L10.4 2.9'
const HALF_CHECK = 'M7.9 8.2 L9.2 9.5 L15.1 2.9'

export type MessageStatusKind = 'pending' | 'sent' | 'read' | 'failed'

export interface MessageStatusProps {
  status: MessageStatusKind
  color: string
  /** Badge color for `failed`. */
  errorColor: string
}

/*
 * A status change cross-fades over 150ms, the old glyph shrinking to half size as it fades and
 * the new one growing from half. Sent -> read is the "move check" instead, 220ms: the check
 * slides 4 left into place and the half-check grows in beside it. Both run on the default
 * cubic-bezier (0.25, 0.1, 0.25, 1).
 */
export const STATUS_FADE_MS = 150
export const STATUS_MOVE_MS = 220
/** A lone "sent" check sits where the read state's half-check ends. */
const CHECK_SHIFT = 4
const EASE_DEFAULT = Easing.bezier(0.25, 0.1, 0.25, 1)

const CheckLayer = ({ d, color }: { d: string, color: string }) => (
  <Svg width={STATUS_WIDTH} height={STATUS_HEIGHT} viewBox='0 0 16 12' fill='none'>
    <Path d={d} stroke={color} strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
  </Svg>
)

/** The two checks, `moving` 0 -> 1 from sent to read (1 at rest when read, 0 when sent). */
const AnimatedChecks = ({ isRead, color, move }: { isRead: boolean, color: string, move?: SharedValue<number> }) => {
  const checkStyle = useAnimatedStyle(() => {
    const p = move ? move.value : isRead ? 1 : 0
    return { transform: [{ translateX: CHECK_SHIFT * (1 - p) }] }
  })
  const halfStyle = useAnimatedStyle(() => {
    const p = move ? move.value : isRead ? 1 : 0
    return { opacity: p > 0 ? 1 : 0, transform: [{ scale: 0.5 + 0.5 * p }] }
  })

  return (
    <View style={styles.checks}>
      <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>
        <CheckLayer d={CHECK} color={color} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, halfStyle]}>
        <CheckLayer d={HALF_CHECK} color={color} />
      </Animated.View>
    </View>
  )
}

const FadeLayer = ({ progress, isOut, children }: { progress: SharedValue<number>, isOut: boolean, children: React.ReactNode }) => {
  const style = useAnimatedStyle(() => {
    const p = isOut ? 1 - progress.value : progress.value
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] }
  })
  return <Animated.View style={[styles.layer, style]}>{children}</Animated.View>
}

/** The outgoing and incoming glyphs of one change, animated from their own mount. */
const CrossFade = ({ from, to, onDone }: { from: React.ReactNode, to: React.ReactNode, onDone: () => void }) => {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, { duration: STATUS_FADE_MS, easing: EASE_DEFAULT }, finished => {
      if (finished)
        runOnJS(onDone)()
    })
  }, [progress, onDone])
  return (
    <>
      <FadeLayer progress={progress} isOut>{from}</FadeLayer>
      <FadeLayer progress={progress} isOut={false}>{to}</FadeLayer>
    </>
  )
}

/**
 * A message's delivery state, drawn beside the time: a spinning clock while
 * sending, one check once sent, two once read, a red badge if sending failed. A change
 * animates. The `icons` registry still wins for `clock`, `check` and
 * `checkAll`.
 */
export const MessageStatus = ({ status, color, errorColor }: MessageStatusProps) => {
  const icons = useIcons()
  const [previous, setPrevious] = useState<MessageStatusKind | null>(null)
  const [current, setCurrent] = useState(status)
  const progress = useSharedValue(1)
  const isMounted = useRef(false)
  const clearPrevious = useCallback(() => setPrevious(null), [])

  // The outgoing glyph stays drawn until the transition has finished.
  if (status !== current) {
    setPrevious(current)
    setCurrent(status)
  }

  const isSvgChecks = !!(Svg && Path) && !icons.check && !icons.checkAll
  const isMove = isSvgChecks && previous === 'sent' && current === 'read'

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }

    if (!isMove)
      return
    progress.value = 0
    progress.value = withTiming(1, { duration: STATUS_MOVE_MS, easing: EASE_DEFAULT }, finished => {
      if (finished)
        runOnJS(setPrevious)(null)
    })
    // Runs once per status change; `isMove` is derived from the same change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, progress])

  const glyphFor = (kind: MessageStatusKind, move?: SharedValue<number>): React.ReactNode => {
    if (kind === 'failed')
      // A 14pt red badge with a white exclamation mark.
      return (
        <View testID='message-status-error-badge' style={[styles.error, { backgroundColor: errorColor }]}>
          <Text style={styles.errorText} allowFontScaling={false}>!</Text>
        </View>
      )
    if (kind === 'pending')
      return icons.clock
        ? <Icon name='clock' color={color} size={11} fallback={null} />
        : <PendingClock color={color} />
    if (icons.check || icons.checkAll)
      return <Icon name={kind === 'read' ? 'checkAll' : 'check'} color={color} size={14} fallback={null} />
    if (Svg && Path)
      return <AnimatedChecks isRead={kind === 'read'} color={color} move={move} />
    return <Ticks double={kind === 'read'} color={color} />
  }

  let content: React.ReactNode
  if (isMove)
    content = glyphFor('read', progress)
  else if (previous != null && previous !== current)
    content = (
      <CrossFade key={`${previous}>${current}`} from={glyphFor(previous)} to={glyphFor(current)} onDone={clearPrevious} />
    )
  else
    content = glyphFor(current)

  return (
    <View testID={`message-status-${status}`} style={styles.box}>
      {content}
    </View>
  )
}

const styles = StyleSheet.create({
  // Right-aligned, so a single check sits where the read state's half-check would.
  box: {
    width: STATUS_WIDTH,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  checks: {
    width: STATUS_WIDTH,
    height: STATUS_HEIGHT,
  },
  layer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  error: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
})
