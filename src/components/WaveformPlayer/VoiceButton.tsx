import React from 'react'
import { Pressable, View } from 'react-native'
import Animated, { SharedValue } from 'react-native-reanimated'

import { suppressPressAfterHold } from '../messagePress'
import { MediaActionIcon, RadialProgress } from '../RadialProgress'
import { ViewOnceBadge } from '../ViewOnceBadge'
import { VOICE_BUTTON_SIZE } from '../voiceWaveform'
import { WaveformPlayerStyles } from './styles'

interface VoiceButtonProps {
  icon: MediaActionIcon
  label: string
  onPress: () => void
  /** The transfer's progress, for the ring around the cancel ✕. */
  progress: number | SharedValue<number>
  isDisabled: boolean
  isViewOnce: boolean
  hasViewOnceStarted: boolean
  styles: WaveformPlayerStyles
  playRef: React.RefObject<React.ComponentRef<typeof View> | null>
  onPlayLayout: () => void
  playRevealStyle: React.ComponentProps<typeof Animated.View>['style']
}

/** The round voice button: download, cancel with a progress ring, play or pause. */
export function VoiceButton ({
  icon,
  label,
  onPress,
  progress,
  isDisabled,
  isViewOnce,
  hasViewOnceStarted,
  styles,
  playRef,
  onPlayLayout,
  playRevealStyle,
}: VoiceButtonProps) {
  return (
    <Animated.View ref={playRef} collapsable={false} onLayout={onPlayLayout} style={playRevealStyle}>
      <Pressable
        onPress={onPress}
        {...suppressPressAfterHold}
        disabled={isDisabled}
        accessibilityRole='button'
        accessibilityState={{ disabled: isDisabled, busy: icon === 'cancel' }}
        accessibilityLabel={label}
        accessibilityHint={isViewOnce ? 'plays once' : undefined}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.playCircle, isDisabled && styles.playCircleLoading]}
      >
        <RadialProgress
          icon={icon}
          progress={progress}
          size={VOICE_BUTTON_SIZE}
          color={styles.glyphColor.color}
        />
      </Pressable>
      {isViewOnce && (
        <ViewOnceBadge
          isVisible={!hasViewOnceStarted}
          color={styles.playCircle.backgroundColor as string}
          glyphColor={styles.glyphColor.color}
          cutColor={styles.bubble.backgroundColor as string}
        />
      )}
    </Animated.View>
  )
}
