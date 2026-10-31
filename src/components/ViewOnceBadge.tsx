import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {
  VIEW_ONCE_BADGE_CUT,
  VIEW_ONCE_BADGE_OFFSET,
  VIEW_ONCE_BADGE_SIZE,
  VIEW_ONCE_RING_SIZE,
  VOICE_BUTTON_SIZE,
} from './voiceWaveform'

// Telegram scales the badge with the button's icon (`iconScale`) as playback
// starts; here it shrinks away over 320ms.
const SCALE_MS = 320
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
const RING_STROKE = 1.5

const OUTER = VIEW_ONCE_BADGE_SIZE + 2 * VIEW_ONCE_BADGE_CUT

/**
 * Telegram's view-once marker (`drawVoiceOnce`): a small disc in the button's
 * color at the play button's lower right, cut out of it by a thin ring of the
 * bubble's color, holding a "1" in a ring that is solid on its left half and
 * dashed on its right (`PeriodDrawable(3)`). Drawn here, not copied.
 * Lay it over the play button; it does not take touches.
 */
export function ViewOnceBadge ({
  isVisible,
  color,
  glyphColor,
  cutColor,
  offset = VIEW_ONCE_BADGE_OFFSET,
}: {
  isVisible: boolean
  /** The play button's fill. */
  color: string
  /** The play glyph's color, used for the "1". */
  glyphColor: string
  /** The bubble behind the button, for the ring cut around the badge. */
  cutColor: string
  /**
   * How far right and down of the button's centre the badge sits: 16 on a
   * voice note, 18 on a round one (`drawRadialProgress`'s `cx + dp(18)`).
   */
  offset?: number
}) {
  const scale = useSharedValue(isVisible ? 1 : 0)

  useEffect(() => {
    scale.value = withTiming(isVisible ? 1 : 0, { duration: SCALE_MS, easing: EASE_OUT_QUINT })
  }, [isVisible, scale])

  useEffect(() => () => cancelAnimation(scale), [scale])

  const centre = VOICE_BUTTON_SIZE / 2 + offset
  const position = { left: centre - OUTER / 2, top: centre - OUTER / 2 }

  const style = useAnimatedStyle(() => ({
    opacity: scale.value > 0.01 ? 1 : 0,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      pointerEvents='none'
      testID='view-once-badge'
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      style={[styles.badge, position, { backgroundColor: color, borderColor: cutColor }, style]}
    >
      <View style={styles.ring}>
        <View style={[styles.half, styles.left]}>
          <View style={[styles.circle, { borderColor: glyphColor }]} />
        </View>
        <View style={[styles.half, styles.right]}>
          <View style={[styles.circle, styles.circleRight, styles.dashed, { borderColor: glyphColor }]} />
        </View>
        <Text style={[styles.one, { color: glyphColor }]}>1</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: VIEW_ONCE_BADGE_CUT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: VIEW_ONCE_RING_SIZE,
    height: VIEW_ONCE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  half: {
    position: 'absolute',
    top: 0,
    width: VIEW_ONCE_RING_SIZE / 2,
    height: VIEW_ONCE_RING_SIZE,
    overflow: 'hidden',
  },
  left: {
    left: 0,
  },
  right: {
    left: VIEW_ONCE_RING_SIZE / 2,
  },
  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: VIEW_ONCE_RING_SIZE,
    height: VIEW_ONCE_RING_SIZE,
    borderRadius: VIEW_ONCE_RING_SIZE / 2,
    borderWidth: RING_STROKE,
  },
  circleRight: {
    left: -VIEW_ONCE_RING_SIZE / 2,
  },
  dashed: {
    borderStyle: 'dashed',
  },
  // PeriodDrawable's 10-size digit, nudged a third of a point left and down.
  one: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    includeFontPadding: false,
    transform: [{ translateX: -0.33 }, { translateY: 0.33 }],
  },
})
