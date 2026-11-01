import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureDetector, usePinchGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useColorScheme } from '../hooks/useColorScheme'
import { useLabels } from '../hooks/useLabels'
import { useTheme } from '../hooks/useTheme'
import { IMessage, VideoRecordingProps } from '../Models'
import { getExpoBlur, getExpoVideo, getSvg } from '../optional'
import { FlashIcon, FlipCameraIcon } from './MediaControls'
import { stopAllPlayback } from './mediaPlayback'
import { RecordButtonPhase } from './RecordButton'
import { recordingHaptic } from './recordingFeedback'
import {
  ROUND_FLIGHT_FADE_MS,
  ROUND_FLIGHT_MS,
  SEND_FLIGHT_WAIT_MS,
  abandonSendFlight,
  easeDefault,
  easeOutQuint,
  expectSendFlight,
  finishSendFlight,
  onSendFlightTarget,
} from './sendFlight'
import { SpeakerIcon } from './VideoNoteOverlay'
import {
  VideoNoteRecorderController,
  createVideoNoteRecorder,
  getCameraPermissionStatus,
  getMicrophonePermissionStatus,
  getVisionCamera,
  isVisionCameraAvailable,
  requestCameraPermission,
  requestMicrophonePermission,
} from './visionCamera'

// Optional player for the paused take's preview.
const expoVideo = getExpoVideo()

const canPreview = !!(expoVideo?.VideoView && expoVideo?.useVideoPlayer)

// Optional blur for the layer behind the circle; without it a plain dim stands
// in for the blurred chat.
const BlurView = getExpoBlur()?.BlurView ?? null

// Optional SVG for the progress ring; without it the note still records.
const svg = getSvg()
const Svg: any = svg ? svg.Svg ?? svg.default : null
const SvgCircle: any = svg?.Circle ?? null

const MAX_ROUND_SIZE = 360
const RING_GAP = 8
const RING_STROKE = 3
/** If the capture never reports back after a stop, give up and close. */
const FINISH_TIMEOUT_MS = 5000
/**
 * How long to wait for a camera to show up before giving up. On Android the
 * device list arrives asynchronously, so it can be empty on the first render.
 */
const NO_CAMERA_TIMEOUT_MS = 2000
/** A round take shorter than 800ms is dropped. */
const DEFAULT_MIN_DURATION_MS = 800
/**
 * A round take stops 0.5s before its 60s limit, into the preview rather than sending it.
 */
const LIMIT_LEAD_MS = 500
/** The pause button is hidden in the last second (`millisecondsRecorded >= 59_000`). */
const PAUSE_HIDE_LEAD_MS = 1000
/** How long the pinch zoom takes to spring back (`finishZoom`). */
const ZOOM_RESET_MS = 200
/** The circle opens and closes in 180ms. */
const ROUND_ANIMATION_MS = 180
/**
 * The blurred layer behind it fades over 520ms, EASE_OUT_QUINT.
 */
const DIM_ANIMATION_MS = 520
/** That layer is drawn at alpha 232 of 255. */
const BLUR_LAYER_ALPHA = 232 / 255
/**
 * The layer is the navbar background: the chat blurred under the
 * navbar's own colour. A strong blur with the bar colour washed over it gets
 * closest to that.
 */
const BLUR_INTENSITY = 60
const BLUR_WASH_ALPHA = 0.55
/**
 * A sent take's overlay waits for its message, flies there and crossfades, so
 * it stays up for all of that, with room to spare.
 */
const FLIGHT_CLOSE_MS = SEND_FLIGHT_WAIT_MS + ROUND_FLIGHT_MS + ROUND_FLIGHT_FADE_MS + 200
/** A take longer than this flies off towards the left edge as it closes (`recordedTime > 300`). */
const SLIDE_OUT_MIN_MS = 300
/** The closed circle ends 24dp from the left edge. */
const SLIDE_OUT_INSET = 24
/** The camera flip: rotate out to 90deg, switch, rotate back in from -90deg. */
const FLIP_MS = 580

/** Decelerate and ease-out-quint curves. */
const DECELERATE = Easing.out(Easing.quad)
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)

const withFileScheme = (path: string) =>
  path.startsWith('file://') || path.startsWith('http') ? path : `file://${path}`

type Phase = 'idle' | 'preparing' | 'recording' | 'stopping' | 'preview' | 'finishing'

/** What the composer needs to drive and draw a round video note take. */
export interface VideoNoteSession {
  /** A take is starting, recording or in preview, so the toolbar shows its bar. */
  isActive: boolean
  isLocked: boolean
  /** The camera is actually recording, not just opening. */
  isCapturing: boolean
  elapsed: number
  /** The record button's state for this take. */
  buttonPhase: RecordButtonPhase
  /** Set while a paused take plays back for review. */
  preview: { durationMs: number } | null
  /** Finger went down on the control: open the camera and record. */
  start: () => void
  /** Finger lifted (`cancelled` when slid to cancel), or Send / CANCEL pressed. */
  finish: (cancelled: boolean) => void
  /** Slid up past the lock threshold: keep recording hands-free. */
  lock: () => void
  /** Locked: stop into the preview. Undefined when there is no player for it. */
  pause?: () => void
  /** Send the take, recording or previewed. */
  send: () => void
  /** The take goes out as view-once (`voiceOnce`). */
  isViewOnce: boolean
  /** Flips `isViewOnce`; undefined unless `videoRecording.isViewOnceEnabled`. */
  toggleViewOnce?: () => void
  /** The camera, or the preview, to draw over the message list; null when idle. */
  overlay: React.ReactNode
}

/**
 * The round video note take, driven by the composer's own record
 * button: hold to record, release to send, slide left to cancel, slide up to
 * lock. The camera opens
 * under the finger and starts recording as soon as it is initialized. A
 * locked take can be paused into a looping preview, and the time limit stops
 * into that preview instead of sending.
 *
 * Only used when vision-camera's native module is linked; the system-camera
 * fallback keeps its tap-to-open button.
 */
export function useVideoNoteSession<TMessage extends IMessage = IMessage> ({
  config,
  onSend,
}: {
  config?: VideoRecordingProps
  onSend?: (message: Partial<TMessage>, shouldResetInputToolbar: boolean) => void
}): VideoNoteSession {
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isFlashOn, setIsFlashOn] = useState(false)
  // A note starts on the front camera.
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  // View-once: off at the start of every take, read on send.
  const [isViewOnce, setIsViewOnce] = useState(false)
  const isViewOnceRef = useRef(false)
  isViewOnceRef.current = isViewOnce
  // After a take ends, the overlay stays up a moment longer so the circle can
  // close and the dim fade out.
  const [closing, setClosing] = useState<{
    kind: 'capture' | 'preview'
    isSlideOut: boolean
    uri: string | null
    /** Sent: the circle flies into the new note instead of closing. */
    isFlight: boolean
  } | null>(null)

  const phaseRef = useRef<Phase>('idle')
  const cameraRef = useRef<VideoNoteRecorderController | null>(null)
  const startedAtRef = useRef(0)
  const durationRef = useRef(0)
  // Set when a take is cancelled, so a capture callback that lands afterwards
  // drops its file instead of posting the note.
  const abortedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewUriRef = useRef<string | null>(null)
  previewUriRef.current = previewUri
  // The ring's last share, held while the circle closes.
  const lastProgressRef = useRef(0)
  const configRef = useRef(config)
  configRef.current = config
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend

  const maxMs = (config?.maxDuration ?? 60) * 1000
  const minDurationMs = config?.minDurationMs ?? DEFAULT_MIN_DURATION_MS

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current)
      finishTimeoutRef.current = null
    }
  }, [])

  const close = useCallback((isFlight = false) => {
    const was = phaseRef.current
    if (was !== 'idle') {
      const recordedMs = was === 'recording'
        ? Date.now() - startedAtRef.current
        : was === 'preparing' ? 0 : durationRef.current
      if (closingTimerRef.current)
        clearTimeout(closingTimerRef.current)
      setClosing({
        kind: was === 'preview' && previewUriRef.current ? 'preview' : 'capture',
        isSlideOut: recordedMs > SLIDE_OUT_MIN_MS,
        uri: previewUriRef.current,
        isFlight,
      })
      closingTimerRef.current = setTimeout(() => {
        closingTimerRef.current = null
        setClosing(null)
      }, isFlight ? FLIGHT_CLOSE_MS : DIM_ANIMATION_MS)
    }

    clearTimers()
    startedAtRef.current = 0
    setPhase('idle')
    setIsLocked(false)
    setElapsed(0)
    setIsFlashOn(false)
    setPreviewUri(null)
  }, [clearTimers, setPhase])

  const stopCapture = useCallback(() => {
    cameraRef.current?.stopRecording().catch(() => {})
  }, [])

  const sendVideo = useCallback((uri: string) => {
    // Before `onSend`, which is what adds the note the circle flies into.
    expectSendFlight('round')
    onSendRef.current?.({
      video: uri,
      videoNote: true,
      duration: Math.round(durationRef.current / 1000),
      ...(isViewOnceRef.current ? { isViewOnce: true } : null),
    } as Partial<TMessage>, false)
  }, [])

  /**
   * Ends a recording take. `send` keeps the camera up until the file is
   * written, then sends it; `preview` waits for the same file and plays it
   * back; `cancel` drops it at once.
   */
  const stopTake = useCallback((outcome: 'send' | 'cancel' | 'preview') => {
    const current = phaseRef.current

    // Released before the camera was up: nothing was recorded, so this is a
    // take that was too short, the same as a quick tap on the button.
    if (current === 'preparing') {
      close()
      if (outcome !== 'cancel')
        configRef.current?.onTooShort?.()
      return
    }

    if (current !== 'recording')
      return

    const duration = Date.now() - startedAtRef.current
    const isTooShort = duration < minDurationMs

    if (outcome === 'cancel' || isTooShort) {
      // Cancel closes the camera.
      abortedRef.current = true
      stopCapture()
      close()
      if (outcome !== 'cancel')
        configRef.current?.onTooShort?.()
      return
    }

    durationRef.current = duration
    clearTimers()
    setPhase(outcome === 'preview' ? 'stopping' : 'finishing')
    stopCapture()
    finishTimeoutRef.current = setTimeout(() => close(), FINISH_TIMEOUT_MS)
  }, [close, clearTimers, setPhase, stopCapture, minDurationMs])

  const stopTakeRef = useRef(stopTake)
  stopTakeRef.current = stopTake

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle' || !isVisionCameraAvailable)
      return

    // Recording takes the audio over: pause whatever note is
    // playing so it does not end up in the take.
    stopAllPlayback()

    const hasCamera = getCameraPermissionStatus() === 'authorized'
    const hasMicrophone = getMicrophonePermissionStatus() === 'authorized'

    // The permission prompt takes the finger off the button anyway, so ask and
    // stop here; the next hold records.
    if (!hasCamera || !hasMicrophone) {
      ;(async () => {
        try {
          const camera = hasCamera || await requestCameraPermission()
          const mic = hasMicrophone || await requestMicrophonePermission()
          if (!camera || !mic)
            configRef.current?.onPermissionDenied?.()
        } catch (error) {
          configRef.current?.onError?.(error)
        }
      })()
      return
    }

    abortedRef.current = false
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current)
      closingTimerRef.current = null
    }
    setClosing(null)
    // Reset here rather than on close, so the closing circle does not flip.
    setFacing('front')
    setIsViewOnce(false)
    lastProgressRef.current = 0
    setPhase('preparing')
  }, [setPhase])

  // The overlay's camera is ready: start the take. A flip mid-take
  // re-initializes the camera too, which this ignores.
  const onCameraReady = useCallback(() => {
    if (phaseRef.current !== 'preparing')
      return

    const recorder = cameraRef.current
    if (!recorder) {
      close()
      return
    }

    try {
      recorder.startRecording({
        onRecordingFinished: (video: { path: string }) => {
          if (abortedRef.current)
            return

          const uri = withFileScheme(video.path)
          if (phaseRef.current === 'stopping') {
            clearTimers()
            setPreviewUri(uri)
            setPhase('preview')
            return
          }

          sendVideo(uri)
          close(true)
        },
        onRecordingError: (error: unknown) => {
          if (!abortedRef.current)
            configRef.current?.onError?.(error)

          close()
        },
      })
    } catch (error) {
      configRef.current?.onError?.(error)
      close()
      return
    }

    // Tick when the round take actually starts recording.
    recordingHaptic()
    startedAtRef.current = Date.now()
    setElapsed(0)
    setPhase('recording')
    clearTimers()
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      // Out of time: stop into the preview, or send without a player for it.
      if (ms >= maxMs - LIMIT_LEAD_MS)
        stopTakeRef.current(canPreview ? 'preview' : 'send')
    }, 100)
  }, [close, clearTimers, setPhase, maxMs, sendVideo])

  const onCameraError = useCallback((error: unknown) => {
    abortedRef.current = true
    configRef.current?.onError?.(error)
    stopCapture()
    close()
  }, [close, stopCapture])

  const lock = useCallback(() => {
    if (phaseRef.current === 'preparing' || phaseRef.current === 'recording')
      setIsLocked(true)
  }, [])

  const finish = useCallback((cancelled: boolean) => {
    if (phaseRef.current === 'preview') {
      const isSent = !cancelled && !!previewUri
      if (isSent)
        sendVideo(previewUri)

      close(isSent)
      return
    }

    stopTake(cancelled ? 'cancel' : 'send')
  }, [stopTake, previewUri, sendVideo, close])

  const send = useCallback(() => finish(false), [finish])
  const pause = useCallback(() => stopTake('preview'), [stopTake])

  // Leaving the chat mid-take must not leave the camera recording into an
  // orphaned file.
  useEffect(() => () => {
    clearTimers()
    if (closingTimerRef.current)
      clearTimeout(closingTimerRef.current)
    if (phaseRef.current !== 'idle') {
      abortedRef.current = true
      cameraRef.current?.stopRecording().catch(() => {})
    }
  }, [clearTimers])

  const toggleViewOnce = useCallback(() => {
    setIsViewOnce(current => !current)
  }, [])

  const toggleFlash = useCallback(() => {
    setIsFlashOn(current => !current)
  }, [])

  // Flipping the camera works mid-take, thanks to
  // vision-camera's persistent recorder (`enablePersistentRecorder` below):
  // Android records with CameraX's persistent recording, which survives the
  // camera being rebound, and iOS keeps appending the new camera's frames to
  // the same asset writer.
  const flipCamera = useCallback(() => {
    setFacing(current => (current === 'front' ? 'back' : 'front'))
  }, [])

  const isRecording = phase === 'recording'
  const isClosing = phase === 'idle' && !!closing

  let progress = lastProgressRef.current
  if (isRecording)
    progress = Math.min(1, elapsed / maxMs)
  else if (phase === 'preparing')
    progress = 0
  else if (phase !== 'idle')
    progress = 1
  lastProgressRef.current = progress

  const overlayKind = phase === 'idle'
    ? closing?.kind ?? null
    : phase === 'preview' && previewUri ? 'preview' : 'capture'
  const overlayUri = previewUri ?? closing?.uri ?? null

  const overlay = !overlayKind
    ? null
    : (
      // One stage across capture -> preview -> closed, so the dim fades in
      // once and out once.
      <VideoNoteStage isClosing={isClosing}>
        {overlayKind === 'preview' && overlayUri
          ? (
            <VideoNotePreviewView
              uri={overlayUri}
              isClosing={isClosing}
              isSlideOut={!!closing?.isSlideOut}
              isFlight={!!closing?.isFlight}
            />
          )
          : (
            <VideoNoteCaptureView
              cameraRef={cameraRef}
              facing={facing}
              isFlashOn={isFlashOn}
              isRecording={isRecording}
              isClosing={isClosing}
              isSlideOut={!!closing?.isSlideOut}
              isFlight={!!closing?.isFlight}
              progress={progress}
              onReady={onCameraReady}
              onError={onCameraError}
              onToggleFlash={toggleFlash}
              onFlip={flipCamera}
            />
          )}
      </VideoNoteStage>
    )

  const buttonPhase: RecordButtonPhase = phase === 'preview'
    ? 'preview'
    : phase === 'preparing' || phase === 'recording'
      ? (isLocked ? 'locked' : 'recording')
      : 'idle'

  const canPause = canPreview && isRecording && elapsed < maxMs - PAUSE_HIDE_LEAD_MS

  return {
    isActive: phase === 'preparing' || phase === 'recording' || phase === 'preview',
    isLocked,
    isCapturing: isRecording,
    elapsed: phase === 'preview' ? durationRef.current : elapsed,
    buttonPhase,
    preview: phase === 'preview' ? { durationMs: durationRef.current } : null,
    start,
    finish,
    lock,
    pause: canPause ? pause : undefined,
    send,
    isViewOnce,
    toggleViewOnce: config?.isViewOnceEnabled ? toggleViewOnce : undefined,
    overlay,
  }
}

interface VideoNoteCaptureViewProps {
  cameraRef: React.RefObject<VideoNoteRecorderController | null>
  facing: 'front' | 'back'
  isFlashOn: boolean
  isRecording: boolean
  /** The take is over and the circle is shrinking away. */
  isClosing: boolean
  /** Closing flies the circle off to the left edge (takes over 300ms). */
  isSlideOut: boolean
  /** Sent: closing flies the circle into the new note instead. */
  isFlight: boolean
  /** Elapsed share of the max length, 0..1. */
  progress: number
  onReady: () => void
  onError: (error: unknown) => void
  onToggleFlash: () => void
  onFlip: () => void
}

/** Lays out the circle as large as the space above the composer allows. */
function useRoundLayout () {
  const [area, setArea] = useState({ width: 0, height: 0 })
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setArea({ width, height })
  }, [])

  // The preview fills most of the chat.
  const roundSize = Math.max(0, Math.min(area.width * 0.82, area.height - 96, MAX_ROUND_SIZE))
  const ringRadius = roundSize / 2 + RING_GAP
  return {
    area,
    onLayout,
    roundSize,
    ringRadius,
    ringCircumference: 2 * Math.PI * ringRadius,
    ringBox: (ringRadius + RING_STROKE) * 2,
  }
}

/**
 * The layer behind the circle, kept across capture and preview: fades in over
 * 520ms and out the same way when the take ends. The chat is blurred
 * under it with `expo-blur`, and
 * without it a dim stands in.
 */
function VideoNoteStage ({ isClosing, children }: { isClosing: boolean, children: React.ReactNode }) {
  const { colors } = useTheme()
  const isDark = useColorScheme() === 'dark'
  const dim = useSharedValue(0)
  useEffect(() => {
    dim.value = withTiming(isClosing ? 0 : 1, { duration: DIM_ANIMATION_MS, easing: EASE_OUT_QUINT })
  }, [isClosing, dim])
  const isBlurred = !!BlurView
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * (isBlurred ? BLUR_LAYER_ALPHA : 1) }))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isClosing ? 'none' : 'box-none'}>
      {/* Blocks touches to the chat underneath while the camera is up. */}
      <Animated.View style={[isBlurred ? styles.blurLayer : styles.dim, dimStyle]} pointerEvents={isClosing ? 'none' : 'auto'}>
        {isBlurred && (
          <>
            <BlurView style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'default'} intensity={BLUR_INTENSITY} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.inputBarBackground, opacity: BLUR_WASH_ALPHA }]} />
          </>
        )}
      </Animated.View>
      {children}
    </View>
  )
}

/**
 * The circle opens from 0.1 and half a
 * screen down over 180ms, and closes the same way - towards the left edge
 * when the take was long enough to send. A paused take's preview is already
 * open.
 */
function useRoundAnimation ({ isClosing, isSlideOut, isOpen, area, isFlight, roundRef, roundSize }: {
  isClosing: boolean
  isSlideOut: boolean
  /** Starts open, without the rise (`fromPaused`). */
  isOpen: boolean
  area: { width: number, height: number }
  /** Sent: fly into the new note rather than close. */
  isFlight: boolean
  /** The view centred on the circle, measured for the flight. */
  roundRef: React.RefObject<React.ComponentRef<typeof View> | null>
  roundSize: number
}) {
  // No note landed in time: close the ordinary way after all.
  const [isFlightAbandoned, setIsFlightAbandoned] = useState(false)
  const isClosed = isClosing && (!isFlight || isFlightAbandoned)

  const open = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    open.value = withTiming(isClosed ? 0 : 1, { duration: ROUND_ANIMATION_MS, easing: DECELERATE })
  }, [isClosed, open])

  // The ring and the buttons go as soon as the take ends, on a flight too
  // (`getButtonsLayout`, `getPaint` faded to 0).
  const chrome = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    chrome.value = withTiming(isClosing ? 0 : 1, { duration: ROUND_ANIMATION_MS, easing: DECELERATE })
  }, [isClosing, chrome])

  // The round note flight: the camera circle moves onto the note
  // and scales to its size over 300ms - x on the default curve, y and scale
  // eased out-quint - then crossfades out over 100ms as the note shows.
  const fly = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  const flyScale = useSharedValue(1)
  const fade = useSharedValue(1)
  const roundSizeRef = useRef(roundSize)
  roundSizeRef.current = roundSize

  const jsLanded = useCallback(() => {
    finishSendFlight('round')
    fade.value = withTiming(0, { duration: ROUND_FLIGHT_FADE_MS, easing: DECELERATE })
  }, [fade])

  useEffect(() => {
    if (!isClosing || !isFlight)
      return

    let isWaiting = true
    let isFlying = false
    let off: (() => void) | undefined
    const timer = setTimeout(() => {
      isWaiting = false
      off?.()
      abandonSendFlight('round')
      setIsFlightAbandoned(true)
    }, SEND_FLIGHT_WAIT_MS)

    const unsubscribe = onSendFlightTarget('round', target => {
      if (!isWaiting)
        return

      isWaiting = false
      clearTimeout(timer)
      off?.()
      isFlying = true
      const node = roundRef.current
      const size = roundSizeRef.current
      if (!node || size <= 0) {
        isFlying = false
        jsLanded()
        return
      }

      node.measureInWindow((x, y, width, height) => {
        if (!isFlying)
          return

        flyX.value = target.x + target.size / 2 - (x + width / 2)
        flyY.value = target.y + target.size / 2 - (y + height / 2)
        flyScale.value = target.size / size
        fly.value = withTiming(1, { duration: ROUND_FLIGHT_MS, easing: Easing.linear }, finished => {
          if (finished)
            runOnJS(jsLanded)()
        })
      })
    })
    if (isWaiting)
      off = unsubscribe
    else
      unsubscribe()

    return () => {
      clearTimeout(timer)
      off?.()
      if (isWaiting)
        abandonSendFlight('round')
      // Torn down mid-flight: let the note show rather than stay hidden.
      if (isFlying && fly.value < 1)
        finishSendFlight('round')
      isFlying = false
    }
  }, [isClosing, isFlight, roundRef, fly, flyX, flyY, flyScale, jsLanded])

  const toX = isClosed && isSlideOut ? SLIDE_OUT_INSET - area.width / 2 : 0
  const toY = isOpen ? 0 : area.height / 2
  const roundStyle = useAnimatedStyle(() => {
    const quint = easeOutQuint(fly.value)
    return {
      opacity: open.value * fade.value,
      transform: [
        { translateX: toX * (1 - open.value) + flyX.value * easeDefault(fly.value) },
        { translateY: toY * (1 - open.value) + flyY.value * quint },
        { scale: (0.1 + 0.9 * open.value) * (1 + (flyScale.value - 1) * quint) },
      ],
    }
  })
  const controlsStyle = useAnimatedStyle(() => ({ opacity: open.value * chrome.value }))
  const ringStyle = useAnimatedStyle(() => ({ opacity: chrome.value }))
  return { roundStyle, controlsStyle, ringStyle }
}

/**
 * The round camera preview drawn over the dimmed conversation while a take
 * records. A separate component so the vision-camera hooks only run while the
 * camera is actually open.
 */
function VideoNoteCaptureView ({
  cameraRef,
  facing,
  isFlashOn,
  isRecording,
  isClosing,
  isSlideOut,
  isFlight,
  progress,
  onReady,
  onError,
  onToggleFlash,
  onFlip,
}: VideoNoteCaptureViewProps) {
  const labels = useLabels()
  const visionCamera = getVisionCamera()
  const Camera = visionCamera.Camera
  // The camera on the chosen side, else the other side, else any camera at all
  // (an external one, an emulator's). Each side's default device is the one
  // vision-camera picks for it: the wide-angle lens.
  const front = visionCamera.useCameraDevice('front')
  const back = visionCamera.useCameraDevice('back')
  const devices: any[] = visionCamera.useCameraDevices()
  const device = (facing === 'front' ? front ?? back : back ?? front) ?? devices[0]

  // Recording goes through a video output and the recorders it creates. The
  // persistent recorder keeps one file across a flip mid-take.
  const videoOutput = visionCamera.useVideoOutput({ enableAudio: true, enablePersistentRecorder: true })
  const outputs = useMemo(() => [videoOutput], [videoOutput])
  const recorder = useMemo(() => createVideoNoteRecorder(videoOutput), [videoOutput])
  useEffect(() => {
    cameraRef.current = recorder
    return () => {
      if (cameraRef.current === recorder)
        cameraRef.current = null
    }
  }, [cameraRef, recorder])
  const canFlip = !!front && !!back
  const isFront = device?.position === 'front'
  const { area, onLayout, roundSize, ringRadius, ringCircumference, ringBox } = useRoundLayout()
  const roundRef = useRef<React.ComponentRef<typeof View>>(null)
  const { roundStyle, controlsStyle, ringStyle } = useRoundAnimation({
    isClosing,
    isSlideOut,
    isOpen: false,
    area,
    isFlight,
    roundRef,
    roundSize,
  })

  // The flip turns the circle edge-on, switches cameras out of sight, and
  // turns it back from the other side (`switchCameraButton`'s animator).
  const flip = useSharedValue(0)
  const isFlippingRef = useRef(false)
  const onFlipRef = useRef(onFlip)
  onFlipRef.current = onFlip
  const jsSwitchCamera = useCallback(() => onFlipRef.current(), [])
  const jsFlipDone = useCallback(() => {
    isFlippingRef.current = false
  }, [])
  const startFlip = useCallback(() => {
    if (isFlippingRef.current)
      return

    isFlippingRef.current = true
    flip.value = 0
    flip.value = withTiming(1, { duration: FLIP_MS, easing: EASE_OUT_QUINT }, () => {
      runOnJS(jsFlipDone)()
    })
  }, [flip, jsFlipDone])
  useAnimatedReaction(
    () => flip.value >= 0.5,
    (isPastHalf, wasPastHalf) => {
      if (isPastHalf && wasPastHalf === false)
        runOnJS(jsSwitchCamera)()
    }
  )
  const flipStyle = useAnimatedStyle(() => {
    const v = flip.value
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${v < 0.5 ? v * 180 : (v - 1) * 180}deg` }],
    }
  })
  // The flip icon turns half a turn.
  const flipIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flip.value * 180}deg` }],
  }))

  // No camera at all: report it instead of waiting forever for an
  // initialization that cannot happen. Not on the first render - Android fills
  // the device list asynchronously, and failing at once closed every take.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const labelNoCamera = labels.noCamera
  const hasDevice = !!device
  useEffect(() => {
    if (hasDevice)
      return

    const timer = setTimeout(() => onErrorRef.current(new Error(labelNoCamera)), NO_CAMERA_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [hasDevice, labelNoCamera])

  // Pinch to zoom while recording, springing back when the fingers lift.
  // vision-camera 5 measures zoom against the wide-angle lens, so 1 is neutral
  // even on a multi-lens device that can zoom out below it.
  const minZoom: number = device?.minZoom ?? 1
  const neutralZoom = Math.max(minZoom, Math.min(device?.maxZoom ?? 1, 1))
  const maxZoom: number = Math.min(device?.maxZoom ?? 1, neutralZoom * 8)
  const [zoom, setZoom] = useState(neutralZoom)
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopZoomReset = useCallback(() => {
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])
  useEffect(() => stopZoomReset, [stopZoomReset])

  const pinchStartZoomRef = useRef(neutralZoom)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const onPinchBegin = useCallback(() => {
    stopZoomReset()
    pinchStartZoomRef.current = zoomRef.current
  }, [stopZoomReset])

  const onPinch = useCallback((scale: number) => {
    setZoom(Math.max(minZoom, Math.min(maxZoom, pinchStartZoomRef.current * scale)))
  }, [minZoom, maxZoom])

  const onPinchEnd = useCallback(() => {
    stopZoomReset()
    const from = zoomRef.current
    const startedAt = Date.now()
    resetTimerRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / ZOOM_RESET_MS)
      setZoom(from + (neutralZoom - from) * t)
      if (t >= 1)
        stopZoomReset()
    }, 16)
  }, [neutralZoom, stopZoomReset])

  // Every callback ends up on the JS thread (zoom is React state), so run the
  // whole gesture there instead of hopping over from the UI thread each frame.
  const pinchGesture = usePinchGesture({
    enabled: isRecording,
    runOnJS: true,
    onBegin: () => {
      onPinchBegin()
    },
    onUpdate: event => {
      onPinch(event.scale)
    },
    onFinalize: () => {
      onPinchEnd()
    },
  })

  // The flash: a white screen in front of the front camera, the torch on
  // the back one, and only while actually recording.
  const isScreenFlash = isFlashOn && isRecording && isFront
  const isTorchOn = isFlashOn && isRecording && !isFront && !!device?.hasTorch

  return (
    <View style={[styles.stage, isScreenFlash && styles.screenFlash]} onLayout={onLayout} pointerEvents='box-none'>
      {roundSize > 0 && (
        <Animated.View ref={roundRef} collapsable={false} style={[styles.ringWrapper, { width: ringBox, height: ringBox }, roundStyle]}>
          {SvgCircle && progress > 0 && (
            <Animated.View style={[StyleSheet.absoluteFill, ringStyle]} pointerEvents='none'>
              <Svg width={ringBox} height={ringBox} style={StyleSheet.absoluteFill} pointerEvents='none'>
                {/* Only the elapsed arc, no track. */}
                <SvgCircle
                  cx={ringBox / 2}
                  cy={ringBox / 2}
                  r={ringRadius}
                  stroke={isScreenFlash ? '#3390EC' : '#FFFFFF'}
                  strokeWidth={RING_STROKE}
                  fill='none'
                  strokeLinecap='round'
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - progress)}
                  transform={`rotate(-90 ${ringBox / 2} ${ringBox / 2})`}
                />
              </Svg>
            </Animated.View>
          )}
          <GestureDetector gesture={pinchGesture}>
            <Animated.View style={[styles.round, { width: roundSize, height: roundSize, borderRadius: roundSize / 2 }, flipStyle]}>
              {device
                ? (
                  <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    // Stays live after a stop until the file is written.
                    isActive
                    outputs={outputs}
                    zoom={zoom}
                    torchMode={isTorchOn ? 'on' : 'off'}
                    onStarted={onReady}
                    onError={onError}
                  />
                )
                : <Text style={styles.placeholderText}>{labels.noCamera}</Text>}
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      )}

      {/* Switch camera and flash, bottom-left, usable while recording. */}
      {(canFlip || !!device) && (
        <Animated.View style={[styles.utilityPill, controlsStyle]} pointerEvents={isClosing ? 'none' : 'auto'}>
          {canFlip && (
            <Pressable
              onPress={startFlip}
              hitSlop={8}
              accessibilityRole='button'
              accessibilityLabel='switch camera'
              style={styles.utilityButton}
            >
              <Animated.View style={flipIconStyle}>
                <FlipCameraIcon color='#1C1C1E' size={22} />
              </Animated.View>
            </Pressable>
          )}
          {!!device && (
            <Pressable
              onPress={onToggleFlash}
              hitSlop={8}
              accessibilityRole='button'
              accessibilityState={{ selected: isFlashOn }}
              accessibilityLabel='flash'
              style={styles.utilityButton}
            >
              <FlashIcon color={isFlashOn ? '#F5A623' : '#1C1C1E'} size={22} />
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  )
}

/**
 * A paused take playing back in the circle: muted and looping, tap to hear it. Only mounted when expo-video is
 * installed.
 */
function VideoNotePreviewView ({ uri, isClosing, isSlideOut, isFlight }: {
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

const styles = StyleSheet.create({
  // Dim, not black: the conversation stays visible behind the camera.
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  blurLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The front camera's flash is the screen itself, lit white behind the circle.
  screenFlash: {
    backgroundColor: '#FFFFFF',
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
  placeholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // Camera flip and flash share one white pill in the corner.
  utilityPill: {
    position: 'absolute',
    left: 16,
    bottom: 16,
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
  muteBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
