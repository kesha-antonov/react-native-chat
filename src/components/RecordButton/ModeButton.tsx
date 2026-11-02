import React, { useEffect } from 'react'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { ReduceMotion, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { Icon } from '../Icon'
import { CameraIcon, MicIcon } from '../MediaControls'
import { RecordButtonStyles } from './styles'
import type { useRecordGesture } from './useRecordGesture'

/**
 * The idle button's icon last shown, so a remount caused by the voice / video
 * toggle can cross-swap from the previous icon instead of snapping.
 */
let lastShownMode: 'voice' | 'video' | null = null

/** Mic <-> camera: 0 shows the mic, 1 the camera, animated between on a toggle. */
export function useModeMorph (mode: 'voice' | 'video') {
  const isVideo = mode !== 'voice'
  const modeSV = useSharedValue(lastShownMode === null || lastShownMode === mode ? (isVideo ? 1 : 0) : (isVideo ? 0 : 1))

  // Mic <-> camera: a quick scale and fade cross-swap when the mode toggles.
  useEffect(() => {
    lastShownMode = mode
    modeSV.set(withTiming(mode === 'video' ? 1 : 0, { duration: 150, reduceMotion: ReduceMotion.System }))
  }, [mode, modeSV])

  return modeSV
}

interface ModeButtonProps {
  gesture: ReturnType<typeof useRecordGesture>
  /** 1 while the button shows, 0 while it hides under the big circle. */
  buttonShown: SharedValue<number>
  modeSV: SharedValue<number>
  isVideo: boolean
  styles: RecordButtonStyles
}

/** The 36pt button a take is held on, with its mic and camera icons. */
export function ModeButton ({ gesture, buttonShown, modeSV, isVideo, styles }: ModeButtonProps) {
  // Hidden under the big circle while a take records, back once it has left.
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonShown.value,
    transform: [{ scale: 0.6 + 0.4 * buttonShown.value }],
  }))

  const micStyle = useAnimatedStyle(() => {
    const out = Math.min(1, modeSV.value * 2)
    return { opacity: 1 - out, transform: [{ scale: 1 - 0.9 * out }] }
  })
  const cameraStyle = useAnimatedStyle(() => {
    const into = Math.max(0, modeSV.value * 2 - 1)
    return { opacity: into, transform: [{ scale: 0.1 + 0.9 * into }] }
  })

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityRole='button'
        accessibilityLabel={isVideo ? 'record video message' : 'record voice message'}
        style={[styles.button, buttonStyle]}
      >
        <Animated.View style={[styles.modeIcon, micStyle]}>
          <Icon name='mic' color='#fff' size={22} fallback={<MicIcon color='#fff' size={22} />} />
        </Animated.View>
        <Animated.View style={[styles.modeIcon, cameraStyle]}>
          <Icon name='camera' color='#fff' size={22} fallback={<CameraIcon color='#fff' size={22} />} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}
