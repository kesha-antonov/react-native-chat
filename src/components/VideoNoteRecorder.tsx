import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useLabels } from '../hooks/useLabels'
import { IMessage, VideoRecordingProps } from '../Models'
import { Icon } from './Icon'
import { CameraIcon, CloseIcon } from './MediaControls'

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

// A short, public sample MP4 used for the simulator POC (no real camera there),
// so the record -> send flow can be demonstrated end to end.
const POC_SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

const ROUND_SIZE = 220
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
 * Telegram-style round video note recorder. When react-native-vision-camera is
 * natively available it records the front camera into a circular preview;
 * otherwise (simulator / binary built without the native module) it runs a POC
 * that records a mock note and sends a sample clip, so the flow is demonstrable.
 * The two paths are separate components so the vision-camera hooks are only ever
 * called when the native module is present (no crash, stable hook order).
 */
export function VideoNoteRecorder<TMessage extends IMessage = IMessage> (
  props: VideoNoteRecorderProps<TMessage>
) {
  return isVisionCameraNativeReady
    ? <LiveVideoNote<TMessage> {...props} />
    : <PocVideoNote<TMessage> {...props} />
}

/** Shared recorder UI: round preview + progress ring + timer + record button. */
function RecorderChrome ({
  preview,
  elapsed,
  maxMs,
  isRecording,
  onToggle,
  onClose,
  hint,
}: {
  preview: React.ReactNode
  elapsed: number
  maxMs: number
  isRecording: boolean
  onToggle: () => void
  onClose: () => void
  hint: string
}) {
  const progress = Math.min(1, elapsed / maxMs)

  return (
    <View style={styles.overlay}>
      <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel='close'>
        <Icon name='close' color='#fff' size={22} fallback={<CloseIcon color='#fff' size={22} />} />
      </Pressable>

      <View style={styles.ringWrapper}>
        {SvgCircle && (
          <Svg width={RING_BOX} height={RING_BOX} style={StyleSheet.absoluteFill} pointerEvents='none'>
            <SvgCircle cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_RADIUS} stroke='rgba(255,255,255,0.25)' strokeWidth={RING_STROKE} fill='none' />
            <SvgCircle
              cx={RING_BOX / 2}
              cy={RING_BOX / 2}
              r={RING_RADIUS}
              stroke='#3390EC'
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

      <Pressable
        onPress={onToggle}
        accessibilityRole='button'
        accessibilityLabel={isRecording ? 'stop recording' : 'start recording'}
        style={styles.recordButton}
      >
        <View style={isRecording ? styles.recordInnerStop : styles.recordInner} />
      </Pressable>

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

/** Simulator / no-native-module path: mock recording, sends a sample clip. */
function PocVideoNote<TMessage extends IMessage = IMessage> ({
  config,
  onClose,
  onSend,
}: VideoNoteRecorderProps<TMessage>) {
  const labels = useLabels()
  const maxMs = (config?.maxDuration ?? 60) * 1000

  const finish = useCallback(() => {
    onSend?.({ video: POC_SAMPLE_VIDEO, videoNote: true } as Partial<TMessage>, false)
    onClose()
  }, [onSend, onClose])

  const { elapsed, isRecording, begin, end } = useRecordingTimer(maxMs, () => {
    end()
    finish()
  })

  const onToggle = useCallback(() => {
    if (isRecording) {
      end()
      finish()
    } else {
      begin()
    }
  }, [isRecording, begin, end, finish])

  return (
    <RecorderChrome
      elapsed={elapsed}
      maxMs={maxMs}
      isRecording={isRecording}
      onToggle={onToggle}
      onClose={onClose}
      hint={isRecording ? labels.cancel : labels.videoMessage}
      preview={(
        <View style={styles.placeholder}>
          <Icon name='camera' color='rgba(255,255,255,0.6)' size={44} fallback={<CameraIcon color='rgba(255,255,255,0.6)' size={44} />} />
          <Text style={styles.placeholderText}>{labels.noCamera}</Text>
          <Text style={styles.pocBadge}>POC preview</Text>
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
  const device = visionCamera.useCameraDevice('front')
  const { hasPermission, requestPermission } = visionCamera.useCameraPermission()
  const microphone = visionCamera.useMicrophonePermission?.() ?? { hasPermission: true, requestPermission: async () => true }

  const cameraRef = useRef<any>(null)
  const maxMs = (config?.maxDuration ?? 60) * 1000

  const micHasPermission = microphone.hasPermission
  const micRequestPermission = microphone.requestPermission

  useEffect(() => {
    if (!hasPermission)
      requestPermission?.()
    if (!micHasPermission)
      micRequestPermission?.()
  }, [hasPermission, requestPermission, micHasPermission, micRequestPermission])

  const finish = useCallback((uri: string | null) => {
    if (uri)
      onSend?.({ video: uri, videoNote: true } as Partial<TMessage>, false)
    onClose()
  }, [onSend, onClose])

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

  const startRecording = useCallback(() => {
    begin()
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
  }, [begin, finish, config])

  return (
    <RecorderChrome
      elapsed={elapsed}
      maxMs={maxMs}
      isRecording={isRecording}
      onToggle={isRecording ? stopRecording : startRecording}
      onClose={onClose}
      hint={isRecording ? labels.cancel : labels.videoMessage}
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
  pocBadge: {
    marginTop: 4,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.5,
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
