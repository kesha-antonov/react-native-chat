import React from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { ZoomIn } from 'react-native-reanimated'

import { Icon } from '../components/Icon'
import { TrashIcon } from '../components/MediaControls'
import { RecordedVoicePreview, VoiceRecordingPreview, formatElapsed } from '../components/VoiceMessageInput'
import { useIsRTL } from '../hooks/useIsRTL'
import { useThemedStyles } from '../hooks/useTheme'
import { stretchOut, videoStretchIn, voiceStretchIn } from './animations'
import { createStyles } from './styles'

interface TakePreviewBarProps {
  voicePreview: VoiceRecordingPreview | null
  videoPreview: { durationMs: number } | null
  onDelete: () => void
  onTrimVoice: (start: number, end: number) => void
}

/**
 * A paused take: delete on the left, the take in the middle, send
 * in the record button's slot (`recordedAudioPanel`).
 */
export function TakePreviewBar ({ voicePreview, videoPreview, onDelete, onTrimVoice }: TakePreviewBarProps) {
  const styles = useThemedStyles(createStyles)
  const isRTL = useIsRTL()

  return (
    <View style={[styles.recordingBar, styles.previewBar, isRTL && styles.rowReverse]}>
      {/* The delete button pops in once the circle has shrunk away. */}
      <Animated.View entering={ZoomIn.delay(150).duration(150)}>
        <Pressable
          style={styles.recTrash}
          hitSlop={8}
          onPress={onDelete}
          accessibilityRole='button'
          accessibilityLabel='delete recording'
        >
          <Icon
            name='trash'
            color={styles.recTrashColor.color}
            size={20}
            fallback={<TrashIcon color={styles.recTrashColor.color} size={20} />}
          />
        </Pressable>
      </Animated.View>
      <Animated.View
        entering={voicePreview ? voiceStretchIn : videoStretchIn}
        exiting={stretchOut}
        // The pill grows out of the record button's side.
        style={[styles.previewContent, { transformOrigin: isRTL ? 'left center' : 'right center' }]}
      >
        {voicePreview
          ? (
            <RecordedVoicePreview
              key={voicePreview.uri}
              preview={voicePreview}
              onTrim={onTrimVoice}
            />
          )
          : (
            <View style={styles.videoPreviewPill}>
              <Text style={styles.videoPreviewTime}>{formatElapsed(videoPreview?.durationMs ?? 0)}</Text>
            </View>
          )}
      </Animated.View>
    </View>
  )
}
