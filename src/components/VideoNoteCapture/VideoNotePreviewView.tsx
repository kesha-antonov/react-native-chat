import React, { useCallback, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { SpeakerIcon } from '../VideoNoteOverlay'
import { expoVideo } from './optional'
import { styles } from './styles'
import { useRoundAnimation } from './useRoundAnimation'
import { useRoundLayout } from './useRoundLayout'

/**
 * A paused take playing back in the circle: muted and looping, tap to hear it. Only mounted when expo-video is
 * installed.
 */
export function VideoNotePreviewView ({ uri, isClosing, isSlideOut, isFlight }: {
  uri: string
  isClosing: boolean
  isSlideOut: boolean
  isFlight: boolean
}) {
  const { area, onLayout, roundSize } = useRoundLayout()
  const roundRef = useRef<React.ComponentRef<typeof View>>(null)
  const { roundStyle } = useRoundAnimation({ isClosing, isSlideOut, isOpen: true, area, isFlight, roundRef, roundSize })
  const [isMuted, setIsMuted] = useState(true)
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    p.loop = true
    p.muted = true
    p.play()
  })
  const VideoView = expoVideo.VideoView

  const toggleMute = useCallback(() => {
    setIsMuted(current => {
      const next = !current
      try {
        player.muted = next
      } catch {
        // player already released
      }
      return next
    })
  }, [player])

  return (
    <View style={styles.stage} onLayout={onLayout} pointerEvents='box-none'>
      {roundSize > 0 && (
        <Animated.View ref={roundRef} collapsable={false} style={roundStyle}>
          <Pressable
            onPress={toggleMute}
            disabled={isClosing}
            accessibilityRole='button'
            accessibilityLabel={isMuted ? 'unmute preview' : 'mute preview'}
            style={[styles.round, { width: roundSize, height: roundSize, borderRadius: roundSize / 2 }]}
          >
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              nativeControls={false}
              contentFit='cover'
            />
            {isMuted && (
              <View style={styles.muteBadge} pointerEvents='none'>
                <SpeakerIcon isMuted size={14} />
              </View>
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}
