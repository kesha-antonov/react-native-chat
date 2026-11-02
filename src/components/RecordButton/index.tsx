import React, { useLayoutEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'

import { useIsRTL } from '../../hooks/useIsRTL'
import { useLabels } from '../../hooks/useLabels'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { Icon } from '../Icon'
import { RecordCircle } from '../RecordCircle'
import { recordingHaptic, retirePauseHint } from '../recordingFeedback'
import { expectSendFlight } from '../sendFlight'
import { SendIcon } from '../SendIcon'
import { LockPill } from './LockPill'
import { ModeButton, useModeMorph } from './ModeButton'
import { ResumeButton } from './ResumeButton'
import { createStyles } from './styles'
import { IdleTooltip, LockTooltip, OnceTooltip, PauseTooltip } from './Tooltips'
import { RecordButtonProps } from './types'
import { useRecordGesture } from './useRecordGesture'
import { useRecordHints } from './useRecordHints'
import { useRecordSlideDistance } from './useRecordSlideDistance'
import { useRecordTake } from './useRecordTake'
import { ViewOnceButton } from './ViewOnceButton'

export type { RecordButtonPhase, RecordButtonProps, RecordExitReason } from './types'
export { useRecordSlideDistance } from './useRecordSlideDistance'

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
  levelStore,
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

  // Callbacks read through refs: the gesture must not be rebuilt mid-hold,
  // and the callers' identities change with every timer tick.
  const callbacksRef = useRef({ onStart, onFinish, onLock, onSlideProgress, onQuickRelease, onExit })
  useLayoutEffect(() => {
    callbacksRef.current = { onStart, onFinish, onLock, onSlideProgress, onQuickRelease, onExit }
  })

  const modeSV = useModeMorph(mode)
  const containerRef = useRef<React.ComponentRef<typeof View>>(null)
  const {
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
  } = useRecordTake({ mode, phase, levelStore, isCapturing, slideProgressValue, cancelSign, slideDistance, containerRef })
  const isLocked = phase === 'locked'

  const {
    isLockHintVisible,
    setIsLockHintVisible,
    isPauseHintVisible,
    setIsPauseHintVisible,
    hasOnce,
    onceHint,
    toggleOnce,
  } = useRecordHints({ phase, isVideo, pauseHint, onPause, onToggleViewOnce, isViewOnce, lastReported })

  const gesture = useRecordGesture({
    onTap,
    isVoice,
    cancelSign,
    slideDistance,
    lockDistance,
    slideProgress: circle.slide,
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
  })

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
        <LockPill
          lockDistance={lockDistance}
          fingerUp={fingerUp}
          pauseMorph={pauseMorph}
          enter={circle.enter}
          lockHide={lockHide}
          bob={bob}
          lockedSV={lockedSV}
          lockTilt={lockTilt}
          isLocked={isLocked}
          isVideo={isVideo}
          onPause={onPause && (() => {
            retirePauseHint()
            setIsPauseHintVisible(false)
            // A round take only reaches `preview` once its file is written,
            // so remember the reason rather than read it off the phase.
            exitReasonRef.current = 'preview'
            callbacksRef.current.onExit?.('preview')
            onPause()
          })}
          styles={styles}
        />
      )}

      {phase === 'recording' && isLockHintVisible && (
        <LockTooltip text={labels.slideUpToLock} styles={styles} />
      )}

      {/* The once hint takes the pause hint's place. */}
      {phase === 'locked' && isPauseHintVisible && !onceHint && (
        <PauseTooltip text={pauseHint} styles={styles} />
      )}

      {phase === 'preview' && onResume && (
        <ResumeButton isVideo={isVideo} onResume={onResume} styles={styles} />
      )}

      {hasOnce && (
        <ViewOnceButton key={phase} phase={phase} isViewOnce={isViewOnce} onPress={toggleOnce} styles={styles} />
      )}

      {hasOnce && !!onceHint && (
        <OnceTooltip text={onceHint} isPreview={phase === 'preview'} styles={styles} />
      )}

      {phase === 'idle' && !!hint && (
        <IdleTooltip text={hint} styles={styles} />
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
        : <ModeButton gesture={gesture} buttonShown={buttonShown} modeSV={modeSV} isVideo={isVideo} styles={styles} />}
    </View>
  )
}
