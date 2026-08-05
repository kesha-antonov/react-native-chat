import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useLabels } from '../hooks/useLabels'
import { useTheme } from '../hooks/useTheme'
import { IMessage, VideoRecordingProps } from '../Models'
import { Icon } from './Icon'
import { CameraIcon, CloseIcon, FlashIcon, FlipCameraIcon, PauseIcon, PlayIcon } from './MediaControls'
import { SendIcon } from './SendIcon'

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

// The preview fills most of the screen width, as Telegram's does.
const NOTE_WIDTH_RATIO = 0.88
const MAX_ROUND_SIZE = 360
/** Gap between the circle's edge and the progress arc. */
const RING_GAP = 10
const RING_STROKE = 3
/** Vertical space the bottom controls occupy, kept clear of the preview. */
const CONTROLS_HEIGHT = 170

const withFileScheme = (path: string) =>
  path.startsWith('file://') || path.startsWith('http') ? path : `file://${path}`

/**
 * `m:ss,t` with tenths, like Telegram's recording bar - the moving decimal is
 * what tells you the recorder is actually live.
 */
const formatElapsedTenths = (ms: number) => {
  const tenthsTotal = Math.floor(ms / 100)
  const tenths = tenthsTotal % 10
  const secs = Math.floor(tenthsTotal / 10) % 60
  const mins = Math.floor(tenthsTotal / 600)
  return `${mins}:${secs.toString().padStart(2, '0')},${tenths}`
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
  onToggleTorch,
  isTorchOn = false,
  onTogglePause,
  isPaused = false,
  cancelLabel,
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
  /** Omitted when the active camera has no torch (typically the front one). */
  onToggleTorch?: () => void
  isTorchOn?: boolean
  /** Omitted when the backend cannot pause mid-take. */
  onTogglePause?: () => void
  isPaused?: boolean
  /** Localized CANCEL label for the recording bar. */
  cancelLabel: string
  hint: string
  /** No camera / no permission: the shutter is inert instead of throwing. */
  isDisabled?: boolean
}) {
  const progress = Math.min(1, elapsed / maxMs)
  const { voice } = useTheme()
  // Telegram's preview is most of the screen width, not a fixed 220pt puck.
  const { width } = useWindowDimensions()
  const roundSize = Math.min(width * NOTE_WIDTH_RATIO, MAX_ROUND_SIZE)
  const ringRadius = roundSize / 2 + RING_GAP
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringBox = (ringRadius + RING_STROKE) * 2

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
      {/* Explicit close only. A tap-anywhere scrim would swallow the release of
          the very press that opened the recorder, closing it instantly. */}
      {!isRecording && (
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel='close'>
          <CloseIcon color='#fff' size={22} />
        </Pressable>
      )}

      <View style={[styles.ringWrapper, { width: ringBox, height: ringBox }]} pointerEvents='box-none'>
        {SvgCircle && progress > 0 && (
          <Svg width={ringBox} height={ringBox} style={StyleSheet.absoluteFill} pointerEvents='none'>
            {/* No track behind it: Telegram draws only the elapsed arc. */}
            <SvgCircle
              cx={ringBox / 2}
              cy={ringBox / 2}
              r={ringRadius}
              stroke='#FFFFFF'
              strokeWidth={RING_STROKE}
              fill='none'
              strokeLinecap='round'
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - progress)}
              transform={`rotate(-90 ${ringBox / 2} ${ringBox / 2})`}
            />
          </Svg>
        )}

        <View style={[styles.round, { width: roundSize, height: roundSize, borderRadius: roundSize / 2 }]}>
          {preview}
        </View>
      </View>

      <View style={styles.controls} pointerEvents='box-none'>
        <View style={styles.controlsRow} pointerEvents='box-none'>
          {/* Camera flip and torch share one pill on the left, as in Telegram.
              With neither available the pill would be an empty white blob. */}
          <View style={(onFlipCamera || onToggleTorch) ? styles.utilityPill : undefined}>
            {onFlipCamera && (
              <Pressable
                onPress={onFlipCamera}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityLabel='switch camera'
                style={styles.utilityButton}
              >
                <FlipCameraIcon color={styles.utilityColor.color} size={22} />
              </Pressable>
            )}
            {onToggleTorch && (
              <Pressable
                onPress={onToggleTorch}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityState={{ selected: isTorchOn }}
                accessibilityLabel='flash'
                style={styles.utilityButton}
              >
                <FlashIcon color={isTorchOn ? '#F5A623' : styles.utilityColor.color} size={22} />
              </Pressable>
            )}
          </View>

          {isRecording && onTogglePause && (
            <Pressable
              onPress={onTogglePause}
              accessibilityRole='button'
              accessibilityLabel={isPaused ? 'resume recording' : 'pause recording'}
              style={styles.pauseButton}
            >
              {isPaused
                ? <PlayIcon color={styles.utilityColor.color} size={16} />
                : <PauseIcon color={styles.utilityColor.color} size={16} />}
            </Pressable>
          )}
        </View>

        <View style={styles.bottomRow} pointerEvents='box-none'>
          {isRecording
            ? (
              <>
                <View style={styles.statusBar}>
                  <View style={styles.recDot} />
                  <Text style={styles.statusTime}>{formatElapsedTenths(elapsed)}</Text>
                  <Pressable
                    onPress={onCancel}
                    hitSlop={8}
                    accessibilityRole='button'
                    accessibilityLabel='cancel recording'
                    style={styles.cancelWrap}
                  >
                    <Text style={styles.cancelText}>{cancelLabel}</Text>
                  </Pressable>
                  {/* Balances the timer so CANCEL sits centred in the bar. */}
                  <View style={styles.statusSpacer} />
                </View>

                <Pressable
                  onPress={onStop}
                  accessibilityRole='button'
                  accessibilityLabel='send video message'
                  style={styles.sendButton}
                >
                  <SendIcon color='#fff' size={24} />
                </Pressable>
              </>
            )
            : (
              <View style={styles.shutterRow} pointerEvents='box-none'>
                <GestureDetector gesture={shutterGesture}>
                  <Animated.View
                    accessibilityRole='button'
                    accessibilityState={{ disabled: isDisabled }}
                    accessibilityLabel='start recording'
                    style={[
                      styles.recordButton,
                      isDisabled && styles.recordButtonDisabled,
                      isCancelArmed && styles.recordButtonCancelArmed,
                      shutterStyle,
                    ]}
                  >
                    <View style={styles.recordInner} />
                  </Animated.View>
                </GestureDetector>
                <Text style={styles.hint}>{hint}</Text>
              </View>
            )}
        </View>
      </View>
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

  // Pausing freezes the clock; resuming shifts the start point forward by the
  // paused span so the elapsed time still matches the recorded footage.
  const pausedAtRef = useRef(0)

  const pause = useCallback(() => {
    pausedAtRef.current = Date.now()
    clear()
  }, [clear])

  const resume = useCallback(() => {
    if (pausedAtRef.current > 0) {
      startedAtRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = 0
    }

    clear()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      if (ms >= maxMs)
        onMaxRef.current()
    }, 100)
  }, [clear, maxMs])

  return { elapsed, isRecording, begin, end, pause, resume }
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

  const { elapsed, isRecording, begin, end, pause, resume } = useRecordingTimer(maxMs, () => stopRef.current())

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
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

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

  const toggleTorch = useCallback(() => {
    setIsTorchOn(current => !current)
  }, [])

  // vision-camera exposes pause/resume only on some versions; probe the ref
  // rather than assume, so the control is hidden when it cannot work.
  const canPause = typeof cameraRef.current?.pauseRecording === 'function'

  const togglePause = useCallback(async () => {
    try {
      if (isPaused) {
        await cameraRef.current?.resumeRecording?.()
        setIsPaused(false)
        resume()
      } else {
        await cameraRef.current?.pauseRecording?.()
        setIsPaused(true)
        pause()
      }
    } catch (error) {
      config?.onError?.(error)
    }
  }, [isPaused, config, pause, resume])

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
      onToggleTorch={device?.hasTorch ? toggleTorch : undefined}
      isTorchOn={isTorchOn}
      onTogglePause={isRecording && canPause ? togglePause : undefined}
      isPaused={isPaused}
      cancelLabel={labels.cancel}
      hint={hint}
      preview={
        !device
          ? <Text style={styles.placeholderText}>{labels.noCamera}</Text>
          : hasPermission
            ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive
                video
                audio={microphone.hasPermission}
                torch={isTorchOn ? 'on' : 'off'}
              />
            )
            : <Text style={styles.placeholderText}>{labels.cameraPermission}</Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  // Dim, not black: Telegram keeps the conversation visible behind the recorder.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve the control strip so the circle centres in the space above it
    // rather than sitting under the shutter and the status bar.
    paddingBottom: CONTROLS_HEIGHT,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
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
  // Everything below the circle, pinned to the bottom of the screen.
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // White pill holding the flip / flash controls.
  utilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  utilityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityColor: {
    color: '#1C1C1E',
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Red dot + tenths timer + centred CANCEL, in one white bar.
  statusBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  statusTime: {
    width: 56,
    fontSize: 15,
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  cancelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#3390EC',
  },
  // Mirrors `statusTime` so CANCEL is centred against the bar, not the free space.
  statusSpacer: {
    width: 56,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3390EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pre-recording state: the hold-to-record shutter and its hint.
  shutterRow: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  recordButton: {
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
  recordButtonDisabled: {
    opacity: 0.4,
  },
  // Slid past the cancel threshold: the shutter reads as destructive.
  recordButtonCancelArmed: {
    borderColor: '#E74C3C',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
