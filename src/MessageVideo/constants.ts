// A round note is sized from the screen: 60% of its short side at rest, and
// all of it but 28pt while it plays with sound.
export const NOTE_SIZE_RATIO = 0.6
export const PLAYING_NOTE_INSET = 28
/** Centre the note once it has grown, so the list scrolls to its final size. */
export const NOTE_CENTRE_DELAY_MS = 260
/** Seeks while dragging the ring are throttled to one per 100ms. */
export const SEEK_THROTTLE_MS = 100
/** How often a playing note checks the player's real position. */
export const PROGRESS_SYNC_MS = 250
/** The transcription opens with the cell's height change, about 220ms. */
export const TRANSCRIPTION_OPEN_MS = 220
export const TRANSCRIPTION_GAP = 4
export const TRANSCRIPTION_PADDING_TOP = 6
