/*
 * Small pieces of Telegram's recording behavior that live outside any one
 * component: the haptic tick, the per-session hint counters and the
 * remembered voice / video choice.
 */

import { impactHaptic } from './haptics'

/**
 * Telegram's only recording haptic is `HapticFeedbackConstants.KEYBOARD_TAP`
 * (record start and stop, lock, the tap that switches voice / video, video
 * start and resume), so a single light tick covers all of them.
 */
export const recordingHaptic = () => impactHaptic('Light')

/**
 * Telegram shows "Slide up to lock" for the first three takes and never again
 * once the user has locked one (`SharedConfig.lockRecordAudioVideoHint`). The
 * library has no storage of its own, so the count lasts for the app session.
 */
const LOCK_HINT_LIMIT = 3
let lockHintCount = 0

export const shouldShowLockHint = () => lockHintCount < LOCK_HINT_LIMIT

export const countLockHint = () => {
  lockHintCount++
}

export const retireLockHint = () => {
  lockHintCount = LOCK_HINT_LIMIT
}

/**
 * "Pause to trim or replay" by the pause button of a locked voice take, for
 * the first few locks (`showPauseHint`, `voicepausehint`); a pause retires it.
 */
const PAUSE_HINT_LIMIT = 3
let pauseHintCount = 0

export const shouldShowPauseHint = () => pauseHintCount < PAUSE_HINT_LIMIT

export const countPauseHint = () => {
  pauseHintCount++
}

export const retirePauseHint = () => {
  pauseHintCount = PAUSE_HINT_LIMIT
}

/**
 * Resuming a trimmed take throws the cut audio away, so Telegram asks first,
 * once (`trimvoicehint`).
 */
let isTrimOnResumeConfirmed = false

export const shouldConfirmTrimOnResume = () => !isTrimOnResumeConfirmed

export const confirmTrimOnResume = () => {
  isTrimOnResumeConfirmed = true
}

/**
 * The voice / video choice of the shared record button. Telegram keeps it in
 * its preferences (`currentModeVideo`, voice by default); here it lasts for
 * the app session, so every chat opens on the mode used last.
 */
let lastRecordMode: 'voice' | 'video' = 'voice'

export const getLastRecordMode = () => lastRecordMode

export const setLastRecordMode = (mode: 'voice' | 'video') => {
  lastRecordMode = mode
}

/**
 * `m:ss,t` with tenths, Telegram's recording timer
 * (`AndroidUtilities.formatTimerDurationFast`) - the moving decimal is what
 * tells you the recorder is live.
 */
export const formatRecordingTime = (ms: number) => {
  const tenthsTotal = Math.max(0, Math.floor(ms / 100))
  const tenths = tenthsTotal % 10
  const totalSeconds = Math.floor(tenthsTotal / 10)
  const secs = totalSeconds % 60
  const mins = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const mm = hours > 0 ? mins.toString().padStart(2, '0') : String(mins)
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${secs.toString().padStart(2, '0')},${tenths}`
}
