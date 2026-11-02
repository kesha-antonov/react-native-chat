import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { Icon } from '../Icon'
import { ChevronIcon, LockIcon, PauseIcon } from '../MediaControls'
import { entryCurve } from '../RecordCircle'
import { LOCK_BOB, LOCK_EXTRA_HEIGHT, LOCK_RISE, LOCK_WIDTH } from './constants'
import { RecordButtonStyles } from './styles'

interface LockPillProps {
  lockDistance: number
  /** How far the finger is up, capped at the lock distance. */
  fingerUp: SharedValue<number>
  pauseMorph: SharedValue<number>
  /** The circle's entry, which the pill rises with. */
  enter: SharedValue<number>
  lockHide: SharedValue<number>
  bob: SharedValue<number>
  lockedSV: SharedValue<number>
  lockTilt: SharedValue<number>
  isLocked: boolean
  isVideo: boolean
  /** Locked: the lock has become the pause button. Omitted, it is only drawn. */
  onPause?: () => void
  styles: RecordButtonStyles
}

/**
 * The lock above the button: a padlock and an arrow while the finger can still
 * slide up, the pause button once the take is locked.
 */
export function LockPill ({
  lockDistance,
  fingerUp,
  pauseMorph,
  enter,
  lockHide,
  bob,
  lockedSV,
  lockTilt,
  isLocked,
  isVideo,
  onPause,
  styles,
}: LockPillProps) {
  // `ControlsView`: the lock rises with the circle's entry curve, follows the
  // finger up 1:1, bobs while idle, and is 14 taller while it shows its arrow.
  const lockStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    const unlocked = 1 - pauseMorph.value
    const sc = entryCurve(enter.value)
    const scale = Math.max(0, sc * (1 - lockHide.value))
    return {
      height: LOCK_WIDTH + LOCK_EXTRA_HEIGHT * moveProgress * unlocked,
      opacity: scale > 0.01 ? 1 : 0,
      transform: [
        {
          translateY: LOCK_RISE * (1 - Math.min(1, sc)) + LOCK_RISE * lockHide.value -
            Math.min(lockDistance, fingerUp.value) - LOCK_BOB * bob.value * moveProgress * unlocked,
        },
        { scale },
      ],
    }
  })

  const padlockStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    const morph = pauseMorph.value
    const tilt = lockedSV.value > 0 ? lockTilt.value : 9 * (1 - moveProgress)
    return {
      opacity: 1 - morph,
      transform: [{ rotate: `${tilt}deg` }, { scale: 1 - 0.5 * morph }],
    }
  })

  const lockArrowStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    return { opacity: moveProgress * (1 - pauseMorph.value) }
  })

  const pauseIconStyle = useAnimatedStyle(() => ({
    opacity: pauseMorph.value,
    transform: [{ scale: 0.5 + 0.5 * pauseMorph.value }],
  }))

  return (
    <Animated.View style={[styles.lockPill, lockStyle]} pointerEvents={isLocked ? 'box-none' : 'none'}>
      <View style={styles.lockSlot}>
        <Animated.View style={padlockStyle}>
          <Icon name='lock' color={styles.lockColor.color} size={15} fallback={<LockIcon color={styles.lockColor.color} size={15} />} />
        </Animated.View>
        <Animated.View style={[styles.lockSlotOverlay, pauseIconStyle]}>
          <PauseIcon color={styles.lockColor.color} size={14} />
        </Animated.View>
      </View>
      <Animated.View style={lockArrowStyle}>
        <ChevronIcon color={styles.lockColor.color} size={12} direction='up' />
      </Animated.View>
      {/* Locked: the lock has become the pause button. */}
      {isLocked && onPause && (
        <Pressable
          onPress={onPause}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={isVideo ? 'pause video recording' : 'pause recording'}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  )
}
