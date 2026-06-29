import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { AudioRecordingProps, IMessage } from '../Models'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { ChevronIcon, LockIcon, MicIcon } from './MediaControls'
import { SendIcon } from './SendIcon'

// Optional recorder. Resolved through a try/catch require so the bundle works
// whether or not the consumer installed `expo-audio` (Metro treats
// try/catch-wrapped requires as optional dependencies).
let expoAudio: any = null
try {
  expoAudio = require('expo-audio')
} catch {
  expoAudio = null
}

export const isVoiceRecordingAvailable = !!(
  expoAudio?.useAudioRecorder &&
  expoAudio?.RecordingPresets &&
  expoAudio?.AudioModule
)

export const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Live recording state surfaced to the InputToolbar so it can render the bar. */
export interface VoiceRecordingState {
  active: boolean
  locked: boolean
  elapsed: number
  cancelArmed: boolean
}

export interface VoiceMessageInputHandle {
  /** Discard the in-progress recording (used by the bar's Cancel button). */
  cancel: () => void
}

export interface VoiceMessageInputProps {
  config?: AudioRecordingProps
  onSend?: (
    message: Partial<IMessage>,
    shouldResetInputToolbar: boolean
  ) => void
  /** Reports recording state up so the toolbar can draw the timer/cancel bar. */
  onStateChange?: (state: VoiceRecordingState) => void
}

/**
 * Telegram-style hold-to-record voice notes. Hold the mic to record, slide left
 * to cancel, slide up to lock for hands-free recording (release and tap send),
 * or release to send. A release under `minDurationMs` is discarded.
 *
 * This component owns only the right-side control (mic / send button, the lock
 * affordance and the amplitude halo). The recording bar - timer, "slide to
 * cancel" hint - is drawn by the InputToolbar via `onStateChange`, so it can
 * span the full width of the input row. Only mounted when expo-audio is
 * available, so its hooks always run in a stable order.
 */
function VoiceMessageInputInner (
  { config, onSend, onStateChange }: VoiceMessageInputProps,
  ref: React.Ref<VoiceMessageInputHandle>
) {
  const styles = useThemedStyles(createStyles)
  const { voice } = useTheme()
  const recorder = expoAudio.useAudioRecorder(expoAudio.RecordingPresets.HIGH_QUALITY)

  const [isRecording, setIsRecording] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cancelArmedState, setCancelArmedState] = useState(false)

  const startedAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const lockedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const minDurationMs = config?.minDurationMs ?? 800

  const cancelThreshold = voice.cancelThreshold
  const lockThreshold = voice.lockThreshold
  const maxSlide = -(cancelThreshold + 60)
  const lockTravel = lockThreshold + 12

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const cancelArmed = useSharedValue(0)
  const lockProgress = useSharedValue(0)
  const lockedSV = useSharedValue(0)
  const halo = useSharedValue(0)

  // Surface recording state to the toolbar (timer/cancel bar live there).
  useEffect(() => {
    onStateChange?.({ active: isRecording, locked: isLocked, elapsed, cancelArmed: cancelArmedState })
  }, [onStateChange, isRecording, isLocked, elapsed, cancelArmedState])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearTimer()
    cancelAnimation(halo)
  }, [clearTimer, halo])

  const start = useCallback(async () => {
    if (isRecordingRef.current)
      return

    try {
      const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync()
      if (!permission?.granted)
        return

      await expoAudio.setAudioModeAsync?.({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()

      startedAtRef.current = Date.now()
      isRecordingRef.current = true
      setElapsed(0)
      setIsRecording(true)

      halo.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
        -1,
        false
      )

      clearTimer()
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current)
      }, 250)
    } catch (error) {
      config?.onError?.(error)
      isRecordingRef.current = false
      setIsRecording(false)
      clearTimer()
    }
  }, [recorder, config, clearTimer, halo])

  const finish = useCallback(async (cancelled: boolean) => {
    if (!isRecordingRef.current)
      return

    isRecordingRef.current = false
    lockedRef.current = false
    const duration = Date.now() - startedAtRef.current

    clearTimer()
    cancelAnimation(halo)
    halo.value = 0
    lockedSV.value = 0
    setIsRecording(false)
    setIsLocked(false)
    setCancelArmedState(false)

    try {
      await recorder.stop()
      const uri = recorder.uri

      if (!cancelled && uri && duration >= minDurationMs)
        onSend?.({ audio: uri } as Partial<IMessage>, false)
    } catch (error) {
      config?.onError?.(error)
    }
  }, [recorder, minDurationMs, onSend, config, clearTimer, halo, lockedSV])

  useImperativeHandle(ref, () => ({ cancel: () => finish(true) }), [finish])

  const lock = useCallback(() => {
    lockedRef.current = true
    setIsLocked(true)
  }, [])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(start)()
        })
        .onUpdate(event => {
          if (lockedSV.value > 0)
            return

          const x = Math.max(maxSlide, Math.min(0, event.translationX))
          const y = Math.max(-lockTravel, Math.min(0, event.translationY))
          translateX.value = x
          translateY.value = y
          lockProgress.value = Math.min(1, -y / lockThreshold)

          const armed = x <= -cancelThreshold ? 1 : 0
          if (armed !== cancelArmed.value) {
            cancelArmed.value = armed
            runOnJS(setCancelArmedState)(armed > 0)
          }

          if (-y >= lockThreshold) {
            lockedSV.value = 1
            translateX.value = withTiming(0, { duration: 150 })
            translateY.value = withTiming(0, { duration: 150 })
            runOnJS(lock)()
          }
        })
        .onFinalize(() => {
          if (lockedSV.value > 0)
            return

          const cancelled = cancelArmed.value > 0
          translateX.value = withTiming(0, { duration: 150 })
          translateY.value = withTiming(0, { duration: 150 })
          cancelArmed.value = 0
          lockProgress.value = 0
          runOnJS(finish)(cancelled)
        }),
    [start, finish, lock, translateX, translateY, cancelArmed, lockProgress, lockedSV, maxSlide, lockTravel, cancelThreshold, lockThreshold]
  )

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }))

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.34, 0]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [1, 2.3]) }],
  }))

  // Lock pill above the mic: the up-chevron rises and fades toward the lock as
  // the finger slides up; the whole pill nudges up to acknowledge the drag.
  const lockPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(lockProgress.value, [0, 1], [0, -6]) }],
    opacity: interpolate(lockProgress.value, [0, 0.05, 1], [0.7, 1, 1]),
  }))

  const lockChevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lockProgress.value, [0, 0.6, 1], [1, 0.4, 0]),
    transform: [{ translateY: interpolate(lockProgress.value, [0, 1], [0, -4]) }],
  }))

  return (
    <View style={styles.container}>
      {isRecording && (
        <Animated.View style={[styles.halo, haloAnimatedStyle]} pointerEvents='none' />
      )}

      {isRecording && !isLocked && (
        <Animated.View style={[styles.lockPill, lockPillStyle]} pointerEvents='none'>
          <Icon name='lock' color={styles.lockColor.color} size={15} fallback={<LockIcon color={styles.lockColor.color} size={15} />} />
          <Animated.View style={lockChevronStyle}>
            <ChevronIcon color={styles.lockColor.color} size={12} direction='down' />
          </Animated.View>
        </Animated.View>
      )}

      {isLocked
        ? (
          <Pressable
            onPress={() => finish(false)}
            accessibilityRole='button'
            accessibilityLabel='send voice message'
            style={styles.button}
          >
            <Icon name='send' color='#fff' size={20} fallback={<SendIcon color='#fff' size={20} />} />
          </Pressable>
        )
        : (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              accessibilityRole='button'
              accessibilityLabel='record voice message'
              style={[styles.button, micAnimatedStyle]}
            >
              <Icon name='mic' color='#fff' size={22} fallback={<MicIcon color='#fff' size={22} />} />
            </Animated.View>
          </GestureDetector>
        )}
    </View>
  )
}

export const VoiceMessageInput = forwardRef(VoiceMessageInputInner)

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Soft accent ring that scales out and fades, like Telegram's amplitude blob.
  halo: {
    position: 'absolute',
    width: theme.sendButton.size,
    height: theme.sendButton.size,
    borderRadius: theme.radii.sendButton,
    backgroundColor: theme.colors.accent,
    zIndex: 1,
  },
  // Lock affordance floating above the mic.
  lockPill: {
    position: 'absolute',
    bottom: theme.sendButton.size + 12,
    width: 34,
    height: 56,
    borderRadius: 17,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    zIndex: 3,
  },
  lockColor: {
    color: theme.colors.placeholder,
  },
})
