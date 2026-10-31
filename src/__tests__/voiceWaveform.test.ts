import { getMediaPalette } from '../components/mediaPalette'
import {
  VOICE_META_TICKS_WIDTH,
  barCountForWidth,
  barHeight,
  formatVoiceDuration,
  isFreshOutgoingNote,
  levelsFromSamples,
  voiceContentWidth,
} from '../components/voiceWaveform'
import { defaultDarkTheme, defaultLightTheme } from '../Theme'

describe('voiceWaveform', () => {
  it('formats durations zero-padded, with hours past an hour', () => {
    expect(formatVoiceDuration(0)).toBe('00:00')
    expect(formatVoiceDuration(12.9)).toBe('00:12')
    expect(formatVoiceDuration(75)).toBe('01:15')
    expect(formatVoiceDuration(3600 + 62)).toBe('1:01:02')
    expect(formatVoiceDuration(NaN)).toBe('00:00')
    expect(formatVoiceDuration(-4)).toBe('00:00')
  })

  it('maps levels to 2..16 tall bars without normalising the peak', () => {
    expect(barHeight(0)).toBe(2)
    expect(barHeight(1)).toBe(16)
    // A quiet note stays quiet: half scale is not stretched to full height.
    expect(barHeight(0.5)).toBeCloseTo(2 + (2 * 7 * 16) / 31)
    expect(barHeight(2)).toBe(16)
  })

  it('fits one bar every 3 points', () => {
    expect(barCountForWidth(0)).toBe(0)
    expect(barCountForWidth(2)).toBe(1)
    expect(barCountForWidth(140)).toBe(47)
  })

  it('buckets samples into absolute peak levels', () => {
    const samples = [0.1, -0.2, 0.05, 0.05, -0.5, 0.4]
    expect(levelsFromSamples(samples, 3)).toEqual([0.2, 0.05, 0.5])
    expect(levelsFromSamples([], 3)).toEqual([])
  })

  it('sizes the bubble from the time label, not the note length', () => {
    expect(voiceContentWidth(3)).toBe(voiceContentWidth(59 * 60))
    expect(voiceContentWidth(2 * 3600)).toBeGreaterThan(voiceContentWidth(3))
  })

  it('leaves an outgoing bubble room for the ticks beside its time', () => {
    expect(voiceContentWidth(3, true)).toBe(voiceContentWidth(3) + VOICE_META_TICKS_WIDTH)
  })

  it('draws the unplayed incoming bars lighter than a dark bubble, not black', () => {
    expect(getMediaPalette(defaultDarkTheme, 'left').track).toBe('rgba(109, 127, 143, 0.7)')
    expect(getMediaPalette(defaultLightTheme, 'left').track).toBe('rgba(142, 142, 147, 0.7)')
    const custom = { ...defaultDarkTheme, colors: { ...defaultDarkTheme.colors, incomingMeta: 'gray' } }
    expect(getMediaPalette(custom, 'left').track).toBe('rgba(0, 0, 0, 0.20)')
  })

  it('grows bars only on a just-sent outgoing note', () => {
    const now = 1_000_000
    expect(isFreshOutgoingNote('right', now - 500, now)).toBe(true)
    expect(isFreshOutgoingNote('right', new Date(now - 500), now)).toBe(true)
    expect(isFreshOutgoingNote('right', now - 10_000, now)).toBe(false)
    expect(isFreshOutgoingNote('left', now, now)).toBe(false)
    expect(isFreshOutgoingNote('right', undefined, now)).toBe(false)
  })
})
