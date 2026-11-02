import { SharedValue } from 'react-native-reanimated'

import { AudioRecordingProps, IMessage } from '../../Models'
import { RecordExitReason } from '../RecordButton'

/** A paused take, waiting to be replayed, trimmed, resumed, sent or deleted. */
export interface VoiceRecordingPreview {
  uri: string
  durationMs: number
  /** Microphone amplitudes over the whole take, 0..1, for the waveform. */
  levels: number[]
  /** The take can be cut down before it is sent or resumed. */
  isTrimmable: boolean
}

/** Live recording state surfaced to the InputToolbar so it can render the bar. */
export interface VoiceRecordingState {
  active: boolean
  locked: boolean
  elapsed: number
  /** Released here, the take would be cancelled. */
  cancelArmed: boolean
  /**
   * Recent microphone amplitudes, 0..1, oldest first.
   */
  levels: number[]
  /** Set while a paused take is shown for review instead of recording. */
  preview?: VoiceRecordingPreview | null
}

/** A release that landed before the recorder finished starting up. */
export type PendingFinish = { cancelled: boolean } | null

export interface VoiceMessageInputHandle {
  /** Discard the in-progress or paused take (the bar's CANCEL / delete). */
  cancel: () => void
  /** The paused take's kept range, as fractions of it (the preview's trim handles). */
  trim: (start: number, end: number) => void
}

export interface VoiceMessageInputProps {
  config?: AudioRecordingProps
  onSend?: (
    message: Partial<IMessage>,
    shouldResetInputToolbar: boolean
  ) => void
  /** Reports recording state up so the toolbar can draw the timer/cancel bar. */
  onStateChange?: (state: VoiceRecordingState) => void
  /**
   * Single tap on the mic. When provided, the control switches to tap-to-toggle
   * (voice <-> video) and only records once the press is held.
   */
  onTap?: () => void
  /** Tooltip shown above the idle button, e.g. after a mode switch. */
  hint?: string | null
  /** A take released within 100ms of starting - a tap rather than a hold. */
  onQuickRelease?: () => void
  /** The cancel slide's progress on the UI thread, for the toolbar's bar. */
  slideProgressValue?: SharedValue<number>
  /** How the record button ended the take, so the bar can animate out to match. */
  onExit?: (reason: RecordExitReason) => void
}
