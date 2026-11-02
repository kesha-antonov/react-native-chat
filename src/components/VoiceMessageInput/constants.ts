import { VoiceRecordingState } from './types'

/** How many amplitude samples the live halo history keeps. */
export const LEVEL_HISTORY = 48
/** Metering floor in dB; anything quieter reads as silence. */
export const METERING_FLOOR_DB = -60
/** A voice take of 700ms or less is dropped. */
export const DEFAULT_MIN_DURATION_MS = 700
/**
 * A clip recorded after a resume and stopped at once has nothing worth
 * keeping, and an all but empty file can fail the join.
 */
export const MIN_CLIP_MS = 200
/** Releasing past this share of the cancel slide cancels (matches `RecordButton`). */
export const CANCEL_ARMED_PROGRESS = 0.45

export const IDLE_STATE: VoiceRecordingState = {
  active: false, locked: false, elapsed: 0, cancelArmed: false, levels: [], preview: null,
}
