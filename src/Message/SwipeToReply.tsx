import React from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { impactHaptic } from '../components/haptics'
import { Icon } from '../components/Icon'
import { ReplyArrowIcon } from '../components/MediaControls'
import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'

// Every value below is Telegram Android's, from `ChatActivity`'s `ChatListView`
// (`processTouchEvent`, `onDraw`, `drawReplyButton`).
/** The drag starts once the finger has moved 0.4cm sideways (`getPixelsInCM(0.4f)`), about 25pt. */
const SWIPE_START = 25
/** A mostly-sideways drag: Telegram requires `|dx| / 3 > dy` to take over from the list. */
const SWIPE_FAIL_Y = 9
/** The row follows the finger 1:1, up to 80pt (`dp(-80)` clamp). */
const SWIPE_MAX = 80
/** Past 50pt a release replies, and crossing it ticks (`KEYBOARD_TAP`). */
export const SWIPE_REPLY_THRESHOLD = 50
/** The arrow appears once the row has moved 20pt, and fills over the next 30pt. */
const ICON_APPEAR = 20
const ICON_FILL = 30
/** The circle behind the arrow: `dp(16)` radius. */
const ICON_SIZE = 32
/** The row slides back over 180ms on a decelerate curve (`trackAnimationProgress += dt / 180`). */
const RETURN = { duration: 180, easing: Easing.out(Easing.quad) }
// AndroidX springs are stiffness + damping ratio on unit mass; Reanimated takes the damping
// coefficient, `2 * ratio * sqrt(stiffness)`.
const androidSpring = (stiffness: number, dampingRatio: number) => ({
  mass: 1,
  stiffness,
  damping: 2 * dampingRatio * Math.sqrt(stiffness),
})
/** `slidingDrawableVisibilitySpring`: `STIFFNESS_MEDIUM` (1500), `DAMPING_RATIO_NO_BOUNCY`. */
const APPEAR_SPRING = androidSpring(1500, 1)
/** `slidingFillProgressSpring`: stiffness 400, `DAMPING_RATIO_MEDIUM_BOUNCY` (0.5). */
const FILL_SPRING = androidSpring(400, 0.5)

export interface SwipeToReplyRowProps {
  direction: 'left' | 'right'
  /** Whose message it is: Telegram moves the arrow half as far beside an outgoing one. */
  position: 'left' | 'right'
  onReply: () => void
  renderAction?: (
    progress: SharedValue<number>,
    translation: SharedValue<number>,
    position: 'left' | 'right'
  ) => React.ReactNode
  actionContainerStyle?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/**
 * Telegram Android's swipe-to-reply: drag a message sideways, the arrow fills as you go, a tick
 * marks the point of no return, and letting go past it starts a reply while the row slides back.
 * The row never "opens".
 */
export const SwipeToReplyRow = ({
  direction,
  position,
  onReply,
  renderAction,
  actionContainerStyle,
  children,
}: SwipeToReplyRowProps) => {
  // React Compiler would memoize the gesture config on `offset.value`, which its callbacks read,
  // and so read a shared value during render (Reanimated warns once per row per render).
  'use no memo'
  const styles = useThemedStyles(createStyles)
  const sign = direction === 'left' ? -1 : 1
  const offset = useSharedValue(0)
  const isPastThreshold = useSharedValue(false)
  const iconScale = useSharedValue(0)
  const isIconShown = useSharedValue(false)

  const pan = usePanGesture({
    testID: 'swipe-to-reply',
    activeOffsetX: direction === 'left'
      ? [-SWIPE_START, Number.MAX_SAFE_INTEGER]
      : [-Number.MAX_SAFE_INTEGER, SWIPE_START],
    failOffsetY: [-SWIPE_FAIL_Y, SWIPE_FAIL_Y],
    onUpdate: event => {
      // Counted from where the drag took over, as Telegram resets `startedTrackingX` there.
      const distance = Math.min(SWIPE_MAX, Math.max(0, event.translationX * sign - SWIPE_START))
      offset.value = distance * sign

      // Only on a change: reassigning every frame would cancel a running spring.
      const shouldShowIcon = distance >= ICON_APPEAR
      if (shouldShowIcon !== isIconShown.value) {
        isIconShown.value = shouldShowIcon
        iconScale.value = withSpring(shouldShowIcon ? 1 : 0, APPEAR_SPRING)
      }

      if (distance >= SWIPE_REPLY_THRESHOLD) {
        if (!isPastThreshold.value) {
          isPastThreshold.value = true
          // The full circle pops, bouncing back to size.
          iconScale.value = 1.25
          iconScale.value = withSpring(1, FILL_SPRING)
          runOnJS(impactHaptic)('Light')
        }
      } else {
        isPastThreshold.value = false
      }
    },
    onDeactivate: event => {
      if (!event.canceled && Math.abs(offset.value) >= SWIPE_REPLY_THRESHOLD)
        runOnJS(onReply)()
    },
    onFinalize: () => {
      isPastThreshold.value = false
      isIconShown.value = false
      offset.value = withTiming(0, RETURN)
      iconScale.value = withTiming(0, RETURN)
    },
  })

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }))

  // Beside an outgoing message the arrow travels half as far (`translationX * 0.5f`).
  const travel = position === 'right' ? 0.5 : 1
  const iconStyle = useAnimatedStyle(() => {
    const fill = Math.min(1, Math.max(0, (Math.abs(offset.value) - ICON_APPEAR) / ICON_FILL))
    return {
      opacity: 0.4 + 0.6 * fill,
      transform: [{ translateX: offset.value * travel }, { scale: iconScale.value }],
    }
  })

  const progress = useDerivedValue(() => Math.abs(offset.value) / SWIPE_REPLY_THRESHOLD)

  return (
    <GestureDetector gesture={pan}>
      <View>
        {renderAction
          ? (
            <View
              pointerEvents='none'
              style={[direction === 'left' ? styles.customActionRight : styles.customActionLeft, actionContainerStyle]}
            >
              {renderAction(progress, offset, position)}
            </View>
          )
          : (
            <Animated.View
              pointerEvents='none'
              style={[
                styles.icon,
                direction === 'left' ? styles.iconRight : styles.iconLeft,
                iconStyle,
                actionContainerStyle,
              ]}
            >
              <Icon
                name='reply'
                color={styles.iconGlyph.color}
                size={18}
                fallback={<ReplyArrowIcon color={styles.iconGlyph.color} size={18} />}
              />
            </Animated.View>
          )}
        <Animated.View style={rowStyle}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Telegram draws the arrow on the service background, the date pill's colour.
  icon: {
    position: 'absolute',
    top: '50%',
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginTop: -ICON_SIZE / 2,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: theme.colors.dayPillBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centred on the row's trailing edge, so it comes in with the row.
  iconRight: {
    right: -ICON_SIZE / 2,
  },
  iconLeft: {
    left: -ICON_SIZE / 2,
  },
  iconGlyph: {
    color: theme.colors.dayPillText,
  },
  customActionRight: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  customActionLeft: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
})
