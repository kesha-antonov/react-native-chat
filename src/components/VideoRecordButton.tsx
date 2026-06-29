import React, { useCallback, useState } from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'

import { useThemedStyles } from '../hooks/useTheme'
import { IMessage, VideoRecordingProps } from '../Models'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { CameraIcon } from './MediaControls'
import { VideoNoteRecorder, isVisionCameraAvailable } from './VideoNoteRecorder'

// Optional camera-roll/launcher fallback. Resolved through a try/catch require.
let imagePicker: any = null
try {
  imagePicker = require('expo-image-picker')
} catch {
  imagePicker = null
}

// Optional expo-device, used only to detect a simulator/emulator. The system
// camera (UIImagePickerController) throws an uncaught native exception on the
// iOS simulator ("No available types for source 1") that can't be caught in JS,
// so we skip launching it there and surface an error instead of crashing.
let device: any = null
try {
  device = require('expo-device')
} catch {
  device = null
}

export const isVideoRecordingAvailable = isVisionCameraAvailable || !!imagePicker?.launchCameraAsync

export interface VideoRecordButtonProps<TMessage extends IMessage = IMessage> {
  config?: VideoRecordingProps
  onSend?: (
    message: Partial<TMessage>,
    shouldResetInputToolbar: boolean
  ) => void
}

/**
 * Camera button for video messages. Prefers react-native-vision-camera for a
 * Telegram-style round video note recorder; falls back to expo-image-picker's
 * system camera. Only rendered when one of those is installed.
 */
export function VideoRecordButton<TMessage extends IMessage = IMessage> ({
  config,
  onSend,
}: VideoRecordButtonProps<TMessage>) {
  const styles = useThemedStyles(createStyles)
  const [isRecorderOpen, setIsRecorderOpen] = useState(false)

  const launchPicker = useCallback(async () => {
    // expo-image-picker's system camera hard-crashes on a simulator/emulator
    // (no camera hardware). Surface a catchable error instead of crashing.
    if (device && device.isDevice === false) {
      config?.onError?.(new Error('Camera is not available on a simulator/emulator. Use a physical device.'))
      return
    }

    try {
      const permission = await imagePicker.requestCameraPermissionsAsync()
      if (!permission?.granted)
        return

      const mediaTypes = imagePicker.MediaTypeOptions?.Videos ?? ['videos']

      const result = await imagePicker.launchCameraAsync({
        mediaTypes,
        videoMaxDuration: config?.maxDuration ?? 60,
        quality: 1,
      })

      const uri = result?.assets?.[0]?.uri
      if (!result?.canceled && uri)
        onSend?.({ video: uri } as Partial<TMessage>, false)
    } catch (error) {
      config?.onError?.(error)
    }
  }, [config, onSend])

  const handlePress = useCallback(() => {
    if (isVisionCameraAvailable)
      setIsRecorderOpen(true)
    else
      launchPicker()
  }, [launchPicker])

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityRole='button'
        accessibilityLabel='record video message'
        style={styles.button}
      >
        <Icon name='camera' color={styles.iconColor.color} size={22} fallback={<CameraIcon color={styles.iconColor.color} size={22} />} />
      </Pressable>

      {isVisionCameraAvailable && (
        <Modal
          visible={isRecorderOpen}
          animationType='slide'
          onRequestClose={() => setIsRecorderOpen(false)}
          statusBarTranslucent
        >
          {isRecorderOpen && (
            <VideoNoteRecorder<TMessage>
              config={config}
              onSend={onSend}
              onClose={() => setIsRecorderOpen(false)}
            />
          )}
        </Modal>
      )}
    </>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Inset camera control, bottom-aligned inside the field group.
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  // Carries the themed icon color (StyleSheet keeps it out of JSX).
  iconColor: {
    color: theme.colors.incomingMeta,
  },
})
