const mockSetAudioSessionOptions = jest.fn()
const mockSetAudioModeAsync = jest.fn(() => Promise.resolve())

jest.mock('react-native-audio-api', () => ({
  AudioManager: { setAudioSessionOptions: (...args: unknown[]) => mockSetAudioSessionOptions(...args) },
}), { virtual: true })
jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
}), { virtual: true })

describe('raiseToListenStep', () => {
  const { raiseToListenStep } = require('../components/earpiece')

  it('listens when raised with a current note, rewinding one under a second in', () => {
    expect(raiseToListenStep({ isListening: false, isNearEar: true, isCurrent: true, positionSeconds: 0.4 }))
      .toEqual({ type: 'listen', fromStart: true })
    expect(raiseToListenStep({ isListening: false, isNearEar: true, isCurrent: true, positionSeconds: 3 }))
      .toEqual({ type: 'listen', fromStart: false })
  })

  it('does nothing at the ear without a current note', () => {
    expect(raiseToListenStep({ isListening: false, isNearEar: true, isCurrent: false, positionSeconds: 0 }))
      .toBeNull()
  })

  it('pauses when lowered, and only lets go when the note stops being current', () => {
    expect(raiseToListenStep({ isListening: true, isNearEar: false, isCurrent: true, positionSeconds: 2 }))
      .toEqual({ type: 'pause' })
    expect(raiseToListenStep({ isListening: true, isNearEar: true, isCurrent: false, positionSeconds: 0 }))
      .toEqual({ type: 'release' })
    expect(raiseToListenStep({ isListening: true, isNearEar: true, isCurrent: true, positionSeconds: 2 }))
      .toBeNull()
  })
})

describe('acquireEarpiece', () => {
  let earpiece: typeof import('../components/earpiece')

  beforeEach(() => {
    jest.useFakeTimers()
    mockSetAudioSessionOptions.mockClear()
    mockSetAudioModeAsync.mockClear()
    mockSetAudioModeAsync.mockImplementation(() => Promise.resolve())
    jest.isolateModules(() => {
      earpiece = require('../components/earpiece')
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('routes both engines to the earpiece and back to the speaker', () => {
    const release = earpiece.acquireEarpiece()
    expect(earpiece.isEarpieceRouted()).toBe(true)
    expect(mockSetAudioSessionOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ iosCategory: 'playAndRecord' })
    )
    expect(mockSetAudioSessionOptions.mock.calls[0][0].iosOptions).not.toContain('defaultToSpeaker')
    expect(mockSetAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ shouldRouteThroughEarpiece: true, allowsRecording: true })
    )

    release()
    jest.runAllTimers()
    expect(earpiece.isEarpieceRouted()).toBe(false)
    expect(mockSetAudioSessionOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ iosCategory: 'playback' })
    )
    expect(mockSetAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ shouldRouteThroughEarpiece: false, allowsRecording: false })
    )
  })

  it('keeps the earpiece across a hand-over to the next note', () => {
    const releaseFirst = earpiece.acquireEarpiece()
    releaseFirst()
    const releaseNext = earpiece.acquireEarpiece()
    jest.runAllTimers()

    expect(earpiece.isEarpieceRouted()).toBe(true)
    expect(mockSetAudioSessionOptions).toHaveBeenCalledTimes(1)

    releaseNext()
    // A second release of the same claim is ignored.
    releaseFirst()
    jest.runAllTimers()
    expect(earpiece.isEarpieceRouted()).toBe(false)
    expect(mockSetAudioSessionOptions).toHaveBeenCalledTimes(2)
  })

  it('a failing engine does not throw', () => {
    mockSetAudioSessionOptions.mockImplementationOnce(() => {
      throw new Error('no session')
    })
    mockSetAudioModeAsync.mockImplementationOnce(() => Promise.reject(new Error('no mode')))
    expect(() => earpiece.acquireEarpiece()).not.toThrow()
  })
})
