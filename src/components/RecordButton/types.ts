import { SharedValue } from 'react-native-reanimated'

import { Store } from '../../store'

/** Where a take is: what the button shows and which gestures it accepts. */
export type RecordButtonPhase = 'idle' | 'recording' | 'locked' | 'preview'

/** How a take left the button: drives the circle's exit and the bar's. */
export type RecordExitReason = 'send' | 'cancel' | 'preview'

/**
 * How the take in progress ended, as far as the button saw it; anything else
 * (the bar's CANCEL, a time limit) leaves it null.
 */
export type TakeExitReason = 'send' | 'cancel' | 'gesture' | 'preview' | null

export interface RecordButtonProps {
  mode: 'voice' | 'video'
  phase: RecordButtonPhase
  /** Microphone loudness, 0..1, for the circle and its blobs; read without a render. */
  levelStore?: Store<number>
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

/** The callers' callbacks the gesture and the controls read through a ref. */
export type RecordCallbacks = Pick<RecordButtonProps, 'onStart' | 'onFinish' | 'onLock' | 'onSlideProgress' | 'onQuickRelease' | 'onExit'>
