import React, { useLayoutEffect, useRef } from 'react'
import { useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import { SharedValue, runOnJS, withTiming } from 'react-native-reanimated'

import { recordingHaptic, retireLockHint } from '../recordingFeedback'
import { expectSendFlight } from '../sendFlight'
import {
  HOLD_DELAY_MS,
  LOCK_BLOCK_PROGRESS,
  LOCK_HINT_HIDE_PROGRESS,
  QUICK_RELEASE_MS,
  RELEASE_CANCEL_PROGRESS,
} from './constants'
import { RecordCallbacks, TakeExitReason } from './types'

interface RecordGestureOptions {
  onTap?: () => void
  isVoice: boolean
  cancelSign: number
  slideDistance: number
  lockDistance: number
  slideProgress: SharedValue<number>
  slideProgressValue?: SharedValue<number>
  fingerUp: SharedValue<number>
  lockedSV: SharedValue<number>
  isTakeSV: SharedValue<number>
  lockHide: SharedValue<number>
  lockHideTarget: SharedValue<number>
  lastReported: SharedValue<number>
  callbacksRef: React.RefObject<RecordCallbacks>
  exitReasonRef: React.RefObject<TakeExitReason>
  setIsLockHintVisible: (isVisible: boolean) => void
}

/**
 * The hold: a pan that becomes a take, slides to cancel and up to lock, raced
 * against a tap that switches modes when the button has two.
 */
export function useRecordGesture ({
  onTap,
  isVoice,
  cancelSign,
  slideDistance,
  lockDistance,
  slideProgress,
  slideProgressValue,
  fingerUp,
  lockedSV,
  isTakeSV,
  lockHide,
  lockHideTarget,
  lastReported,
  callbacksRef,
  exitReasonRef,
  setIsLockHintVisible,
}: RecordGestureOptions) {
  const startedAtRef = useRef(0)

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
      isTakeSV.set(1)
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
      slideProgress.set(progress)
      if (slideProgressValue)
        slideProgressValue.set(progress)
      if (Math.abs(progress - lastReported.value) > 0.01 || progress === 0) {
        lastReported.set(progress)
        runOnJS(jsSlideProgress)(progress)
      }

      // All the way across: cancel now, before the finger lifts.
      if (progress <= 0) {
        isTakeSV.set(0)
        runOnJS(jsFinish)(true, true)
        return
      }

      // Lock and cancel exclude each other: no lock once the slide is past 30%.
      const isBlocked = progress < LOCK_BLOCK_PROGRESS ? 1 : 0
      if (isBlocked !== lockHideTarget.value) {
        lockHideTarget.set(isBlocked)
        lockHide.set(withTiming(isBlocked, { duration: 140 }))
      }
      fingerUp.set(isBlocked ? 0 : up)

      if (!isBlocked && up >= lockDistance) {
        lockedSV.set(1)
        isTakeSV.set(0)
        runOnJS(jsLock)()
      }
    },
    onFinalize: event => {
      if (isTakeSV.value === 0)
        return

      isTakeSV.set(0)

      // Interrupted by the system rather than released: lock the
      // take unless the cancel slide was already well under way.
      if (event.canceled) {
        if (slideProgress.value < LOCK_BLOCK_PROGRESS) {
          runOnJS(jsFinish)(true, false)
        } else {
          lockedSV.set(1)
          runOnJS(jsLock)()
        }
        return
      }

      runOnJS(jsFinish)(slideProgress.value < RELEASE_CANCEL_PROGRESS, false)
    },
  })

  const tapRef = useRef(onTap)
  useLayoutEffect(() => {
    tapRef.current = onTap
  })
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
  return hasTap ? raceGesture : panGesture
}
