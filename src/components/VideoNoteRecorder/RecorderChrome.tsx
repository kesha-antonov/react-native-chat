import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useTheme } from '../../hooks/useTheme'
import { CloseIcon, FlashIcon, FlipCameraIcon, PauseIcon, PlayIcon } from '../MediaControls'
import { SendIcon } from '../SendIcon'
import {
  MAX_ROUND_SIZE,
  NOTE_WIDTH_RATIO,
  RING_GAP,
  RING_STROKE,
  Svg,
  SvgCircle,
  formatElapsedTenths,
} from './constants'
import { styles } from './styles'

/**
 * Shared recorder UI: round preview + progress ring + timer + shutter.
 *
 * The shutter is hold-to-record, with the same three-way gesture as a voice
 * note - release to send, slide up to lock for hands-free, slide left to
 * cancel - so the muscle memory carries over between the two recorders.
 */
export function RecorderChrome ({
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
  // The preview is most of the screen width, not a fixed 220pt puck.
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
    lockedSV.set(isLocked ? 1 : 0)
    if (!isRecording) {
      translateX.set(0)
      translateY.set(0)
      cancelArmed.set(0)
      setIsCancelArmed(false)
    }
  }, [isLocked, isRecording, lockedSV, translateX, translateY, cancelArmed])

  const shutterGesture = usePanGesture({
    enabled: !isDisabled,
    onBegin: () => {
      if (lockedSV.get() > 0)
        return

      runOnJS(onStart)()
    },
    onUpdate: event => {
      if (lockedSV.get() > 0)
        return

      const x = Math.max(-cancelThreshold, Math.min(0, event.translationX))
      const y = Math.max(-(lockThreshold + 12), Math.min(0, event.translationY))
      translateX.set(x)
      translateY.set(y)

      // Same rule as the record button: releasing past 55% of the slide cancels.
      const armed = x <= -cancelThreshold * 0.55 ? 1 : 0
      if (armed !== cancelArmed.get()) {
        cancelArmed.set(armed)
        runOnJS(setIsCancelArmed)(armed > 0)
      }

      if (-y >= lockThreshold && armed === 0) {
        lockedSV.set(1)
        translateX.set(withTiming(0, { duration: 150 }))
        translateY.set(withTiming(0, { duration: 150 }))
        runOnJS(onLock)()
      }
    },
    onFinalize: () => {
      // Locked: the finger lifts but recording continues.
      if (lockedSV.get() > 0) {
        translateX.set(withTiming(0, { duration: 150 }))
        translateY.set(withTiming(0, { duration: 150 }))
        cancelArmed.set(0)
        return
      }

      const cancelled = cancelArmed.value > 0
      translateX.set(withTiming(0, { duration: 150 }))
      translateY.set(withTiming(0, { duration: 150 }))
      cancelArmed.set(0)
      runOnJS(cancelled ? onCancel : onStop)()
    },
  })

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
            {/* No track behind it: only the elapsed arc is drawn. */}
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
          {/* Camera flip and torch share one pill on the left.
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
