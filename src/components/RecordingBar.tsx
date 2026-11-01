import React, { useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  Keyframe,
  ReduceMotion,
  SharedValue,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useIsRTL } from '../hooks/useIsRTL'
import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { ChevronIcon } from './MediaControls'
import { formatRecordingTime } from './recordingFeedback'

/** How long the cancelled bar stays up for the trash can (`recordDeleteImageView`). */
export const CANCEL_LINGER_MS = 900
/** The trash can's own run, inside the linger. */
const TRASH_MS = 850
/** `RecordDot`: fades to nothing over 600ms and back, linearly. */
const BLINK_MS = 600
/** A changed timer digit rolls down 15 while crossfading (116ms). */
const DIGIT_ROLL = 15
const DIGIT_MS = 116
/** At rest the hint drifts 6 each way, a sweep a second (`SlideTextView`). */
const DRIFT = 6
const DRIFT_SWEEP_MS = 1000
/** On lock the hint drops 12 as CANCEL comes down 12 into its place, 300ms. */
const LOCK_SHIFT = 12
const LOCK_MS = 300

/** The bar's parts come in from 20 further along, over 150ms decelerate (`runningAnimation`). */
const PART_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }], easing: Easing.out(Easing.quad) },
}).duration(150)
const PART_IN_RTL = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: -20 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }], easing: Easing.out(Easing.quad) },
}).duration(150)
/** The red dot scales in from nothing. */
const DOT_IN = new Keyframe({
  0: { transform: [{ scale: 0 }] },
  100: { transform: [{ scale: 1 }], easing: Easing.out(Easing.quad) },
}).duration(150)
const DIGIT_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -DIGIT_ROLL }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(DIGIT_MS)
const DIGIT_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: DIGIT_ROLL }] },
}).duration(DIGIT_MS)

const clamp01 = (value: number) => {
  'worklet'
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export interface RecordingBarProps {
  elapsed: number
  isLocked: boolean
  /** The dot blinks once the take really records; a round one waits for its camera. */
  isBlinking: boolean
  /** The take was cancelled: the dot drops into a trash can and the bar fades. */
  isCancelled: boolean
  /** The record button's cancel slide, 1 at rest down to 0. */
  slideProgress: SharedValue<number>
  slideDistance: number
  onCancel: () => void
}

/**
 * The composer while a take records (`recordPanel`): the red dot, the timer,
 * "slide to cancel" following the circle, and CANCEL once locked.
 */
export function RecordingBar ({
  elapsed,
  isLocked,
  isBlinking,
  isCancelled,
  slideProgress,
  slideDistance,
  onCancel,
}: RecordingBarProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const isRTL = useIsRTL()
  const cancelSign = isRTL ? 1 : -1

  // A locked take cancelled with CANCEL is no longer locked, but the bar has to stay in its
  // locked look while it leaves: unlocking first brought "slide to cancel" back over the trash
  // can and dropped CANCEL in a frame.
  const [wasLocked, setWasLocked] = useState(isLocked)
  if (isLocked && !wasLocked)
    setWasLocked(true)
  else if (!isLocked && !isCancelled && wasLocked)
    setWasLocked(false)
  const isShownLocked = isLocked || (isCancelled && wasLocked)

  const labelWidth = useSharedValue(0)
  const drift = useSharedValue(0)
  const lock = useSharedValue(isShownLocked ? 1 : 0)
  // After a cancel the timer and the hint fade and move 20 back, 200ms
  // after a 200ms wait.
  const leave = useSharedValue(0)

  useEffect(() => {
    lock.value = withTiming(isShownLocked ? 1 : 0, { duration: LOCK_MS })
  }, [isShownLocked, lock])

  useEffect(() => {
    leave.value = isCancelled ? withDelay(200, withTiming(1, { duration: 200 })) : 0
  }, [isCancelled, leave])

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DRIFT_SWEEP_MS / 2, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        withTiming(-1, { duration: DRIFT_SWEEP_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: DRIFT_SWEEP_MS / 2, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System })
      ),
      -1
    )
    // The repeat never settles, so it has to be stopped on unmount.
    return () => cancelAnimation(drift)
  }, [drift])

  const onLabelLayout = (event: LayoutChangeEvent) => {
    labelWidth.value = event.nativeEvent.layout.width
  }

  const timerStyle = useAnimatedStyle(() => ({
    opacity: 1 - leave.value,
    transform: [{ translateX: cancelSign * 20 * leave.value }],
  }))

  // `SlideTextView`: a quarter of its width back with the slide plus 0.3 of
  // the circle's own offset, fading as it goes; it drifts only near rest.
  const hintStyle = useAnimatedStyle(() => {
    const progress = slideProgress.value
    const circleOffset = cancelSign * slideDistance * (1 - progress)
    const rest = clamp01((progress - 0.8) / 0.2)
    return {
      opacity: progress * (1 - lock.value) * (1 - leave.value),
      transform: [
        {
          translateX: cancelSign * (labelWidth.value / 4) * (1 - progress) + 0.3 * circleOffset +
            DRIFT * drift.value * rest + cancelSign * 20 * leave.value,
        },
        { translateY: LOCK_SHIFT * lock.value },
      ],
    }
  })

  const cancelStyle = useAnimatedStyle(() => ({
    opacity: lock.value * (1 - leave.value),
    transform: [{ translateY: -LOCK_SHIFT * (1 - lock.value) }],
  }))

  const partIn = isRTL ? PART_IN_RTL : PART_IN

  return (
    <Animated.View style={[styles.bar, isRTL && styles.rowReverse]} exiting={FadeOut.duration(150)}>
      <Animated.View entering={DOT_IN}>
        <RecordDot isBlinking={isBlinking} isCancelled={isCancelled} />
      </Animated.View>
      <Animated.View entering={partIn} style={isRTL ? styles.timerRTL : styles.timerLTR}>
        <Animated.View style={timerStyle}>
          <RollingTimer text={formatRecordingTime(elapsed)} style={styles.timerText} />
        </Animated.View>
      </Animated.View>
      {/* Clipped so the hint never slides over the timer. */}
      <View style={styles.hintArea} onLayout={onLabelLayout}>
        <Animated.View entering={partIn} style={styles.hintFill} pointerEvents='none'>
          <Animated.View style={[styles.hint, isRTL && styles.rowReverse, hintStyle]}>
            <ChevronIcon color={styles.hintColor.color} size={12} direction={isRTL ? 'right' : 'left'} />
            <Text style={styles.hintText} numberOfLines={1}>{labels.slideToCancel}</Text>
          </Animated.View>
        </Animated.View>
        {/* Locked: the hint becomes a CANCEL text button. */}
        {isShownLocked && (
          <Animated.View style={[styles.hintFill, cancelStyle]} pointerEvents={isLocked ? 'auto' : 'none'}>
            <Pressable
              hitSlop={8}
              onPress={onCancel}
              accessibilityRole='button'
              accessibilityLabel='cancel recording'
            >
              <Text style={styles.cancelText}>{labels.cancel.toLocaleUpperCase()}</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  )
}

/**
 * The timer, one slot per character, so a changed digit rolls down out of
 * its slot while the new one rolls in from above. The tenths are the
 * exception: they only roll when a digit before them changes, and
 * swaps the last one in place - rolled ten times a second, it never sat still
 * long enough to read and the timer looked like it was shaking.
 */
function RollingTimer ({ text, style }: { text: string, style: StyleProp<TextStyle> }) {
  const styles = useThemedStyles(createStyles)
  const chars = text.split('')
  return (
    <View style={styles.timerRow} accessible accessibilityLabel={text}>
      {chars.map((char, index) => (
        <View key={index} style={styles.digitSlot}>
          {index === chars.length - 1
            ? <Text style={style}>{char}</Text>
            : <Animated.Text key={char} entering={DIGIT_IN} exiting={DIGIT_OUT} style={style}>{char}</Animated.Text>}
        </View>
      ))}
    </View>
  )
}

/**
 * The record dot: a 10pt red dot blinking 600ms out and 600ms in.
 * On cancel it hops into a trash can: the can grows with its lid open, the dot falls in, the lid
 * shuts and the can shrinks away.
 */
function RecordDot ({ isBlinking, isCancelled }: { isBlinking: boolean, isCancelled: boolean }) {
  const styles = useThemedStyles(createStyles)
  const blink = useSharedValue(1)
  const trash = useSharedValue(0)

  useEffect(() => {
    if (!isBlinking || isCancelled) {
      cancelAnimation(blink)
      blink.value = withTiming(1, { duration: 100 })
      return
    }

    blink.value = 1
    blink.value = withRepeat(
      withTiming(0, { duration: BLINK_MS, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1,
      true
    )
    return () => cancelAnimation(blink)
  }, [isBlinking, isCancelled, blink])

  useEffect(() => {
    trash.value = isCancelled ? withTiming(1, { duration: TRASH_MS, easing: Easing.linear }) : 0
  }, [isCancelled, trash])

  const dotStyle = useAnimatedStyle(() => {
    const t = trash.value
    return {
      opacity: blink.value,
      transform: [
        { translateY: interpolate(t, [0, 0.22, 0.5], [0, -16, 2], 'clamp') },
        { scale: interpolate(t, [0, 0.22, 0.45, 0.5], [1, 0.8, 0.6, 0], 'clamp') },
      ],
    }
  })

  const canStyle = useAnimatedStyle(() => {
    const t = trash.value
    const scale = interpolate(t, [0, 0.2, 0.72, 1], [0, 1, 1, 0], 'clamp')
    return { opacity: scale > 0.01 ? 1 : 0, transform: [{ scale }] }
  })

  // Hinged on its left end: shift the pivot there, turn, shift back.
  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -LID_WIDTH / 2 },
      { rotate: `${interpolate(trash.value, [0.04, 0.22, 0.5, 0.64], [0, -55, -55, 0], 'clamp')}deg` },
      { translateX: LID_WIDTH / 2 },
    ],
  }))

  return (
    <View style={styles.dotSlot}>
      <Animated.View style={[styles.can, canStyle]} pointerEvents='none'>
        <Animated.View style={[styles.lid, lidStyle]}>
          <View style={styles.lidHandle} />
        </Animated.View>
        <View style={styles.canBody}>
          <View style={styles.canRib} />
          <View style={styles.canRib} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.dot, dotStyle]} />
    </View>
  )
}

const DOT_SIZE = 10
const LID_WIDTH = 14

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Sized like the field so the row height does not jump.
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.composer.minHeight,
    paddingHorizontal: theme.composer.fieldPaddingH,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  dotSlot: {
    width: 16,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: theme.colors.error,
  },
  can: {
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
  },
  lid: {
    width: LID_WIDTH,
    height: 2,
    borderRadius: 1,
    marginBottom: 1,
    backgroundColor: theme.colors.placeholder,
    alignItems: 'center',
  },
  lidHandle: {
    position: 'absolute',
    top: -2,
    width: 5,
    height: 2,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    backgroundColor: theme.colors.placeholder,
  },
  canBody: {
    width: 11,
    height: 12,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderColor: theme.colors.placeholder,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 2,
  },
  canRib: {
    width: 1,
    backgroundColor: theme.colors.placeholder,
  },
  timerLTR: {
    marginLeft: 6,
  },
  timerRTL: {
    marginRight: 6,
  },
  // `m:ss,t`: wide enough for the tenths so the bar does not jitter.
  timerRow: {
    flexDirection: 'row',
    minWidth: 58,
  },
  digitSlot: {
    overflow: 'hidden',
  },
  timerText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.inputText,
    fontVariant: ['tabular-nums'],
  },
  hintArea: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  hintFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    fontSize: 15,
    color: theme.colors.placeholder,
  },
  // Carries the chevron color through the StyleSheet so it stays themed.
  hintColor: {
    color: theme.colors.placeholder,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: theme.colors.accent,
  },
})
