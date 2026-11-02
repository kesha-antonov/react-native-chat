import { Easing } from 'react-native-reanimated'

/** The resume icon fades in as the pause bars fade out (`transformToResume`). */
export const RESUME_FADE_MS = 200

/**
 * Releasing past this share of the slide distance cancels.
 */
export const RELEASE_CANCEL_PROGRESS = 0.45
/**
 * Locking is refused once the cancel slide is past 30% of its distance, and a
 * take the system interrupts is cancelled past the same point instead of
 * locked (`slideToCancelProgress < 0.7f`).
 */
export const LOCK_BLOCK_PROGRESS = 0.7
/** "Slide up to lock" goes once the cancel slide passes 20%. */
export const LOCK_HINT_HIDE_PROGRESS = 0.8
/** Share of the window width the slide distance is capped at (`distCanMove`). */
export const SLIDE_WIDTH_SHARE = 0.35
/** Hold before recording starts when a tap switches modes (`recordAudioVideoRunnable`, 150ms). */
export const HOLD_DELAY_MS = 150
/**
 * A take released sooner than this was a tap, not a hold, and shows
 * the "Hold to record" hint.
 */
export const QUICK_RELEASE_MS = 100
/** How long "Pause to trim or replay" stays up. */
export const PAUSE_HINT_MS = 3500
/** The lock hint waits for the finger to stay down this long. */
export const LOCK_HINT_DELAY_MS = 200
/** How long a view-once tooltip stays up. */
export const ONCE_HINT_MS = 3500
/**
 * "Tap to set this message to Play Once" shows on the first three locks
 * (`voiceoncehint < 3`); counted per app session, like the other hints.
 */
export const ONCE_HINT_LIMIT = 3

/** The view-once button: 36 round, 12 above the lock (`onceRect`, `onceOffset`). */
export const ONCE_SIZE = 36
export const ONCE_GAP = 12

/** The lock pill: 36 wide, 14 taller while it still shows the arrow (`ControlsView`). */
export const LOCK_WIDTH = 36
export const LOCK_EXTRA_HEIGHT = 14
/** Its top sits 110 above the circle's centre at rest (lock y=60, circle cy=170). */
export const LOCK_OFFSET = 110
/** It rises this far into place, and drops as far when the cancel slide hides it. */
export const LOCK_RISE = 72
/** Idle bob amplitude and half-cycle. */
export const LOCK_BOB = 8
export const LOCK_BOB_HALF_MS = 850

/** The 300ms entry scale of the circle (`DecelerateInterpolator`). */
export const DECELERATE = Easing.out(Easing.quad)
/** Ease-out quint. */
export const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
