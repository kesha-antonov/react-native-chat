import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated'
import { useThemedStyles } from '../hooks/useTheme'
import stylesCommon from '../styles'
import { createTypingIndicatorStyles } from './styles'
import { TypingIndicatorProps } from './types'

export * from './types'

/**
 * Set by a message list that animates its own rows into place. The indicator then just
 * mounts and unmounts, and the rows around it slide, instead of it growing its own height:
 * two animations of the same gap would fight (the rows chasing a height that changes every
 * frame), and when a reply replaces the indicator in one render the collapse ran after the
 * new bubble had already pushed everything up.
 */
export const TypingIndicatorListAnimationContext = createContext(false)

// Telegram's `TypingDotsDrawable`: each dot grows for 320ms on a decelerate curve, shrinks
// for 320ms, and rests for the rest of an 800ms cycle; the three start 0 / 150 / 300ms
// apart. The radius swings 1.33dp <-> 2.33dp, so the dot is drawn at full size and scaled.
const DOT_GROW = { duration: 320, easing: Easing.out(Easing.quad) }
const DOT_SHRINK = { duration: 320, easing: Easing.out(Easing.quad) }
const DOT_REST_MS = 800 - 320 - 320
const DOT_OFFSETS_MS = [0, 150, 300] as const
const DOT_MIN_SCALE = 1.33 / 2.33

const useDotPulse = (offset: number) => {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(offset, withRepeat(
      withSequence(
        withTiming(1, DOT_GROW),
        withTiming(0, DOT_SHRINK),
        withTiming(0, { duration: DOT_REST_MS })
      ),
      -1
    ))

    // `withRepeat(..., -1)` never ends on its own: stop it with the indicator.
    return () => cancelAnimation(progress)
  }, [progress, offset])

  return progress
}

const Dot = ({ progress }: { progress: SharedValue<number> }) => {
  const styles = useThemedStyles(createTypingIndicatorStyles)
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: DOT_MIN_SCALE + (1 - DOT_MIN_SCALE) * progress.value }],
  }))

  return <Animated.View style={[styles.dot, style]} />
}

const DotsAnimation = () => {
  const styles = useThemedStyles(createTypingIndicatorStyles)
  const dot1 = useDotPulse(DOT_OFFSETS_MS[0])
  const dot2 = useDotPulse(DOT_OFFSETS_MS[1])
  const dot3 = useDotPulse(DOT_OFFSETS_MS[2])

  return (
    <View style={[stylesCommon.fill, stylesCommon.centerItems, styles.dots]}>
      <Dot progress={dot1} />
      <Dot progress={dot2} />
      <Dot progress={dot3} />
    </View>
  )
}

const BUBBLE_HEIGHT = 35
const BUBBLE_MARGIN = 8
const SLIDE_MS = 250

// The bubble pops in where it stands and fades away, while the list moves the rows.
const bubbleIn = ZoomIn.duration(200).easing(Easing.out(Easing.quad))
const bubbleOut = FadeOut.duration(150)

/** Inside a list that animates its rows: mounted while typing, nothing else to do. */
const MountedTypingIndicator = ({ isTyping, style }: TypingIndicatorProps) => {
  const styles = useThemedStyles(createTypingIndicatorStyles)

  if (!isTyping)
    return null

  return (
    <Animated.View
      testID='typing-indicator'
      entering={bubbleIn}
      exiting={bubbleOut}
      style={[styles.container, styles.mountedContainer, style]}
    >
      <DotsAnimation />
    </Animated.View>
  )
}

/** Anywhere else: the bubble grows its own height so the rows above it move smoothly. */
const SlidingTypingIndicator = ({ isTyping, style }: TypingIndicatorProps) => {
  const styles = useThemedStyles(createTypingIndicatorStyles)
  const yCoords = useSharedValue(200)
  const heightScale = useSharedValue(0)
  const marginScale = useSharedValue(0)

  const [isVisible, setIsVisible] = useState(isTyping)

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: yCoords.value,
      },
    ],
    height: heightScale.value,
    marginBottom: marginScale.value,
  }))

  const slideIn = useCallback(() => {
    yCoords.value = withTiming(0, { duration: SLIDE_MS })
    heightScale.value = withTiming(BUBBLE_HEIGHT, { duration: SLIDE_MS })
    marginScale.value = withTiming(BUBBLE_MARGIN, { duration: SLIDE_MS })
  }, [yCoords, heightScale, marginScale])

  const slideOut = useCallback(() => {
    yCoords.value = withTiming(200, { duration: SLIDE_MS }, isFinished => {
      if (isFinished)
        runOnJS(setIsVisible)(false)
    })
    heightScale.value = withTiming(0, { duration: SLIDE_MS })
    marginScale.value = withTiming(0, { duration: SLIDE_MS })
  }, [yCoords, heightScale, marginScale])

  useEffect(() => {
    if (isVisible)
      if (isTyping)
        slideIn()
      else
        slideOut()
  }, [isVisible, isTyping, slideIn, slideOut])

  useEffect(() => {
    if (isTyping)
      setIsVisible(true)
  }, [isTyping])

  if (!isVisible)
    return null

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        style,
      ]}
    >
      <DotsAnimation />
    </Animated.View>
  )
}

export const TypingIndicator = (props: TypingIndicatorProps) => {
  const isListAnimated = useContext(TypingIndicatorListAnimationContext)

  return isListAnimated
    ? <MountedTypingIndicator {...props} />
    : <SlidingTypingIndicator {...props} />
}
