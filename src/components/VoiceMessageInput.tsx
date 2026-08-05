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

/** A release that landed before the recorder finished starting up. */
type PendingFinish = { cancelled: boolean } | null

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
  // `start` is async (permission -> audio mode -> prepare), so a quick tap can
  // release the gesture before the recorder is live. These two refs let the
  // release be remembered and applied once `start` finishes, instead of being
  // dropped and leaving a recording nothing can stop.
  const startTokenRef = useRef(0)
  const pendingFinishRef = useRef<PendingFinish>(null)

  const minDurationMs = config?.minDurationMs ?? 800
  const maxDurationMs = config?.maxDurationMs ?? 600000

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

  /** Reads and clears the deferred release, in its own scope so that clearing it
   * inside `start` doesn't narrow the ref to `null` for the later read. */
  const takePendingFinish = useCallback((): PendingFinish => {
    const pending = pendingFinishRef.current
    pendingFinishRef.current = null
    return pending
  }, [])

  // Every gesture-owned shared value, back to rest. This has to run on *end* of
  // a recording rather than in `onFinalize`, because the locked path returns
  // from `onFinalize` early - leaving `cancelArmed` latched would make the next
  // release read as "cancelled" and silently discard that take.
  const resetGesture = useCallback(() => {
    translateX.value = withTiming(0, { duration: 150 })
    translateY.value = withTiming(0, { duration: 150 })
    cancelArmed.value = 0
    lockProgress.value = 0
    lockedSV.value = 0
  }, [translateX, translateY, cancelArmed, lockProgress, lockedSV])

  // Leaves the audio session as we found it. Recording puts iOS into
  // PlayAndRecord, which routes playback to the quiet receiver; not restoring it
  // makes every voice note played afterwards sound muffled.
  const releaseAudioSession = useCallback(() => {
    try {
      expoAudio.setAudioModeAsync?.({ allowsRecording: false, playsInSilentMode: true })
    } catch {
      // best-effort; the session is not worth failing a send over
    }
  }, [])

  const finish = useCallback(async (cancelled: boolean) => {
    if (!isRecordingRef.current) {
      // A release that lands while `start` is still awaiting natives: remember
      // it so `start` can apply it the moment the recorder is actually live.
      if (startTokenRef.current > 0)
        pendingFinishRef.current = { cancelled }

      return
    }

    isRecordingRef.current = false
    lockedRef.current = false
    const duration = Date.now() - startedAtRef.current

    clearTimer()
    cancelAnimation(halo)
    halo.value = 0
    resetGesture()
    setIsRecording(false)
    setIsLocked(false)
    setCancelArmedState(false)

    try {
      await recorder.stop()
      const uri = recorder.uri

      if (cancelled || !uri)
        return

      if (duration < minDurationMs) {
        config?.onTooShort?.()
        return
      }

      onSend?.({ audio: uri, duration: Math.round(duration / 1000) } as Partial<IMessage>, false)
    } catch (error) {
      config?.onError?.(error)
    } finally {
      releaseAudioSession()
    }
  }, [recorder, minDurationMs, onSend, config, clearTimer, halo, resetGesture, releaseAudioSession])

  const start = useCallback(async () => {
    if (isRecordingRef.current || startTokenRef.current > 0)
      return

    const token = Date.now()
    startTokenRef.current = token
    pendingFinishRef.current = null

    try {
      const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync()
      if (!permission?.granted) {
        config?.onPermissionDenied?.()
        return
      }

      await expoAudio.setAudioModeAsync?.({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()

      // The component may have unmounted while we were awaiting natives.
      if (startTokenRef.current !== token)
        return

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
        const ms = Date.now() - startedAtRef.current
        setElapsed(ms)
        if (ms >= maxDurationMs)
          finish(false)
      }, 250)
    } catch (error) {
      config?.onError?.(error)
      isRecordingRef.current = false
      setIsRecording(false)
      clearTimer()
      releaseAudioSession()
    } finally {
      if (startTokenRef.current === token) {
        startTokenRef.current = 0

        // Apply a release that arrived while we were starting up. Without this
        // a quick tap leaves a live recording with no control to end it.
        const pending = takePendingFinish()
        if (pending)
          finish(pending.cancelled)
      }
    }
  }, [recorder, config, clearTimer, halo, maxDurationMs, finish, releaseAudioSession, takePendingFinish])

  // Tear the recorder down with the component: without this the mic stays hot
  // (and the iOS recording indicator lit) after navigating away mid-recording,
  // and the toolbar is left showing a frozen recording bar.
  useEffect(() => () => {
    clearTimer()
    cancelAnimation(halo)
    startTokenRef.current = 0
    pendingFinishRef.current = null

    if (isRecordingRef.current) {
      isRecordingRef.current = false
      try {
        const stopped = recorder.stop() as unknown as Promise<void> | undefined
        stopped?.catch?.(() => {})
      } catch {
        // already stopped
      }
    }

    releaseAudioSession()
    onStateChange?.({ active: false, locked: false, elapsed: 0, cancelArmed: false })
  }, [clearTimer, halo, recorder, releaseAudioSession, onStateChange])

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
          // Locked: the finger is released but recording continues, so only the
          // drag offsets go home. `cancelArmed` / `lockProgress` are cleared by
          // `finish` via resetGesture, so nothing latches into the next take.
          if (lockedSV.value > 0) {
            translateX.value = withTiming(0, { duration: 150 })
            translateY.value = withTiming(0, { duration: 150 })
            cancelArmed.value = 0
            lockProgress.value = 0
            return
          }

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
            <ChevronIcon color={styles.lockColor.color} size={12} direction='up' />
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
