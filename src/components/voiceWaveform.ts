/**
 * Geometry and formatting shared by the voice-note players.
 */

/** The play/pause circle is 44x44. */
export const VOICE_BUTTON_SIZE = 44
/** The waveform area is 30 tall. */
export const WAVEFORM_HEIGHT = 30
/** Each bar is a 2-wide stroke, one every 3, so a 1 gap. */
export const BAR_WIDTH = 2
export const BAR_STEP = 3
/** Waveform levels are 5-bit samples. */
export const LEVEL_MAX = 31
/** A full-level bar reaches 7 either side of the centre line. */
export const BAR_HALF_MAX = 7
/** A 0.2cm drag slop, in points. */
export const DRAG_SLOP = 8
/** Gap between the button and the waveform/time column. */
export const VOICE_COLUMN_GAP = 10
/** Bubble content width before the time label is added (`174 + timeWidth`). */
export const VOICE_BASE_WIDTH = 174
export const VOICE_TIME_FONT_SIZE = 12
/**
 * Space above and below the button. A voice cell is 70 tall with the button
 * 44 across, 13 from the top, which leaves about 12 inside the bubble on
 * either side once its 1dp outer margins are taken off.
 */
export const VOICE_ROW_PADDING_V = 12
/**
 * A voice bubble is widened by the message's own time as well
 * (174 + time width + duration width), since the
 * time shares the duration's line at the bubble's bottom-right. `timeWidth`
 * is the `h:mm a` label, plus 20dp for the ticks on an outgoing note.
 */
export const VOICE_META_WIDTH = 48
export const VOICE_META_TICKS_WIDTH = 20
/**
 * Height the bubble's time takes below content it cannot sit beside - an
 * open transcription, or the fallback card - so it never covers it.
 */
export const VOICE_META_HEIGHT = 20

/**
 * Zero-padded `00:12`, and `h:mm:ss` once a
 * note runs past an hour.
 */
export const formatVoiceDuration = (seconds: number) => {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor(total / 60) % 60
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * Width the time label takes, estimated from the string rather than measured:
 * the label changes every second while playing, and measuring it would re-lay
 * the bubble out on each tick. Digits are tabular, so the estimate holds.
 */
export const estimateTimeWidth = (label: string) =>
  Math.ceil(label.length * VOICE_TIME_FONT_SIZE * 0.6)

/**
 * A voice bubble is sized from a constant plus the time labels, not
 * from the note's length, so a 2s and a 2min note are equally wide.
 */
export const voiceContentWidth = (durationSeconds: number, isOutgoing = false) =>
  VOICE_BASE_WIDTH + estimateTimeWidth(formatVoiceDuration(durationSeconds))
  + VOICE_META_WIDTH + (isOutgoing ? VOICE_META_TICKS_WIDTH : 0)

/**
 * The transcribe button: a 30x24 rounded rect, radius 8, and the
 * waveform gives up 34 of its width to it - the bubble itself stays as wide.
 */
export const TRANSCRIBE_BUTTON_WIDTH = 30
export const TRANSCRIBE_BUTTON_HEIGHT = 24
export const TRANSCRIBE_BUTTON_RADIUS = 8
export const TRANSCRIBE_SLOT_WIDTH = 34

/**
 * Width left for the waveform inside a voice bubble of `contentWidth`, after
 * the row padding, the play button, the gap and, when shown, the transcribe
 * button's slot.
 */
export const voiceTrackWidth = (
  contentWidth: number,
  rowPaddingH: number,
  hasTranscribeButton: boolean
) =>
  Math.max(
    0,
    contentWidth - 2 * rowPaddingH - VOICE_BUTTON_SIZE - VOICE_COLUMN_GAP
      - (hasTranscribeButton ? TRANSCRIBE_SLOT_WIDTH : 0)
  )

/**
 * Where the view-once badge sits: centred 22.6274
 * from the play button's centre at 45 degrees, i.e. 16 right and 16 down, a
 * 10-radius disc with a 1.5 ring cut out of the button around it, holding a
 * 14-across "1".
 */
export const VIEW_ONCE_BADGE_OFFSET = 16
export const VIEW_ONCE_BADGE_SIZE = 20
export const VIEW_ONCE_BADGE_CUT = 1.5
export const VIEW_ONCE_RING_SIZE = 14

/** One bar per 3 points of track. */
export const barCountForWidth = (width: number) =>
  width > 0 ? Math.max(1, Math.floor((width + (BAR_STEP - BAR_WIDTH)) / BAR_STEP)) : 0

/**
 * Bar height for a level in 0..1. Quantised to 5-bit 0..31, scaled
 * to 0..7 each side of the centre line, plus the 1-point round caps, so a bar
 * runs 2..16 tall. The loudest bar is deliberately not stretched to the full
 * area: no normalising, so a quiet note looks quiet.
 */
export const barHeight = (level: number) => {
  const clamped = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0
  const quantised = Math.round(clamped * LEVEL_MAX)
  const half = (BAR_HALF_MAX * quantised) / LEVEL_MAX
  return half * 2 + BAR_WIDTH
}

/**
 * Buckets decoded samples into `count` levels in 0..1, using each bucket's
 * peak amplitude. Levels are absolute (0..1 of full scale), never rescaled
 * against the loudest bucket.
 */
export const levelsFromSamples = (data: ArrayLike<number>, count: number) => {
  if (count <= 0 || !data.length)
    return []

  const block = data.length / count
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * block)
    const end = Math.max(start + 1, Math.floor((i + 1) * block))
    let peak = 0
    for (let j = start; j < end && j < data.length; j++) {
      const v = Math.abs(data[j] || 0)
      if (v > peak)
        peak = v
    }
    out.push(Math.min(1, peak))
  }
  return out
}

/**
 * `IMessage.waveform` resampled to `count` bars: levels in 0..1, or 5-bit 0..31
 * values (read on that scale when any is above 1).
 */
export const levelsFromWaveform = (waveform: ArrayLike<number> | undefined, count: number) => {
  if (!waveform?.length || count <= 0)
    return []

  let max = 0
  for (let i = 0; i < waveform.length; i++)
    max = Math.max(max, waveform[i] || 0)
  const scale = max > 1 ? LEVEL_MAX : 1
  const normalized = Array.from(waveform, value => Math.max(0, (value || 0) / scale))
  if (normalized.length >= count)
    return levelsFromSamples(normalized, count)

  // Fewer values than bars: each value covers several bars.
  return Array.from({ length: count }, (_, i) => Math.min(1, normalized[Math.floor((i * normalized.length) / count)]))
}

/**
 * The bar-growth animation runs only on a note that has
 * just been sent from this device. We approximate "just sent" as an outgoing
 * message created in the last couple of seconds.
 */
export const FRESH_NOTE_MS = 2000

export const isFreshOutgoingNote = (
  position: 'left' | 'right',
  createdAt: Date | number | undefined,
  now = Date.now()
) => {
  if (position !== 'right' || createdAt == null)
    return false

  const created = typeof createdAt === 'number' ? createdAt : createdAt.getTime?.()
  if (created == null || !Number.isFinite(created))
    return false

  const age = now - created
  return age >= -FRESH_NOTE_MS && age <= FRESH_NOTE_MS
}
