import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { useTheme } from '../hooks/useTheme'
import { IMessage, VideoRecordingProps } from '../Models'
import { Icon } from './Icon'
import { CameraIcon, CloseIcon, TrashIcon } from './MediaControls'

// Optional camera. Resolved through a try/catch require so the bundle works
// whether or not the consumer installed `react-native-vision-camera`.
let visionCamera: any = null
try {
  visionCamera = require('react-native-vision-camera')
} catch {
  visionCamera = null
}

// Optional SVG, used to draw the circular progress ring around the note. When
// absent the recorder still works, just without the ring.
let Svg: any = null
let SvgCircle: any = null
try {
  const svg = require('react-native-svg')
  Svg = svg.Svg ?? svg.default
  SvgCircle = svg.Circle
} catch {
  Svg = null
  SvgCircle = null
}

export const isVisionCameraAvailable = !!visionCamera?.Camera

// Whether the native vision-camera module is actually linked into the running
// binary. The JS package can be installed while the native module is not built
// in (e.g. a simulator running a binary compiled before the dependency was
// added). `getAvailableCameraDevices()` throws in that case, so we probe it
// once, outside of render, and fall back to the POC recorder when it fails.
export const isVisionCameraNativeReady = (() => {
  if (!visionCamera?.Camera?.getAvailableCameraDevices)
    return false
  try {
    visionCamera.Camera.getAvailableCameraDevices()
    return true
  } catch {
    return false
  }
})()

const ROUND_SIZE = 220
// Matches the chat accent; the recorder is a full-bleed dark overlay, so it does
// not take the rest of its palette from the theme.
const RING_COLOR = '#3390EC'
const RING_STROKE = 4
const RING_RADIUS = ROUND_SIZE / 2 + 6
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_BOX = (RING_RADIUS + RING_STROKE) * 2

const withFileScheme = (path: string) =>
  path.startsWith('file://') || path.startsWith('http') ? path : `file://${path}`

const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export interface VideoNoteRecorderProps<TMessage extends IMessage = IMessage> {
  config?: VideoRecordingProps
  onClose: () => void
  onSend?: (
    message: Partial<TMessage>,
    shouldResetInputToolbar: boolean
  ) => void
}

/**
 * Telegram-style round video note recorder: records the front camera into a
 * circular preview. When react-native-vision-camera's native module is missing
 * (a simulator, or a binary built before the dependency was added) it shows an
 * unavailable state with the shutter disabled rather than fabricating a note.
 * The two paths are separate components so the vision-camera hooks are only ever
 * called when the native module is present (no crash, stable hook order).
 */
export function VideoNoteRecorder<TMessage extends IMessage = IMessage> (
  props: VideoNoteRecorderProps<TMessage>
) {
  return isVisionCameraNativeReady
    ? <LiveVideoNote<TMessage> {...props} />
    : <UnavailableVideoNote onClose={props.onClose} />
}

/**
 * Shared recorder UI: round preview + progress ring + timer + shutter.
 *
 * The shutter is hold-to-record, with the same three-way gesture as a voice
 * note - release to send, slide up to lock for hands-free, slide left to
 * cancel - so the muscle memory carries over between the two recorders.
 */
function RecorderChrome ({
  preview,
  elapsed,
  maxMs,
  isRecording,
  isLocked,
  onStart,
  onStop,
  onCancel,
  onLock,
  onClose,
  onFlipCamera,
  hint,
  isDisabled = false,
}: {
  preview: React.ReactNode
  elapsed: number
  maxMs: number
  isRecording: boolean
  isLocked: boolean
  onStart: () => void
  onStop: () => void
  onCancel: () => void
  /** Slid past the lock threshold: recording continues after the finger lifts. */
  onLock: () => void
  onClose: () => void
  /** Omitted when there is no second camera to switch to. */
  onFlipCamera?: () => void
  hint: string
  /** No camera / no permission: the shutter is inert instead of throwing. */
  isDisabled?: boolean
}) {
  const progress = Math.min(1, elapsed / maxMs)
  const { voice } = useTheme()

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const cancelArmed = useSharedValue(0)
  const lockedSV = useSharedValue(0)
  const [isCancelArmed, setIsCancelArmed] = useState(false)

  const cancelThreshold = voice.cancelThreshold
  const lockThreshold = voice.lockThreshold

  // Keep the shared lock flag in step when the parent locks or resets.
  useEffect(() => {
    lockedSV.value = isLocked ? 1 : 0
    if (!isRecording) {
      translateX.value = 0
      translateY.value = 0
      cancelArmed.value = 0
      setIsCancelArmed(false)
    }
  }, [isLocked, isRecording, lockedSV, translateX, translateY, cancelArmed])

  const shutterGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isDisabled)
        .onBegin(() => {
          if (lockedSV.value > 0)
            return

          runOnJS(onStart)()
        })
        .onUpdate(event => {
          if (lockedSV.value > 0)
            return

          const x = Math.max(-(cancelThreshold + 60), Math.min(0, event.translationX))
          const y = Math.max(-(lockThreshold + 12), Math.min(0, event.translationY))
          translateX.value = x
          translateY.value = y

          const armed = x <= -cancelThreshold ? 1 : 0
          if (armed !== cancelArmed.value) {
            cancelArmed.value = armed
            runOnJS(setIsCancelArmed)(armed > 0)
          }

          if (-y >= lockThreshold) {
            lockedSV.value = 1
            translateX.value = withTiming(0, { duration: 150 })
            translateY.value = withTiming(0, { duration: 150 })
            runOnJS(onLock)()
          }
        })
        .onFinalize(() => {
          // Locked: the finger lifts but recording continues.
          if (lockedSV.value > 0) {
            translateX.value = withTiming(0, { duration: 150 })
            translateY.value = withTiming(0, { duration: 150 })
            cancelArmed.value = 0
            return
          }

          const cancelled = cancelArmed.value > 0
          translateX.value = withTiming(0, { duration: 150 })
          translateY.value = withTiming(0, { duration: 150 })
          cancelArmed.value = 0
          runOnJS(cancelled ? onCancel : onStop)()
        }),
    [isDisabled, onStart, onStop, onCancel, onLock, translateX, translateY, cancelArmed, lockedSV, cancelThreshold, lockThreshold]
  )

  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }))

  return (
    <View style={styles.overlay}>
      <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel='close'>
        <Icon name='close' color='#fff' size={22} fallback={<CloseIcon color='#fff' size={22} />} />
      </Pressable>

      {onFlipCamera && (
        <Pressable onPress={onFlipCamera} style={styles.flipButton} accessibilityLabel='switch camera'>
          <Icon name='camera' color='#fff' size={22} fallback={<CameraIcon color='#fff' size={22} />} />
        </Pressable>
      )}

      <View style={styles.ringWrapper}>
        {SvgCircle && (
          <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill} pointerEvents='none'>
            <SvgCircle cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_RADIUS} stroke='rgba(255,255,255,0.25)' strokeWidth={RING_STROKE} fill='none' />
            <SvgCircle
              cx={RING_BOX / 2}
              cy={RING_BOX / 2}
              r={RING_RADIUS}
              stroke={RING_COLOR}
              strokeWidth={RING_STROKE}
              fill='none'
              strokeLinecap='round'
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
            />
          </Svg>
        )}

        <View style={styles.round}>{preview}</View>
      </View>

      <Text style={styles.timer}>{formatElapsed(elapsed)} / {formatElapsed(maxMs)}</Text>

      <View style={styles.shutterRow}>
        {isLocked && (
          <Pressable
            onPress={onCancel}
            accessibilityRole='button'
            accessibilityLabel='delete recording'
            style={styles.sideButton}
          >
            <Icon name='trash' color='#fff' size={22} fallback={<TrashIcon color='#fff' size={22} />} />
          </Pressable>
        )}

        {isLocked
          ? (
            <Pressable
              onPress={onStop}
              accessibilityRole='button'
              accessibilityLabel='stop recording'
              style={styles.recordButton}
            >
              <View style={styles.recordInnerStop} />
            </Pressable>
          )
          : (
            <GestureDetector gesture={shutterGesture}>
              <Animated.View
                accessibilityRole='button'
                accessibilityState={{ disabled: isDisabled }}
                accessibilityLabel={isRecording ? 'stop recording' : 'start recording'}
                style={[
                  styles.recordButton,
                  isDisabled && styles.recordButtonDisabled,
                  isCancelArmed && styles.recordButtonCancelArmed,
                  shutterStyle,
                ]}
              >
                <View style={isRecording ? styles.recordInnerStop : styles.recordInner} />
              </Animated.View>
            </GestureDetector>
          )}
      </View>

      <Text style={styles.hint}>{hint}</Text>
    </View>
  )
}

/** Reusable elapsed-time ticker that auto-stops at `maxMs`. */
function useRecordingTimer (maxMs: number, onMax: () => void) {
  const [elapsed, setElapsed] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onMaxRef = useRef(onMax)
  onMaxRef.current = onMax

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  const begin = useCallback(() => {
    startedAtRef.current = Date.now()
    setElapsed(0)
    setIsRecording(true)
    clear()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      if (ms >= maxMs)
        onMaxRef.current()
    }, 100)
  }, [clear, maxMs])

  const end = useCallback(() => {
    clear()
    setIsRecording(false)
  }, [clear])

  return { elapsed, isRecording, begin, end }
}

/**
 * No native camera module: an honest dead-end. The shutter is visibly disabled
 * and nothing can be sent - previously this path fabricated a note from a
 * hardcoded remote sample clip.
 */
function UnavailableVideoNote ({ onClose }: { onClose: () => void }) {
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

/** Real path: front camera into the round preview (only when native is ready). */
function LiveVideoNote<TMessage extends IMessage = IMessage> ({
  config,
  onClose,
  onSend,
}: VideoNoteRecorderProps<TMessage>) {
  const labels = useLabels()
  const Camera = visionCamera.Camera
  // Telegram lets you flip to the rear camera; a note starts on the front one.
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const device = visionCamera.useCameraDevice(facing)
  const otherDevice = visionCamera.useCameraDevice(facing === 'front' ? 'back' : 'front')
  const { hasPermission, requestPermission } = visionCamera.useCameraPermission()
  const microphone = visionCamera.useMicrophonePermission?.() ?? { hasPermission: true, requestPermission: async () => true }

  const cameraRef = useRef<any>(null)
  const maxMs = (config?.maxDuration ?? 60) * 1000
  const minDurationMs = config?.minDurationMs ?? 800
  const startedAtRef = useRef(0)
  // Set once the user abandons the recorder, so a capture callback that lands
  // afterwards discards its file instead of posting the note they cancelled.
  const abortedRef = useRef(false)

  const micHasPermission = microphone.hasPermission
  const micRequestPermission = microphone.requestPermission

  useEffect(() => {
    if (!hasPermission)
      requestPermission?.()
    if (!micHasPermission)
      micRequestPermission?.()
  }, [hasPermission, requestPermission, micHasPermission, micRequestPermission])

  // A permission the user actively refused should surface, not leave a dead UI.
  const onPermissionDenied = config?.onPermissionDenied
  useEffect(() => {
    if (hasPermission === false)
      onPermissionDenied?.()
  }, [hasPermission, onPermissionDenied])

  const finish = useCallback((uri: string | null) => {
    const duration = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0

    if (uri && !abortedRef.current && duration >= minDurationMs)
      onSend?.({
        video: uri,
        videoNote: true,
        duration: Math.round(duration / 1000),
      } as Partial<TMessage>, false)

    startedAtRef.current = 0
    onClose()
  }, [onSend, onClose, minDurationMs])

  const stopRef = useRef<() => void>(() => {})

  const { elapsed, isRecording, begin, end } = useRecordingTimer(maxMs, () => stopRef.current())

  const stopRecording = useCallback(async () => {
    end()
    try {
      await cameraRef.current?.stopRecording?.()
    } catch (error) {
      config?.onError?.(error)
      finish(null)
    }
  }, [end, config, finish])
  stopRef.current = stopRecording

  // The camera is only usable with both a device and permission; without this
  // the shutter called startRecording on a null ref, threw, and silently
  // dismissed the whole sheet.
  const canRecord = !!device && hasPermission === true

  const startRecording = useCallback(() => {
    if (!canRecord)
      return

    begin()
    startedAtRef.current = Date.now()
    try {
      cameraRef.current.startRecording({
        onRecordingFinished: (video: { path: string }) => finish(withFileScheme(video.path)),
        onRecordingError: (error: unknown) => {
          config?.onError?.(error)
          finish(null)
        },
      })
    } catch (error) {
      config?.onError?.(error)
      finish(null)
    }
  }, [begin, finish, config, canRecord])

  // Abandoning the recorder must stop the capture: otherwise vision-camera keeps
  // recording into an orphaned file and its completion callback posts the note.
  const abort = useCallback(() => {
    abortedRef.current = true
    end()
    try {
      const stopped = cameraRef.current?.stopRecording?.() as Promise<void> | undefined
      stopped?.catch?.(() => {})
    } catch {
      // nothing was recording
    }
    onClose()
  }, [end, onClose])

  // Covers teardown routes that bypass the X button (Android hardware back,
  // a parent closing the modal): mark aborted and stop the capture.
  useEffect(() => () => {
    abortedRef.current = true
    try {
      const stopped = cameraRef.current?.stopRecording?.() as Promise<void> | undefined
      stopped?.catch?.(() => {})
    } catch {
      // nothing was recording
    }
  }, [])

  // Locking mirrors the voice recorder: slide up while holding the shutter and
  // recording continues hands-free until Send or the trash is pressed.
  const [isLocked, setIsLocked] = useState(false)

  const onShutterStart = useCallback(() => {
    if (isRecording)
      return

    startRecording()
  }, [isRecording, startRecording])

  const onShutterStop = useCallback(() => {
    setIsLocked(false)
    stopRecording()
  }, [stopRecording])

  const onShutterCancel = useCallback(() => {
    setIsLocked(false)
    abortedRef.current = true
    end()
    try {
      const stopped = cameraRef.current?.stopRecording?.() as Promise<void> | undefined
      stopped?.catch?.(() => {})
    } catch {
      // nothing was recording
    }
    // Reset so the recorder stays open for another take, as Telegram does.
    abortedRef.current = false
    startedAtRef.current = 0
  }, [end])

  const flipCamera = useCallback(() => {
    setFacing(current => (current === 'front' ? 'back' : 'front'))
  }, [])

  const hint = !canRecord
    ? (device ? labels.cameraPermission : labels.noCamera)
    : isLocked
      ? labels.stopAndSend
      : isRecording
        ? labels.releaseToSend
        : labels.holdToRecord

  return (
    <RecorderChrome
      elapsed={elapsed}
      maxMs={maxMs}
      isRecording={isRecording}
      isLocked={isLocked}
      isDisabled={!canRecord}
      onStart={onShutterStart}
      onStop={onShutterStop}
      onCancel={onShutterCancel}
      onLock={() => setIsLocked(true)}
      onClose={abort}
      onFlipCamera={otherDevice ? flipCamera : undefined}
      hint={hint}
      preview={
        !device
          ? <Text style={styles.placeholderText}>{labels.noCamera}</Text>
          : hasPermission
            ? <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive video audio={microphone.hasPermission} />
            : <Text style={styles.placeholderText}>{labels.cameraPermission}</Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrapper: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    width: ROUND_SIZE,
    height: ROUND_SIZE,
    borderRadius: ROUND_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  recordButtonDisabled: {
    opacity: 0.4,
  },
  // Slid past the cancel threshold: the shutter reads as destructive.
  recordButtonCancelArmed: {
    borderColor: '#E74C3C',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    fontVariant: ['tabular-nums'],
  },
  recordButton: {
    marginTop: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E74C3C',
  },
  recordInnerStop: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
})
