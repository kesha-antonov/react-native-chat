import React, { useCallback, useState } from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useThemedStyles } from '../hooks/useTheme'
import { IMessage, VideoRecordingProps } from '../Models'
import { getExpoDevice, getExpoImagePicker } from '../optional'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { CameraIcon } from './MediaControls'
import { VideoNoteRecorder } from './VideoNoteRecorder'
import { isVisionCameraAvailable, isVisionCameraNativeReady } from './visionCamera'

// Optional camera-roll/launcher fallback. Resolved through the optional-peer registry (`src/optional`).
const imagePicker = getExpoImagePicker()

// Optional expo-device, used only to detect a simulator/emulator. The system
// camera (UIImagePickerController) throws an uncaught native exception on the
// iOS simulator ("No available types for source 1") that can't be caught in JS,
// so we skip launching it there and surface an error instead of crashing.
const device = getExpoDevice()

const RECORDER_FADE_IN = { duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }
const RECORDER_FADE_OUT = { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }

export const isVideoRecordingAvailable = isVisionCameraAvailable || !!imagePicker?.launchCameraAsync

export interface VideoRecordButtonProps<TMessage extends IMessage = IMessage> {
  config?: VideoRecordingProps
  onSend?: (
    message: Partial<TMessage>,
    shouldResetInputToolbar: boolean
  ) => void
  /**
   * Single tap on the button. Set when the control shares the right slot with
   * the mic: a tap switches back to voice, a hold opens the recorder.
   */
  onTap?: () => void
  /**
   * `inset` (default) is the small glyph inside the composer field; `round` is
   * the filled accent circle that occupies the right slot beside it.
   */
  variant?: 'inset' | 'round'
}

/**
 * Camera button for video messages. Prefers react-native-vision-camera for a
 * Round video note recorder; falls back to expo-image-picker's
 * system camera. Only rendered when one of those is installed.
 *
 * Note the two backends produce different messages: the round recorder sends
 * `{ video, videoNote: true }` (a circular note), while the system-camera
 * fallback sends a plain `{ video }` full-frame clip, because a rectangular
 * capture would crop badly into a circle.
 */
export function VideoRecordButton<TMessage extends IMessage = IMessage> ({
  config,
  onSend,
  onTap,
  variant = 'inset',
}: VideoRecordButtonProps<TMessage>) {
  const styles = useThemedStyles(createStyles)
  const [isRecorderOpen, setIsRecorderOpen] = useState(false)
  const closeRecorder = useCallback(() => setIsRecorderOpen(false), [])

  // Fades rather than replaces the conversation; the
  // recorder stays mounted until it has faded out.
  const recorderOpacity = useSharedValue(0)
  const animateIn = useCallback(() => {
    recorderOpacity.set(withTiming(1, RECORDER_FADE_IN))
  }, [recorderOpacity])
  const animateOut = useCallback((onDone: () => void) => {
    recorderOpacity.set(withTiming(0, RECORDER_FADE_OUT, finished => {
      if (finished)
        runOnJS(onDone)()
    }))
  }, [recorderOpacity])
  const { isMounted: isRecorderMounted } = useAnimatedPresence(isRecorderOpen, animateIn, animateOut)
  const recorderStyle = useAnimatedStyle(() => ({ opacity: recorderOpacity.get() }))

  const launchPicker = useCallback(async () => {
    // expo-image-picker's system camera hard-crashes on a simulator/emulator
    // (no camera hardware). Surface a catchable error instead of crashing.
    if (device && device.isDevice === false) {
      config?.onError?.(new Error('Camera is not available on a simulator/emulator. Use a physical device.'))
      return
    }

    // `.catch` rather than try/catch: the compiler cannot lower the optional chains inside a `try`.
    await (async () => {
      const permission = await imagePicker.requestCameraPermissionsAsync()
      if (!permission?.granted) {
        config?.onPermissionDenied?.()
        return
      }

      const mediaTypes = imagePicker.MediaTypeOptions?.Videos ?? ['videos']

      const result = await imagePicker.launchCameraAsync({
        mediaTypes,
        videoMaxDuration: config?.maxDuration ?? 60,
        quality: 1,
      })

      const uri = result?.assets?.[0]?.uri
      if (!result?.canceled && uri)
        onSend?.({ video: uri } as Partial<TMessage>, false)
    })().catch(error => {
      config?.onError?.(error)
    })
  }, [config, onSend])

  // Gate on the *native* probe, not the JS require: a binary where the package
  // is installed but not linked would otherwise open a recorder that can never
  // capture, instead of falling back to the system camera.
  const handlePress = useCallback(() => {
    if (isVisionCameraNativeReady)
      setIsRecorderOpen(true)
    else if (imagePicker?.launchCameraAsync)
      launchPicker()
    else
      setIsRecorderOpen(true)
  }, [launchPicker])

  const isRound = variant === 'round'

  return (
    <>
      <Pressable
        // Sharing the slot with the mic: tap toggles back to voice, a long press
        // opens the recorder - the same tap/hold split the mic uses.
        onPress={onTap ?? handlePress}
        onLongPress={onTap ? handlePress : undefined}
        delayLongPress={180}
        accessibilityRole='button'
        accessibilityLabel={onTap ? 'switch to voice message' : 'record video message'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={isRound ? styles.roundButton : styles.button}
      >
        <Icon
          name='camera'
          color={isRound ? '#fff' : styles.iconColor.color}
          size={22}
          fallback={<CameraIcon color={isRound ? '#fff' : styles.iconColor.color} size={22} />}
        />
      </Pressable>

      {isVisionCameraAvailable && (
        <Modal
          visible={isRecorderMounted}
          // Transparent so the recorder's scrim dims the conversation rather
          // than replacing it.
          transparent
          animationType='none'
          onRequestClose={closeRecorder}
          statusBarTranslucent
        >
          {isRecorderMounted && (
            <Animated.View
              style={[styles.recorderLayer, recorderStyle]}
              pointerEvents={isRecorderOpen ? 'auto' : 'none'}
            >
              <VideoNoteRecorder<TMessage>
                config={config}
                onSend={onSend}
                onClose={closeRecorder}
              />
            </Animated.View>
          )}
        </Modal>
      )}
    </>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  recorderLayer: {
    flex: 1,
  },
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
  // Right-slot form: matches the mic/send circle so the swap doesn't shift the row.
  roundButton: {
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
})
