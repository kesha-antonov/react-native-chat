import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  SharedValue,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useIsRTL } from '../hooks/useIsRTL'
import { useLabels } from '../hooks/useLabels'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { Icon } from './Icon'
import { CameraIcon, ChevronIcon, LockIcon, MicIcon, PauseIcon } from './MediaControls'
import {
  EXIT_GESTURE,
  EXIT_NONE,
  EXIT_PREVIEW,
  EXIT_RELEASE,
  RecordCircle,
  entryCurve,
  levelToAmplitude,
  useRecordCircleValues,
} from './RecordCircle'
import {
  countLockHint,
  countPauseHint,
  recordingHaptic,
  retireLockHint,
  retirePauseHint,
  shouldShowLockHint,
  shouldShowPauseHint,
} from './recordingFeedback'
import {
  SEND_FLIGHT_REVEAL_MS,
  SEND_FLIGHT_WAIT_MS,
  VOICE_FLIGHT_MS,
  VoiceFlightTarget,
  abandonSendFlight,
  expectSendFlight,
  finishSendFlight,
  onSendFlightTarget,
} from './sendFlight'
import { SendIcon } from './SendIcon'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
/** The resume icon fades in as the pause bars fade out (`transformToResume`). */
const RESUME_FADE_MS = 200

/** Where a take is: what the button shows and which gestures it accepts. */
export type RecordButtonPhase = 'idle' | 'recording' | 'locked' | 'preview'

/** How a take left the button: drives the circle's exit and the bar's. */
export type RecordExitReason = 'send' | 'cancel' | 'preview'

/**
 * Releasing past this share of the slide distance cancels.
 */
const RELEASE_CANCEL_PROGRESS = 0.45
/**
 * Locking is refused once the cancel slide is past 30% of its distance, and a
 * take the system interrupts is cancelled past the same point instead of
 * locked (`slideToCancelProgress < 0.7f`).
 */
const LOCK_BLOCK_PROGRESS = 0.7
/** "Slide up to lock" goes once the cancel slide passes 20%. */
const LOCK_HINT_HIDE_PROGRESS = 0.8
/** Share of the window width the slide distance is capped at (`distCanMove`). */
const SLIDE_WIDTH_SHARE = 0.35
/** Hold before recording starts when a tap switches modes (`recordAudioVideoRunnable`, 150ms). */
const HOLD_DELAY_MS = 150
/**
 * A take released sooner than this was a tap, not a hold, and shows
 * the "Hold to record" hint.
 */
const QUICK_RELEASE_MS = 100
/** How long "Pause to trim or replay" stays up. */
const PAUSE_HINT_MS = 3500
/** The lock hint waits for the finger to stay down this long. */
const LOCK_HINT_DELAY_MS = 200
/** How long a view-once tooltip stays up. */
const ONCE_HINT_MS = 3500
/**
 * "Tap to set this message to Play Once" shows on the first three locks
 * (`voiceoncehint < 3`); counted per app session, like the other hints.
 */
const ONCE_HINT_LIMIT = 3
let onceHintCount = 0

/** The view-once button: 36 round, 12 above the lock (`onceRect`, `onceOffset`). */
const ONCE_SIZE = 36
const ONCE_GAP = 12

/** The lock pill: 36 wide, 14 taller while it still shows the arrow (`ControlsView`). */
const LOCK_WIDTH = 36
const LOCK_EXTRA_HEIGHT = 14
/** Its top sits 110 above the circle's centre at rest (lock y=60, circle cy=170). */
const LOCK_OFFSET = 110
/** It rises this far into place, and drops as far when the cancel slide hides it. */
const LOCK_RISE = 72
/** Idle bob amplitude and half-cycle. */
const LOCK_BOB = 8
const LOCK_BOB_HALF_MS = 850

/** The 300ms entry scale of the circle (`DecelerateInterpolator`). */
const DECELERATE = Easing.out(Easing.quad)
/** Ease-out quint. */
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)

/**
 * The idle button's icon last shown, so a remount caused by the voice / video
 * toggle can cross-swap from the previous icon instead of snapping.
 */
let lastShownMode: 'voice' | 'video' | null = null

/** The horizontal distance a cancel slide covers (`distCanMove`), shared with the bar. */
export function useRecordSlideDistance () {
  const { voice } = useTheme()
  const { width } = useWindowDimensions()
  return Math.min(voice.cancelThreshold, width * SLIDE_WIDTH_SHARE)
}

export interface RecordButtonProps {
  mode: 'voice' | 'video'
  phase: RecordButtonPhase
  /** Microphone loudness, 0..1, for the circle and its blobs. */
  level?: number
  /**
   * Video only: the camera has actually started recording. The blobs wait for
   * it.
   */
  isCapturing?: boolean
  /**
   * A quick tap. Set when the button switches between voice and video: the
   * press then has to be held for 150ms before it records.
   */
  onTap?: () => void
  /** The hold became a take. */
  onStart: () => void
  /** Finger lifted, or slid all the way to cancel; `cancelled` says which. */
  onFinish: (cancelled: boolean) => void
  /** Slid up past the lock distance. */
  onLock: () => void
  /** Locked: the pause button above the send button. Hidden when omitted. */
  onPause?: () => void
  /** Previewing: the button in the pause button's place that records on. Hidden when omitted. */
  onResume?: () => void
  /** Tooltip by the pause button for the first few locked takes. */
  pauseHint?: string | null
  /** Locked or previewing: the send button. */
  onSend: () => void
  /** Live slide-to-cancel progress, 1 at rest down to 0 at the cancel point. */
  onSlideProgress?: (progress: number) => void
  /** The same progress on the UI thread, for the bar's "slide to cancel". */
  slideProgressValue?: SharedValue<number>
  /** The button ended a take this way, just before `onFinish` / `onSend` / `onPause`. */
  onExit?: (reason: RecordExitReason) => void
  /** A tooltip to show above the button, e.g. after a mode switch. */
  hint?: string | null
  /**
   * Without `onTap` a take starts on touch-down, so a tap is a take released
   * within 100ms. Called then, after `onFinish`, to show the hold hint.
   */
  onQuickRelease?: () => void
  /**
   * Locked or previewing: the view-once toggle above the pause button. Hidden when omitted.
   */
  onToggleViewOnce?: () => void
  /** The take goes out as view-once; the toggle is drawn on. */
  isViewOnce?: boolean
}

/**
 * The record button: hold to
 * record, release to send, slide left to cancel, slide up to lock. Shared by
 * voice and round video notes so both behave exactly alike.
 *
 * The 36pt button stays the touch target throughout; while a take records it
 * hides under the big `RecordCircle`, which is only drawn.
 */
export function RecordButton ({
  mode,
  phase,
  level = 0,
  isCapturing = true,
  onTap,
  onStart,
  onFinish,
  onLock,
  onPause,
  onResume,
  pauseHint,
  onSend,
  onSlideProgress,
  slideProgressValue,
  onExit,
  hint,
  onQuickRelease,
  onToggleViewOnce,
  isViewOnce = false,
}: RecordButtonProps) {
  const styles = useThemedStyles(createStyles)
  const labels = useLabels()
  const { voice } = useTheme()
  const isRTL = useIsRTL()

  const slideDistance = useRecordSlideDistance()
  const lockDistance = voice.lockThreshold
  // LTR slides left to cancel (negative translationX); RTL mirrors it.
  const cancelSign = isRTL ? 1 : -1
  const isVoice = mode === 'voice'
  const isVideo = !isVoice

  const circle = useRecordCircleValues()
  const { enter, slide: slideProgress, exit, exitKind, sendMorph, showWaves, flight, flightDX, flightDY, flightRadius } = circle
  // How far the finger is up, capped at the lock distance.
  const fingerUp = useSharedValue(0)
  const lockedSV = useSharedValue(0)
  // 1 once the pan has become a take; 0 again once that take was handed off
  // (released, cancelled mid-drag or locked), so finalize never fires twice.
  const isTakeSV = useSharedValue(0)
  // The lock drops away while the cancel slide is past 30%, on a timer rather
  // than with the finger (`slideToCancelLockProgress`).
  const lockHide = useSharedValue(0)
  const lockHideTarget = useSharedValue(0)
  const lockTilt = useSharedValue(0)
  const pauseMorph = useSharedValue(0)
  const bob = useSharedValue(0)
  const lastReported = useSharedValue(1)
  const buttonShown = useSharedValue(1)
  const modeSV = useSharedValue(lastShownMode === null || lastShownMode === mode ? (isVideo ? 1 : 0) : (isVideo ? 0 : 1))

  // Callbacks read through refs: the gesture must not be rebuilt mid-hold,
  // and the callers' identities change with every timer tick.
  const callbacksRef = useRef({ onStart, onFinish, onLock, onSlideProgress, onQuickRelease, onExit })
  callbacksRef.current = { onStart, onFinish, onLock, onSlideProgress, onQuickRelease, onExit }
  const startedAtRef = useRef(0)
  // How the take in progress ended, as far as this button saw it; anything
  // else (the bar's CANCEL, a time limit) leaves it null.
  const exitReasonRef = useRef<'send' | 'cancel' | 'gesture' | 'preview' | null>(null)

  // Mic <-> camera: a quick scale and fade cross-swap when the mode toggles.
  useEffect(() => {
    lastShownMode = mode
    modeSV.value = withTiming(mode === 'video' ? 1 : 0, { duration: 150, reduceMotion: ReduceMotion.System })
  }, [mode, modeSV])

  useEffect(() => {
    circle.amplitude.value = phase === 'recording' || phase === 'locked' ? levelToAmplitude(level) : 0
  }, [phase, level, circle.amplitude])

  useEffect(() => {
    showWaves.value = isCapturing ? 1 : 0
  }, [isCapturing, showWaves])

  const isLocked = phase === 'locked'
  const isRecording = phase === 'recording' || phase === 'locked'

  // The circle stays mounted after the take ends until its exit has played.
  const [isCircleMounted, setIsCircleMounted] = useState(false)
  const wasRecordingRef = useRef(false)
  const exitDoneRef = useRef(() => {})
  exitDoneRef.current = () => {
    setIsCircleMounted(false)
    setFlightTarget(null)
    // Back to the start, so the next take's first frame is not this one's last.
    enter.value = 0
    slideProgress.value = 1
    fingerUp.value = 0
    lockedSV.value = 0
    flight.value = 0
    buttonShown.value = withTiming(1, { duration: 150, reduceMotion: ReduceMotion.System })
  }
  const jsExitDone = () => exitDoneRef.current()

  // A sent voice take flies into the new message's play button
  // (`VoiceMessageEnterTransition`) instead of collapsing in place.
  const containerRef = useRef<React.ComponentRef<typeof View>>(null)
  const [flightTarget, setFlightTarget] = useState<VoiceFlightTarget | null>(null)
  // Stops waiting for a target, or reports a flight in the air as landed.
  const flightCleanupRef = useRef<(() => void) | null>(null)
  const flightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsFlightLanded = () => {
    flightCleanupRef.current = null
    finishSendFlight('voice')
    // The bubble's button fades in under the disc, then the disc goes, so the
    // two never show a half-transparent gap between them.
    flightTimerRef.current = setTimeout(() => {
      flightTimerRef.current = null
      exitDoneRef.current()
    }, SEND_FLIGHT_REVEAL_MS)
  }
  const startFlightRef = useRef<(fallback: () => void) => void>(() => {})
  startFlightRef.current = (fallback: () => void) => {
    flightCleanupRef.current?.()
    let isLanded = false
    let isWaiting = true
    let unsubscribe: (() => void) | undefined
    const stopWaiting = () => {
      isWaiting = false
      clearTimeout(timer)
      unsubscribe?.()
    }
    // Nothing landed in time (a take too short to send, a list that renders
    // elsewhere): give up and play the ordinary exit.
    const timer = setTimeout(() => {
      stopWaiting()
      flightCleanupRef.current = null
      abandonSendFlight('voice')
      fallback()
    }, SEND_FLIGHT_WAIT_MS)
    const onTarget = (target: VoiceFlightTarget) => {
      if (!isWaiting)
        return

      stopWaiting()
      isLanded = true
      const node = containerRef.current
      if (!node) {
        jsFlightLanded()
        return
      }

      node.measureInWindow((x, y, width, height) => {
        if (!isLanded)
          return

        // The circle hangs off the button's centre, shifted by the cancel
        // slide it was released at (`recordCircle.drawingCx`).
        const fromX = x + width / 2 + cancelSign * slideDistance * (1 - slideProgress.value)
        const fromY = y + height / 2
        flightDX.value = target.x - fromX
        flightDY.value = target.y - fromY
        flightRadius.value = target.radius
        setFlightTarget(target)
        flight.value = 0
        flight.value = withTiming(1, { duration: VOICE_FLIGHT_MS, easing: Easing.linear }, finished => {
          if (finished)
            runOnJS(jsFlightLanded)()
        })
      })
    }
    const off = onSendFlightTarget('voice', target => onTarget(target))
    // The target may already have landed, which ran `onTarget` before the
    // subscription was returned.
    if (isWaiting)
      unsubscribe = off
    else
      off()
    flightCleanupRef.current = () => {
      if (isWaiting) {
        stopWaiting()
        abandonSendFlight('voice')
      } else if (isLanded) {
        isLanded = false
        cancelAnimation(flight)
        finishSendFlight('voice')
      }
    }
  }

  useEffect(() => () => {
    flightCleanupRef.current?.()
    if (flightTimerRef.current)
      clearTimeout(flightTimerRef.current)
  }, [])

  useEffect(() => {
    if (isRecording) {
      if (wasRecordingRef.current)
        return

      wasRecordingRef.current = true
      exitReasonRef.current = null
      flightCleanupRef.current?.()
      flightCleanupRef.current = null
      if (flightTimerRef.current) {
        clearTimeout(flightTimerRef.current)
        flightTimerRef.current = null
      }
      setFlightTarget(null)
      cancelAnimation(flight)
      flight.value = 0
      cancelAnimation(exit)
      cancelAnimation(slideProgress)
      exit.value = 0
      exitKind.value = EXIT_NONE
      slideProgress.value = 1
      lastReported.value = 1
      if (slideProgressValue)
        slideProgressValue.value = 1
      fingerUp.value = 0
      lockedSV.value = 0
      lockHide.value = 0
      lockHideTarget.value = 0
      lockTilt.value = 0
      pauseMorph.value = 0
      sendMorph.value = 0
      circle.state.value = null
      buttonShown.value = 0
      enter.value = 0
      enter.value = withTiming(1, { duration: 300, easing: DECELERATE })
      bob.value = 0
      bob.value = withRepeat(
        withTiming(1, { duration: LOCK_BOB_HALF_MS, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
        -1,
        true
      )
      setIsCircleMounted(true)
      return
    }

    if (!wasRecordingRef.current)
      return

    wasRecordingRef.current = false
    cancelAnimation(bob)
    lockHide.value = withTiming(1, { duration: 140 })
    const reason = phase === 'preview' ? 'preview' : exitReasonRef.current ?? 'cancel'
    exitReasonRef.current = null
    const onDone = (finished?: boolean) => {
      'worklet'
      if (finished)
        runOnJS(jsExitDone)()
    }

    // Slid all the way: the circle springs back into the button, shrinking.
    if (reason === 'gesture') {
      exitKind.value = EXIT_GESTURE
      slideProgress.value = withTiming(1, { duration: 200 }, onDone)
      return
    }

    // Paused: swell, shrink to a dot, fade into the preview
    // (`transformToSeekbar`, 580ms voice / 490ms video).
    if (reason === 'preview') {
      exitKind.value = EXIT_PREVIEW
      exit.value = withTiming(1, { duration: isVoice ? 580 : 490, easing: Easing.linear }, onDone)
      return
    }

    const playRelease = () => {
      exitKind.value = EXIT_RELEASE
      exit.value = withTiming(1, { duration: 360, easing: Easing.linear }, onDone)
    }

    // A sent voice take holds still until its message lands, then flies there.
    if (reason === 'send' && isVoice) {
      startFlightRef.current(playRelease)
      return
    }

    playRelease()
    // jsExitDone only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, phase])

  // Locked: the mic turns into the send arrow, the lock into pause, and the
  // padlock snaps to -15deg and back.
  useEffect(() => {
    if (!isLocked)
      return

    lockedSV.value = 1
    sendMorph.value = withTiming(1, { duration: 150, easing: Easing.linear })
    pauseMorph.value = withTiming(1, { duration: 250, easing: EASE_OUT_QUINT })
    fingerUp.value = withTiming(0, { duration: 250, easing: EASE_OUT_QUINT })
    lockTilt.value = withSequence(
      withTiming(-15, { duration: 250, easing: EASE_OUT_QUINT }),
      withDelay(100, withTiming(0, { duration: 350, easing: EASE_OUT_QUINT }))
    )
  }, [isLocked, lockedSV, sendMorph, pauseMorph, fingerUp, lockTilt])

  // "Slide up to lock" for the first few takes, once the finger has been down
  // 200ms, never again once one is locked.
  const [isLockHintVisible, setIsLockHintVisible] = useState(false)
  useEffect(() => {
    if (phase !== 'recording' || !shouldShowLockHint()) {
      setIsLockHintVisible(false)
      return
    }

    const timer = setTimeout(() => {
      if (lastReported.value < LOCK_HINT_HIDE_PROGRESS)
        return

      setIsLockHintVisible(true)
      countLockHint()
    }, LOCK_HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [phase, lastReported])

  // "Pause to trim or replay" when a take is locked, for a few seconds.
  const [isPauseHintVisible, setIsPauseHintVisible] = useState(false)
  const hasPauseHint = !!pauseHint && !!onPause
  useEffect(() => {
    if (phase !== 'locked' || !hasPauseHint || !shouldShowPauseHint()) {
      setIsPauseHintVisible(false)
      return
    }

    setIsPauseHintVisible(true)
    countPauseHint()
    const timer = setTimeout(() => setIsPauseHintVisible(false), PAUSE_HINT_MS)
    return () => clearTimeout(timer)
  }, [phase, hasPauseHint])

  // The view-once tooltip (`showOnceHint`): on lock for the first few takes,
  // and again each time the toggle is switched on; switching it off hides it.
  const hasOnce = !!onToggleViewOnce && (phase === 'locked' || phase === 'preview')
  const [onceHint, setOnceHint] = useState<string | null>(null)
  const onceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showOnceHint = (text: string | null) => {
    if (onceHintTimerRef.current) {
      clearTimeout(onceHintTimerRef.current)
      onceHintTimerRef.current = null
    }
    setOnceHint(text)
    if (text)
      onceHintTimerRef.current = setTimeout(() => {
        onceHintTimerRef.current = null
        setOnceHint(null)
      }, ONCE_HINT_MS)
  }
  const showOnceHintRef = useRef(showOnceHint)
  showOnceHintRef.current = showOnceHint
  const hasOnceToggle = !!onToggleViewOnce
  useEffect(() => {
    if (!isLocked || !hasOnceToggle || isViewOnce || onceHintCount >= ONCE_HINT_LIMIT)
      return

    onceHintCount++
    showOnceHintRef.current(labels.viewOnceHint)
    // Only the lock itself shows it; the toggle handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, hasOnceToggle])
  useEffect(() => {
    if (!hasOnce)
      showOnceHintRef.current(null)
  }, [hasOnce])
  useEffect(() => () => {
    if (onceHintTimerRef.current)
      clearTimeout(onceHintTimerRef.current)
  }, [])
  const toggleOnce = () => {
    recordingHaptic()
    showOnceHint(isViewOnce ? null : isVideo ? labels.viewOnceVideoEnabledHint : labels.viewOnceVoiceEnabledHint)
    onToggleViewOnce?.()
  }

  // A tick when the voice recorder starts and stops; a round take ticks
  // when its camera actually starts recording, which the session handles.
  const jsStart = () => {
    startedAtRef.current = Date.now()
    if (isVoice)
      recordingHaptic()
    callbacksRef.current.onStart()
  }
  const jsFinish = (cancelled: boolean, isGesture: boolean) => {
    exitReasonRef.current = isGesture ? 'gesture' : cancelled ? 'cancel' : 'send'
    // Before `onFinish`, which is what adds the message the circle flies to.
    if (isVoice && !cancelled)
      expectSendFlight('voice')
    callbacksRef.current.onExit?.(cancelled ? 'cancel' : 'send')
    if (isVoice)
      recordingHaptic()
    callbacksRef.current.onFinish(cancelled)
    if (!cancelled && Date.now() - startedAtRef.current < QUICK_RELEASE_MS)
      callbacksRef.current.onQuickRelease?.()
  }
  const jsLock = () => {
    recordingHaptic()
    retireLockHint()
    setIsLockHintVisible(false)
    callbacksRef.current.onLock()
  }
  const jsSlideProgress = (progress: number) => {
    callbacksRef.current.onSlideProgress?.(progress)
    if (progress < LOCK_HINT_HIDE_PROGRESS)
      setIsLockHintVisible(false)
  }

  const panGesture = usePanGesture({
    activateAfterLongPress: onTap ? HOLD_DELAY_MS : 0,
    onActivate: () => {
      isTakeSV.value = 1
      runOnJS(jsStart)()
    },
    onUpdate: event => {
      if (isTakeSV.value === 0 || lockedSV.value > 0)
        return

      const dx = cancelSign === -1
        ? Math.max(-slideDistance, Math.min(0, event.translationX))
        : Math.min(slideDistance, Math.max(0, event.translationX))
      const progress = 1 - Math.abs(dx) / slideDistance
      const up = Math.max(0, Math.min(lockDistance, -event.translationY))

      // The circle tracks every frame; JS only hears about real changes.
      slideProgress.value = progress
      if (slideProgressValue)
        slideProgressValue.value = progress
      if (Math.abs(progress - lastReported.value) > 0.01 || progress === 0) {
        lastReported.value = progress
        runOnJS(jsSlideProgress)(progress)
      }

      // All the way across: cancel now, before the finger lifts.
      if (progress <= 0) {
        isTakeSV.value = 0
        runOnJS(jsFinish)(true, true)
        return
      }

      // Lock and cancel exclude each other: no lock once the slide is past 30%.
      const isBlocked = progress < LOCK_BLOCK_PROGRESS ? 1 : 0
      if (isBlocked !== lockHideTarget.value) {
        lockHideTarget.value = isBlocked
        lockHide.value = withTiming(isBlocked, { duration: 140 })
      }
      fingerUp.value = isBlocked ? 0 : up

      if (!isBlocked && up >= lockDistance) {
        lockedSV.value = 1
        isTakeSV.value = 0
        runOnJS(jsLock)()
      }
    },
    onFinalize: event => {
      if (isTakeSV.value === 0)
        return

      isTakeSV.value = 0

      // Interrupted by the system rather than released: lock the
      // take unless the cancel slide was already well under way.
      if (event.canceled) {
        if (slideProgress.value < LOCK_BLOCK_PROGRESS) {
          runOnJS(jsFinish)(true, false)
        } else {
          lockedSV.value = 1
          runOnJS(jsLock)()
        }
        return
      }

      runOnJS(jsFinish)(slideProgress.value < RELEASE_CANCEL_PROGRESS, false)
    },
  })

  const tapRef = useRef(onTap)
  tapRef.current = onTap
  const jsTap = () => {
    recordingHaptic()
    tapRef.current?.()
  }

  // A tap switches voice <-> video; the hold records. Race so whichever
  // recognizes first wins. With a single mode the press records at once.
  const hasTap = !!onTap
  const tapGesture = useTapGesture({
    enabled: hasTap,
    maxDuration: HOLD_DELAY_MS,
    onDeactivate: () => {
      runOnJS(jsTap)()
    },
  })
  const raceGesture = useCompetingGestures(tapGesture, panGesture)
  const gesture = hasTap ? raceGesture : panGesture

  // Hidden under the big circle while a take records, back once it has left.
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonShown.value,
    transform: [{ scale: 0.6 + 0.4 * buttonShown.value }],
  }))

  const micStyle = useAnimatedStyle(() => {
    const out = Math.min(1, modeSV.value * 2)
    return { opacity: 1 - out, transform: [{ scale: 1 - 0.9 * out }] }
  })
  const cameraStyle = useAnimatedStyle(() => {
    const into = Math.max(0, modeSV.value * 2 - 1)
    return { opacity: into, transform: [{ scale: 0.1 + 0.9 * into }] }
  })

  // `ControlsView`: the lock rises with the circle's entry curve, follows the
  // finger up 1:1, bobs while idle, and is 14 taller while it shows its arrow.
  const lockStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    const unlocked = 1 - pauseMorph.value
    const sc = entryCurve(enter.value)
    const scale = Math.max(0, sc * (1 - lockHide.value))
    return {
      height: LOCK_WIDTH + LOCK_EXTRA_HEIGHT * moveProgress * unlocked,
      opacity: scale > 0.01 ? 1 : 0,
      transform: [
        {
          translateY: LOCK_RISE * (1 - Math.min(1, sc)) + LOCK_RISE * lockHide.value -
            Math.min(lockDistance, fingerUp.value) - LOCK_BOB * bob.value * moveProgress * unlocked,
        },
        { scale },
      ],
    }
  })

  const padlockStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    const morph = pauseMorph.value
    const tilt = lockedSV.value > 0 ? lockTilt.value : 9 * (1 - moveProgress)
    return {
      opacity: 1 - morph,
      transform: [{ rotate: `${tilt}deg` }, { scale: 1 - 0.5 * morph }],
    }
  })

  const lockArrowStyle = useAnimatedStyle(() => {
    const moveProgress = 1 - Math.min(lockDistance, fingerUp.value) / lockDistance
    return { opacity: moveProgress * (1 - pauseMorph.value) }
  })

  const pauseIconStyle = useAnimatedStyle(() => ({
    opacity: pauseMorph.value,
    transform: [{ scale: 0.5 + 0.5 * pauseMorph.value }],
  }))

  const showSend = phase === 'locked' || phase === 'preview'
  const isCircleShown = isRecording || isCircleMounted
  // Locked without a pause (a round take in its last second): no pill at all.
  const showLock = isCircleShown && !(isLocked && !onPause)

  return (
    // Not collapsable: measured in the window for the send flight.
    <View ref={containerRef} collapsable={false} style={styles.container}>
      {isCircleShown && (
        <RecordCircle
          mode={mode}
          values={circle}
          slideDistance={slideDistance}
          cancelSign={cancelSign}
          flightColor={flightTarget?.color}
          flightIconColor={flightTarget?.iconColor}
        />
      )}

      {showLock && (
        <Animated.View style={[styles.lockPill, lockStyle]} pointerEvents={isLocked ? 'box-none' : 'none'}>
          <View style={styles.lockSlot}>
            <Animated.View style={padlockStyle}>
              <Icon name='lock' color={styles.lockColor.color} size={15} fallback={<LockIcon color={styles.lockColor.color} size={15} />} />
            </Animated.View>
            <Animated.View style={[styles.lockSlotOverlay, pauseIconStyle]}>
              <PauseIcon color={styles.lockColor.color} size={14} />
            </Animated.View>
          </View>
          <Animated.View style={lockArrowStyle}>
            <ChevronIcon color={styles.lockColor.color} size={12} direction='up' />
          </Animated.View>
          {/* Locked: the lock has become the pause button. */}
          {isLocked && onPause && (
            <Pressable
              onPress={() => {
                retirePauseHint()
                setIsPauseHintVisible(false)
                // A round take only reaches `preview` once its file is written,
                // so remember the reason rather than read it off the phase.
                exitReasonRef.current = 'preview'
                callbacksRef.current.onExit?.('preview')
                onPause()
              }}
              hitSlop={8}
              accessibilityRole='button'
              accessibilityLabel={isVideo ? 'pause video recording' : 'pause recording'}
              style={StyleSheet.absoluteFill}
            />
          )}
        </Animated.View>
      )}

      {phase === 'recording' && isLockHintVisible && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={[styles.tooltip, styles.lockTooltip]}
          pointerEvents='none'
        >
          <Text style={styles.tooltipText} numberOfLines={2}>{labels.slideUpToLock}</Text>
        </Animated.View>
      )}

      {/* The once hint takes the pause hint's place. */}
      {phase === 'locked' && isPauseHintVisible && !onceHint && (
        <View style={[styles.tooltip, styles.pauseTooltip]} pointerEvents='none'>
          <Text style={styles.tooltipText} numberOfLines={2}>{pauseHint}</Text>
        </View>
      )}

      {/* Previewing: the pause button turns into one that records on, its
          icon fading in as the bars fade out. It is
          drawn in the lock's own grey, not red. */}
      {phase === 'preview' && onResume && (
        <AnimatedPressable
          entering={FadeIn.duration(RESUME_FADE_MS)}
          onPress={() => {
            recordingHaptic()
            onResume()
          }}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={isVideo ? 'resume video recording' : 'resume recording'}
          style={styles.resumeButton}
        >
          {isVideo
            ? <Icon name='camera' color={styles.lockColor.color} size={18} fallback={<CameraIcon color={styles.lockColor.color} size={18} />} />
            : <Icon name='mic' color={styles.lockColor.color} size={18} fallback={<MicIcon color={styles.lockColor.color} size={18} />} />}
        </AnimatedPressable>
      )}

      {/* View-once: scales in above the lock once the take snaps locked
          (`snapAnimationProgress`), "1" in a circle, filled while on. */}
      {hasOnce && (
        <AnimatedPressable
          key={phase}
          entering={ZoomIn.duration(250).easing(EASE_OUT_QUINT)}
          exiting={ZoomOut.duration(150)}
          onPress={toggleOnce}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel={isViewOnce ? labels.deactivateViewOnce : labels.activateViewOnce}
          accessibilityState={{ selected: isViewOnce }}
          style={[styles.onceButton, phase === 'preview' ? styles.oncePreview : styles.onceLocked]}
        >
          <View style={[styles.onceBadge, isViewOnce && styles.onceBadgeOn]}>
            <Text style={[styles.onceText, isViewOnce && styles.onceTextOn]}>1</Text>
          </View>
        </AnimatedPressable>
      )}

      {hasOnce && !!onceHint && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={[styles.tooltip, phase === 'preview' ? styles.onceTooltipPreview : styles.onceTooltip]}
          pointerEvents='none'
        >
          <Text style={styles.tooltipText} numberOfLines={3}>{renderBold(onceHint, styles.tooltipBold)}</Text>
        </Animated.View>
      )}

      {phase === 'idle' && !!hint && (
        <View style={[styles.tooltip, styles.hintTooltip]} pointerEvents='none'>
          <Text style={styles.tooltipText}>{hint}</Text>
        </View>
      )}

      {showSend
        ? (
          // Locked, the big circle drawn over this is the send button; the
          // touch stays on the 36pt button so it never leaves the composer.
          <Pressable
            onPress={() => {
              recordingHaptic()
              exitReasonRef.current = 'send'
              // A previewed take's circle is already gone, so only a locked
              // one flies.
              if (isVoice && phase === 'locked')
                expectSendFlight('voice')
              callbacksRef.current.onExit?.('send')
              onSend()
            }}
            accessibilityRole='button'
            accessibilityLabel={isVideo ? 'send video message' : 'send voice message'}
            style={styles.button}
          >
            <Icon name='send' color='#fff' size={20} fallback={<SendIcon color='#fff' size={20} />} />
          </Pressable>
        )
        : (
          <GestureDetector gesture={gesture}>
            <Animated.View
              accessibilityRole='button'
              accessibilityLabel={isVideo ? 'record video message' : 'record voice message'}
              style={[styles.button, buttonStyle]}
            >
              <Animated.View style={[styles.modeIcon, micStyle]}>
                <Icon name='mic' color='#fff' size={22} fallback={<MicIcon color='#fff' size={22} />} />
              </Animated.View>
              <Animated.View style={[styles.modeIcon, cameraStyle]}>
                <Icon name='camera' color='#fff' size={22} fallback={<CameraIcon color='#fff' size={22} />} />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}
    </View>
  )
}

/** Hints mark their bold part with `**`. */
function renderBold (text: string, boldStyle: object) {
  return text.split('**').map((part, index) =>
    index % 2 === 1
      ? <Text key={index} style={boldStyle}>{part}</Text>
      : part
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  container: {
    // Matches Send's wrapper so the mic and the send button share a baseline -
    // otherwise the control jumps 4pt the moment the first character is typed.
    minHeight: theme.composer.minHeight,
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
  modeIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockPill: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -LOCK_WIDTH / 2,
    marginTop: -LOCK_OFFSET,
    width: LOCK_WIDTH,
    borderRadius: LOCK_WIDTH / 2,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 4,
  },
  // The top 36pt of the pill: the padlock, later the pause bars.
  lockSlot: {
    width: LOCK_WIDTH,
    height: LOCK_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockSlotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButton: {
    position: 'absolute',
    bottom: theme.sendButton.size + 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  lockColor: {
    color: theme.colors.placeholder,
  },
  onceButton: {
    position: 'absolute',
    width: ONCE_SIZE,
    height: ONCE_SIZE,
    borderRadius: ONCE_SIZE / 2,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.inputFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  // Above the lock pill, which is 36 tall once locked.
  onceLocked: {
    top: '50%',
    marginTop: -LOCK_OFFSET - ONCE_GAP - ONCE_SIZE,
  },
  // Previewing, above the resume button.
  oncePreview: {
    bottom: theme.sendButton.size + 12 + 34 + ONCE_GAP,
  },
  onceBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onceBadgeOn: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  onceText: {
    color: theme.colors.placeholder,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  onceTextOn: {
    color: '#fff',
  },
  tooltip: {
    position: 'absolute',
    right: 0,
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 5,
  },
  // Beside the lock, pointing at it.
  lockTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET + 6,
    right: 44,
    width: 160,
  },
  pauseTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET,
    right: 44,
    width: 160,
  },
  onceTooltip: {
    top: '50%',
    marginTop: -LOCK_OFFSET - ONCE_GAP - ONCE_SIZE,
    right: 44,
    width: 180,
  },
  onceTooltipPreview: {
    bottom: theme.sendButton.size + 12 + 34 + ONCE_GAP,
    right: 44,
    width: 180,
  },
  tooltipBold: {
    fontWeight: '700',
  },
  hintTooltip: {
    bottom: theme.sendButton.size + 10,
    width: 240,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 13,
  },
})
