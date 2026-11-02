/** Bars drawn for a paused take, resampled from its full amplitude history. */
export const PREVIEW_BARS = 40

export const resample = (values: number[], count: number) => {
  if (!values.length)
    return new Array(count).fill(0.1)

  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i / count) * values.length)
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * values.length))
    let peak = 0
    for (let j = from; j < to && j < values.length; j++)
      peak = Math.max(peak, values[j])
    out.push(Math.max(0.1, peak))
  }
  return out
}

/** Room at each end of the waveform for the trim handles. */
export const TRIM_INSET = 10
export const HANDLE_WIDTH = 3
/** How far from a handle a touch still grabs it. */
export const TRIM_HANDLE_SLOP = 24
/** The kept range never gets shorter than a second or 30pt (`RecordedAudioPlayerView`). */
export const MIN_TRIM_MS = 1000
export const MIN_TRIM_WIDTH = 30
/** Dragging the end handle replays the last 1.5s of the range. */
export const END_REPLAY_S = 1.5

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
