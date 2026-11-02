import React from 'react'
import { Text, View } from 'react-native'

import { useLabels } from '../../hooks/useLabels'
import { Icon } from '../Icon'
import { CameraIcon } from '../MediaControls'
import { RecorderChrome } from './RecorderChrome'
import { styles } from './styles'

/**
 * No native camera module: an honest dead-end. The shutter is visibly disabled
 * and nothing can be sent - previously this path fabricated a note from a
 * hardcoded remote sample clip.
 */
export function UnavailableVideoNote ({ onClose }: { onClose: () => void }) {
  const labels = useLabels()

  return (
    <RecorderChrome
      elapsed={0}
      maxMs={1}
      isRecording={false}
      isLocked={false}
      isDisabled
      onStart={() => {}}
      onStop={() => {}}
      onCancel={onClose}
      onLock={() => {}}
      onClose={onClose}
      cancelLabel={labels.cancel}
      hint={labels.noCamera}
      preview={(
        <View style={styles.placeholder}>
          <Icon name='camera' color='rgba(255,255,255,0.6)' size={44} fallback={<CameraIcon color='rgba(255,255,255,0.6)' size={44} />} />
          <Text style={styles.placeholderText}>{labels.noCamera}</Text>
        </View>
      )}
    />
  )
}
