import React from 'react'
import { Text, View } from 'react-native'
import { ZoomIn, ZoomOut } from 'react-native-reanimated'

import { useLabels } from '../../hooks/useLabels'
import { EASE_OUT_QUINT } from './constants'
import { AnimatedPressable } from './ResumeButton'
import { RecordButtonStyles } from './styles'
import { RecordButtonPhase } from './types'

interface ViewOnceButtonProps {
  phase: RecordButtonPhase
  isViewOnce: boolean
  onPress: () => void
  styles: RecordButtonStyles
}

/**
 * View-once: scales in above the lock once the take snaps locked
 * (`snapAnimationProgress`), "1" in a circle, filled while on.
 */
export function ViewOnceButton ({ phase, isViewOnce, onPress, styles }: ViewOnceButtonProps) {
  const labels = useLabels()
  return (
    <AnimatedPressable
      entering={ZoomIn.duration(250).easing(EASE_OUT_QUINT)}
      exiting={ZoomOut.duration(150)}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel={isViewOnce ? labels.deactivateViewOnce : labels.activateViewOnce}
      accessibilityState={{ selected: isViewOnce }}
      style={[styles.onceButton, phase === 'preview' ? styles.oncePreview : styles.onceLocked]}
    >
      <View style={[styles.onceBadge, isViewOnce && styles.onceBadgeOn]}>
        <Text style={[styles.onceText, isViewOnce && styles.onceTextOn]}>1</Text>
      </View>
    </AnimatedPressable>
  )
}
