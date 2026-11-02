import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureDetector, usePinchGesture } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useLabels } from '../../hooks/useLabels'
import { FlashIcon, FlipCameraIcon } from '../MediaControls'
import { VideoNoteRecorderController, createVideoNoteRecorder, getVisionCamera } from '../visionCamera'
import { EASE_OUT_QUINT, FLIP_MS, NO_CAMERA_TIMEOUT_MS, ZOOM_RESET_MS } from './constants'
import { SvgCircle } from './optional'
import { ProgressRing } from './ProgressRing'
import { styles } from './styles'
import { RingProgress } from './types'
import { useRoundAnimation } from './useRoundAnimation'
import { useRoundLayout } from './useRoundLayout'

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
  /** Elapsed share of the max length, 0..1, or the running time to read it from. */
  progress: RingProgress
  onReady: () => void
  onError: (error: unknown) => void
  onToggleFlash: () => void
  onFlip: () => void
}

// Picked once at load, not off the module during render: a hook has to be the same function on
// every render, and the module never changes once resolved. VideoNoteCaptureView only mounts
// when the native module is present.
const visionCamera = getVisionCamera()
const useCameraDevice: (position: 'front' | 'back') => any = visionCamera?.useCameraDevice
const useCameraDevices: () => any[] = visionCamera?.useCameraDevices
const useVideoOutput: (options: object) => any = visionCamera?.useVideoOutput

/**
 * The round camera preview drawn over the dimmed conversation while a take
 * records. A separate component so the vision-camera hooks only run while the
 * camera is actually open.
 */
export function VideoNoteCaptureView ({
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
  const Camera = visionCamera.Camera
  // The camera on the chosen side, else the other side, else any camera at all
  // (an external one, an emulator's). Each side's default device is the one
  // vision-camera picks for it: the wide-angle lens.
  const front = useCameraDevice('front')
  const back = useCameraDevice('back')
  const devices: any[] = useCameraDevices()
  const device = (facing === 'front' ? front ?? back : back ?? front) ?? devices[0]

  // Recording goes through a video output and the recorders it creates. The
  // persistent recorder keeps one file across a flip mid-take.
  const videoOutput = useVideoOutput({ enableAudio: true, enablePersistentRecorder: true })
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
  useLayoutEffect(() => {
    onFlipRef.current = onFlip
  })
  const jsSwitchCamera = useCallback(() => onFlipRef.current(), [])
  const jsFlipDone = useCallback(() => {
    isFlippingRef.current = false
  }, [])
  const startFlip = useCallback(() => {
    if (isFlippingRef.current)
      return

    isFlippingRef.current = true
    flip.set(0)
    flip.set(withTiming(1, { duration: FLIP_MS, easing: EASE_OUT_QUINT }, () => {
      runOnJS(jsFlipDone)()
    }))
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
  useLayoutEffect(() => {
    onErrorRef.current = onError
  })
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
  useLayoutEffect(() => {
    zoomRef.current = zoom
  })

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
          {SvgCircle && (
            <ProgressRing
              progress={progress}
              ringBox={ringBox}
              ringRadius={ringRadius}
              ringCircumference={ringCircumference}
              color={isScreenFlash ? '#3390EC' : '#FFFFFF'}
              ringStyle={ringStyle}
            />
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
