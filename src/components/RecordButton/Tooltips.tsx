import React from 'react'
import { Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { RecordButtonStyles } from './styles'

interface TooltipProps {
  text: string
  styles: RecordButtonStyles
}

/** "Slide up to lock", beside the lock. */
export function LockTooltip ({ text, styles }: TooltipProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.tooltip, styles.lockTooltip]}
      pointerEvents='none'
    >
      <Text style={styles.tooltipText} numberOfLines={2}>{text}</Text>
    </Animated.View>
  )
}

/** "Pause to trim or replay", beside the pause button. */
export function PauseTooltip ({ text, styles }: Omit<TooltipProps, 'text'> & { text?: string | null }) {
  return (
    <View style={[styles.tooltip, styles.pauseTooltip]} pointerEvents='none'>
      <Text style={styles.tooltipText} numberOfLines={2}>{text}</Text>
    </View>
  )
}

/** The view-once tooltip, beside the toggle. */
export function OnceTooltip ({ text, isPreview, styles }: TooltipProps & { isPreview: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[styles.tooltip, isPreview ? styles.onceTooltipPreview : styles.onceTooltip]}
      pointerEvents='none'
    >
      <Text style={styles.tooltipText} numberOfLines={3}>{renderBold(text, styles.tooltipBold)}</Text>
    </Animated.View>
  )
}

/** A hint above the idle button, e.g. after a mode switch. */
export function IdleTooltip ({ text, styles }: TooltipProps) {
  return (
    <View style={[styles.tooltip, styles.hintTooltip]} pointerEvents='none'>
      <Text style={styles.tooltipText}>{text}</Text>
    </View>
  )
}

/** Hints mark their bold part with `**`. */
function renderBold (text: string, boldStyle: object) {
  return text.split('**').map((part, index) =>
    index % 2 === 1
      ? <Text key={index} style={boldStyle}>{part}</Text>
      : part
  )
}
