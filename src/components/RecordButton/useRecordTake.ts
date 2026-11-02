import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import {
  Easing,
  ReduceMotion,
  SharedValue,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { Store } from '../../store'
import {
  EXIT_GESTURE,
  EXIT_NONE,
  EXIT_PREVIEW,
  EXIT_RELEASE,
  levelToAmplitude,
  useRecordCircleValues,
} from '../RecordCircle'
import { VoiceFlightTarget } from '../sendFlight'
import { DECELERATE, EASE_OUT_QUINT, LOCK_BOB_HALF_MS } from './constants'
import { RecordButtonPhase, TakeExitReason } from './types'
import { useSendFlight } from './useSendFlight'

interface RecordTakeOptions {
  mode: 'voice' | 'video'
  phase: RecordButtonPhase
  levelStore?: Store<number>
  isCapturing: boolean
  slideProgressValue?: SharedValue<number>
  cancelSign: number
  slideDistance: number
  /** The button's container, measured in the window for the send flight. */
  containerRef: React.RefObject<React.ComponentRef<typeof View> | null>
}

/**
 * A take's life on screen: the circle and lock enter when it starts recording,
 * morph when it locks, and play the exit that matches how it ended - back into
 * the button, into the preview, collapsing, or flying to the sent message.
 */
export function useRecordTake ({
  mode,
  phase,
  levelStore,
  isCapturing,
  slideProgressValue,
  cancelSign,
  slideDistance,
  containerRef,
}: RecordTakeOptions) {
  const isVoice = mode === 'voice'

  const circle = useRecordCircleValues()
  const { enter, slide: slideProgress, exit, exitKind, sendMorph, showWaves, flight } = circle
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

  // How the take in progress ended, as far as this button saw it; anything
  // else (the bar's CANCEL, a time limit) leaves it null.
  const exitReasonRef = useRef<TakeExitReason>(null)

  // Each new level moves the circle straight from the store, ten times a second, without
  // re-rendering the button.
  useEffect(() => {
    const isLive = phase === 'recording' || phase === 'locked'
    const apply = () => circle.amplitude.set(isLive && levelStore ? levelToAmplitude(levelStore.get()) : 0)
    apply()
    return isLive && levelStore ? levelStore.subscribe(apply) : undefined
  }, [phase, levelStore, circle.amplitude])

  useEffect(() => {
    showWaves.set(isCapturing ? 1 : 0)
  }, [isCapturing, showWaves])

  const isLocked = phase === 'locked'
  const isRecording = phase === 'recording' || phase === 'locked'

  // The circle stays mounted after the take ends until its exit has played.
  const [isCircleMounted, setIsCircleMounted] = useState(false)
  const wasRecordingRef = useRef(false)
  const exitDoneRef = useRef(() => {})

  const [flightTarget, setFlightTarget] = useState<VoiceFlightTarget | null>(null)

  useLayoutEffect(() => {
    exitDoneRef.current = () => {
      setIsCircleMounted(false)
      setFlightTarget(null)
      // Back to the start, so the next take's first frame is not this one's last.
      enter.set(0)
      slideProgress.set(1)
      fingerUp.set(0)
      lockedSV.set(0)
      flight.set(0)
      buttonShown.set(withTiming(1, { duration: 150, reduceMotion: ReduceMotion.System }))
    }
  })
  const { startFlightRef, flightCleanupRef, flightTimerRef } = useSendFlight({
    containerRef,
    setFlightTarget,
    exitDoneRef,
    circle,
    cancelSign,
    slideDistance,
  })

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
      flight.set(0)
      cancelAnimation(exit)
      cancelAnimation(slideProgress)
      exit.set(0)
      exitKind.set(EXIT_NONE)
      slideProgress.set(1)
      lastReported.set(1)
      if (slideProgressValue)
        slideProgressValue.set(1)
      fingerUp.set(0)
      lockedSV.set(0)
      lockHide.set(0)
      lockHideTarget.set(0)
      lockTilt.set(0)
      pauseMorph.set(0)
      sendMorph.set(0)
      circle.state.set(null)
      buttonShown.set(0)
      enter.set(0)
      enter.set(withTiming(1, { duration: 300, easing: DECELERATE }))
      bob.set(0)
      bob.set(withRepeat(
        withTiming(1, { duration: LOCK_BOB_HALF_MS, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
        -1,
        true
      ))
      setIsCircleMounted(true)
      return
    }

    if (!wasRecordingRef.current)
      return

    wasRecordingRef.current = false
    cancelAnimation(bob)
    lockHide.set(withTiming(1, { duration: 140 }))
    const reason = phase === 'preview' ? 'preview' : exitReasonRef.current ?? 'cancel'
    exitReasonRef.current = null
    const jsExitDone = () => exitDoneRef.current()
    const onDone = (finished?: boolean) => {
      'worklet'
      if (finished)
        runOnJS(jsExitDone)()
    }

    // Slid all the way: the circle springs back into the button, shrinking.
    if (reason === 'gesture') {
      exitKind.set(EXIT_GESTURE)
      slideProgress.set(withTiming(1, { duration: 200 }, onDone))
      return
    }

    // Paused: swell, shrink to a dot, fade into the preview
    // (`transformToSeekbar`, 580ms voice / 490ms video).
    if (reason === 'preview') {
      exitKind.set(EXIT_PREVIEW)
      exit.set(withTiming(1, { duration: isVoice ? 580 : 490, easing: Easing.linear }, onDone))
      return
    }

    const playRelease = () => {
      exitKind.set(EXIT_RELEASE)
      exit.set(withTiming(1, { duration: 360, easing: Easing.linear }, onDone))
    }

    // A sent voice take holds still until its message lands, then flies there.
    if (reason === 'send' && isVoice) {
      startFlightRef.current(playRelease)
      return
    }

    playRelease()
  }, [
    isRecording, phase, isVoice, circle.state, slideProgressValue,
    bob, buttonShown, enter, exit, exitKind, fingerUp, flight, lastReported,
    lockHide, lockHideTarget, lockTilt, lockedSV, pauseMorph, sendMorph, slideProgress,
    flightCleanupRef, flightTimerRef, startFlightRef,
  ])

  // Locked: the mic turns into the send arrow, the lock into pause, and the
  // padlock snaps to -15deg and back.
  useEffect(() => {
    if (!isLocked)
      return

    lockedSV.set(1)
    sendMorph.set(withTiming(1, { duration: 150, easing: Easing.linear }))
    pauseMorph.set(withTiming(1, { duration: 250, easing: EASE_OUT_QUINT }))
    fingerUp.set(withTiming(0, { duration: 250, easing: EASE_OUT_QUINT }))
    lockTilt.set(withSequence(
      withTiming(-15, { duration: 250, easing: EASE_OUT_QUINT }),
      withDelay(100, withTiming(0, { duration: 350, easing: EASE_OUT_QUINT }))
    ))
  }, [isLocked, lockedSV, sendMorph, pauseMorph, fingerUp, lockTilt])

  return {
    circle,
    fingerUp,
    lockedSV,
    isTakeSV,
    lockHide,
    lockHideTarget,
    lockTilt,
    pauseMorph,
    bob,
    lastReported,
    buttonShown,
    exitReasonRef,
    flightTarget,
    isCircleMounted,
    isRecording,
  }
}
