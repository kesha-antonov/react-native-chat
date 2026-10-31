import { transcribeTapAction } from '../components/TranscribeButton'
import { createViewOnceTracker } from '../components/viewOnce'
import { TRANSCRIBE_SLOT_WIDTH, voiceContentWidth, voiceTrackWidth } from '../components/voiceWaveform'

describe('transcribeTapAction', () => {
  it('asks for a transcription when there is none', () => {
    expect(transcribeTapAction({ hasTranscription: false, isOpen: false, isLoading: false })).toBe('request')
  })

  it('ignores taps while loading, as Telegram does', () => {
    expect(transcribeTapAction({ hasTranscription: false, isOpen: false, isLoading: true })).toBe('none')
  })

  it('toggles an existing transcription', () => {
    expect(transcribeTapAction({ hasTranscription: true, isOpen: false, isLoading: false })).toBe('expand')
    expect(transcribeTapAction({ hasTranscription: true, isOpen: true, isLoading: false })).toBe('collapse')
  })
})

describe('voiceTrackWidth', () => {
  it('takes the transcribe slot out of the waveform, not the bubble', () => {
    const width = voiceContentWidth(12)
    expect(voiceTrackWidth(width, 8, true)).toBe(voiceTrackWidth(width, 8, false) - TRANSCRIBE_SLOT_WIDTH)
    expect(voiceContentWidth(12)).toBe(width)
  })

  it('never goes negative', () => {
    expect(voiceTrackWidth(10, 8, true)).toBe(0)
  })
})

describe('createViewOnceTracker', () => {
  it('ends once, and only after starting', () => {
    const onEnd = jest.fn()
    const tracker = createViewOnceTracker(true, onEnd)

    expect(tracker.end()).toBe(false)
    expect(onEnd).not.toHaveBeenCalled()

    expect(tracker.start()).toBe(true)
    expect(tracker.end()).toBe(true)
    expect(tracker.end()).toBe(false)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('refuses to play a spent note again', () => {
    const tracker = createViewOnceTracker(true, () => {})
    tracker.start()
    tracker.end()
    expect(tracker.isSpent()).toBe(true)
    expect(tracker.start()).toBe(false)
  })

  it('never ends an ordinary note', () => {
    const onEnd = jest.fn()
    const tracker = createViewOnceTracker(false, onEnd)
    tracker.start()
    expect(tracker.end()).toBe(false)
    expect(tracker.start()).toBe(true)
    expect(onEnd).not.toHaveBeenCalled()
  })
})
