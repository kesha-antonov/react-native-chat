import React from 'react'
import { Pressable } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { Icon } from '../Icon'
import { CameraIcon, MicIcon } from '../MediaControls'
import { recordingHaptic } from '../recordingFeedback'
import { RESUME_FADE_MS } from './constants'
import { RecordButtonStyles } from './styles'

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface ResumeButtonProps {
  isVideo: boolean
  onResume: () => void
  styles: RecordButtonStyles
}

/**
 * Previewing: the pause button turns into one that records on, its
 * icon fading in as the bars fade out. It is
 * drawn in the lock's own grey, not red.
 */
export function ResumeButton ({ isVideo, onResume, styles }: ResumeButtonProps) {
  return (
    <AnimatedPressable
      entering={FadeIn.duration(RESUME_FADE_MS)}
      onPress={() => {
        recordingHaptic()
        onResume()
      }}
      hitSlop={8}
      accessibilityRole='button'
      accessibilityLabel={isVideo ? 'resume video recording' : 'resume recording'}
      style={styles.resumeButton}
    >
      {isVideo
        ? <Icon name='camera' color={styles.lockColor.color} size={18} fallback={<CameraIcon color={styles.lockColor.color} size={18} />} />
        : <Icon name='mic' color={styles.lockColor.color} size={18} fallback={<MicIcon color={styles.lockColor.color} size={18} />} />}
    </AnimatedPressable>
  )
}
