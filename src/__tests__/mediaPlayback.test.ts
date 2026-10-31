import {
  claimPlayback,
  createMediaPlaybackController,
  getPlaybackRate,
  nextPlaybackRate,
  releasePlayback,
  setPlaybackRate,
  stopAllPlayback,
  subscribePlaybackRate,
} from '../components/mediaPlayback'
import { formatRecordingTime } from '../components/recordingFeedback'

describe('mediaPlayback', () => {
  afterEach(() => {
    stopAllPlayback()
    setPlaybackRate(1)
  })

  it('claiming playback replaces the previous player', () => {
    const stopFirst = jest.fn()
    const stopSecond = jest.fn()

    claimPlayback('a', stopFirst)
    claimPlayback('b', stopSecond)

    expect(stopFirst).toHaveBeenCalledWith('replaced')
    expect(stopSecond).not.toHaveBeenCalled()
  })

  it('a recording pauses the current note, which stays current', () => {
    const stopFirst = jest.fn()
    claimPlayback('a', stopFirst)

    stopAllPlayback()
    expect(stopFirst).toHaveBeenLastCalledWith('paused')

    // Still current: a note started later resets it, as Telegram's cleanupPlayer does.
    claimPlayback('b', jest.fn())
    expect(stopFirst).toHaveBeenLastCalledWith('replaced')
  })

  it('a released player is not stopped by a recording', () => {
    const stop = jest.fn()
    claimPlayback('a', stop)
    releasePlayback('a')

    stopAllPlayback()

    expect(stop).not.toHaveBeenCalled()
  })

  it('shares one playback rate and cycles 1x -> 1.5x -> 2x -> 1x', () => {
    const listener = jest.fn()
    const unsubscribe = subscribePlaybackRate(listener)

    setPlaybackRate(nextPlaybackRate(getPlaybackRate()))
    expect(getPlaybackRate()).toBe(1.5)
    setPlaybackRate(nextPlaybackRate(getPlaybackRate()))
    expect(getPlaybackRate()).toBe(2)
    setPlaybackRate(nextPlaybackRate(getPlaybackRate()))
    expect(getPlaybackRate()).toBe(1)

    expect(listener.mock.calls).toEqual([[1.5], [2], [1]])
    unsubscribe()
  })

  it('ignores an invalid playback rate', () => {
    setPlaybackRate(0)
    setPlaybackRate(Number.NaN)

    expect(getPlaybackRate()).toBe(1)
  })

  it('formats the recording timer with tenths, like Telegram', () => {
    expect(formatRecordingTime(0)).toBe('0:00,0')
    expect(formatRecordingTime(3450)).toBe('0:03,4')
    expect(formatRecordingTime(61_999)).toBe('1:01,9')
    expect(formatRecordingTime(3_600_000 + 5_000)).toBe('1:00:05,0')
  })

  it('reports an unread note as read, and only an unread one', () => {
    const controller = createMediaPlaybackController()
    const onMediaRead = jest.fn()
    controller.setOptions({ isAutoPlayNextEnabled: true, isRoundVideoAutoplayEnabled: true, onMediaRead })
    controller.setMessages([
      { _id: 'unread', audio: 'a.m4a', isMediaUnread: true },
      { _id: 'read', audio: 'b.m4a' },
    ], true)

    controller.markRead('unread')
    controller.markRead('read')

    expect(onMediaRead).toHaveBeenCalledTimes(1)
    expect(onMediaRead).toHaveBeenCalledWith(expect.objectContaining({ _id: 'unread' }))
  })

  describe('auto-play next', () => {
    // Inverted list: newest first, like Chat's default.
    const messages = [
      { _id: 'text-newest' },
      { _id: 'voice-3', audio: 'c.m4a' },
      { _id: 'video-plain', video: 'clip.mp4' },
      { _id: 'note-2', video: 'note.mp4', videoNote: true },
      { _id: 'text' },
      { _id: 'voice-1', audio: 'a.m4a' },
    ]

    it('plays the next newer voice or round note, skipping other messages', () => {
      const controller = createMediaPlaybackController()
      controller.setMessages(messages, true)
      const playNote = jest.fn()
      const playVoice = jest.fn()
      controller.register('note-2', { play: playNote })
      controller.register('voice-3', { play: playVoice })

      controller.onEnded('voice-1')
      expect(playNote).toHaveBeenCalledTimes(1)
      expect(playVoice).not.toHaveBeenCalled()

      // A plain (non-round) video is not part of the run.
      controller.onEnded('note-2')
      expect(playVoice).toHaveBeenCalledTimes(1)
    })

    it('walks the other way in a non-inverted list', () => {
      const controller = createMediaPlaybackController()
      controller.setMessages([...messages].reverse(), false)
      const playNote = jest.fn()
      controller.register('note-2', { play: playNote })

      controller.onEnded('voice-1')

      expect(playNote).toHaveBeenCalledTimes(1)
    })

    it('stops at the newest note', () => {
      const controller = createMediaPlaybackController()
      controller.setMessages(messages, true)
      const playOlder = jest.fn()
      controller.register('voice-1', { play: playOlder })

      controller.onEnded('voice-3')

      expect(playOlder).not.toHaveBeenCalled()
    })

    it('does nothing when turned off or when the next row is not mounted', () => {
      const controller = createMediaPlaybackController()
      controller.setMessages(messages, true)
      const playNote = jest.fn()
      const unregister = controller.register('note-2', { play: playNote })

      controller.setOptions({ isAutoPlayNextEnabled: false, isRoundVideoAutoplayEnabled: true })
      controller.onEnded('voice-1')
      expect(playNote).not.toHaveBeenCalled()

      controller.setOptions({ isAutoPlayNextEnabled: true, isRoundVideoAutoplayEnabled: true })
      unregister()
      expect(() => controller.onEnded('voice-1')).not.toThrow()
      expect(playNote).not.toHaveBeenCalled()
    })
  })
})
