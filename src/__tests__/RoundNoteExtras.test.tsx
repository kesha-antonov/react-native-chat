import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

import {
  MediaPlaybackContext,
  createMediaPlaybackController,
  detachRoundNoteFromRow,
  stopAllPlayback,
} from '../components/mediaPlayback'
import {
  ROUND_TRANSCRIBE_GAP,
  ROUND_TRANSCRIBE_SIZE,
  roundTranscribePosition,
} from '../components/roundNoteChrome'
import { MessageVideo } from '../MessageVideo'
import { IMessage } from '../Models'

const mockPlayers: any[] = []
const mockSessionOptions: any[] = []

// Stable shared values across renders, as in WaveformPlayer.test.tsx.
jest.mock('react-native-reanimated', () => {
  const {
    createJSReanimatedModule,
  } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')
  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}

  const { useRef } = require('react')
  const mock = require('react-native-reanimated/mock')
  return {
    ...mock,
    __esModule: true,
    useSharedValue: (init: unknown) => {
      const ref = useRef(null)
      if (!ref.current)
        ref.current = mock.useSharedValue(init)
      return ref.current
    },
  }
})

const mockFakePlayer = () => {
  const listeners = new Map<string, () => void>()
  const player: any = {
    listeners,
    playing: false,
    muted: true,
    loop: false,
    currentTime: 0,
    playbackRate: 1,
    duration: 10,
    play: jest.fn(() => {
      player.playing = true
    }),
    pause: jest.fn(() => {
      player.playing = false
    }),
    release: jest.fn(),
    addListener: jest.fn((event: string, listener: () => void) => {
      listeners.set(event, listener)
      return { remove: () => listeners.delete(event) }
    }),
  }
  return player
}

jest.mock('expo-video', () => {
  const { View } = require('react-native')
  return {
    VideoView: View,
    useVideoPlayer: () => ({}),
    createVideoPlayer: () => {
      const player = mockFakePlayer()
      mockPlayers.push(player)
      return player
    },
  }
}, { virtual: true })

jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    setAudioSessionOptions: (options: unknown) => mockSessionOptions.push(options),
  },
}), { virtual: true })

const baseOptions = { isAutoPlayNextEnabled: false, isRoundVideoAutoplayEnabled: false }

const makeMessage = (extra: Partial<IMessage> = {}): IMessage => ({
  _id: 'r1',
  text: '',
  createdAt: 0,
  user: { _id: 2 },
  video: 'file://note.mp4',
  videoNote: true,
  duration: 10,
  ...extra,
})

const renderNote = async (
  controller: ReturnType<typeof createMediaPlaybackController>,
  message: IMessage
) => {
  const element = (current: IMessage) => (
    <MediaPlaybackContext.Provider value={controller}>
      <MessageVideo currentMessage={current} position='left' />
    </MediaPlaybackContext.Provider>
  )
  const utils = await render(element(message))
  return { ...utils, rerenderWith: (next: IMessage) => utils.rerender(element(next)) }
}

describe('round note extras', () => {
  beforeEach(() => {
    mockPlayers.length = 0
    mockSessionOptions.length = 0
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0)
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(async () => {
    await act(async () => {
      stopAllPlayback()
    })
  })

  it('plays a view-once note once, without a ring to scrub, and reports its end once', async () => {
    const onViewOnceEnd = jest.fn()
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, onViewOnceEnd })
    const message = makeMessage({ isViewOnce: true })
    const { getByLabelText, getByTestId } = await renderNote(controller, message)

    expect(getByTestId('view-once-badge')).toBeTruthy()
    const player = mockPlayers[0]

    await fireEvent.press(getByLabelText('play video note'))
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(onViewOnceEnd).not.toHaveBeenCalled()

    await act(async () => {
      player.listeners.get('playToEnd')?.()
    })
    expect(onViewOnceEnd).toHaveBeenCalledWith(message)

    // Spent: the note cannot be started again.
    const button = getByLabelText('play video note')
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })
    await fireEvent.press(button)
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(onViewOnceEnd).toHaveBeenCalledTimes(1)
  })

  it('spends a started view-once note when it is closed, and does not float it', async () => {
    const onViewOnceEnd = jest.fn()
    const controller = createMediaPlaybackController()
    controller.notePlayers.setActive(true)
    controller.setOptions({ ...baseOptions, onViewOnceEnd })
    const { getByLabelText, unmount } = await renderNote(controller, makeMessage({ isViewOnce: true }))

    await fireEvent.press(getByLabelText('play video note'))
    await unmount()
    expect(onViewOnceEnd).toHaveBeenCalledTimes(1)
    expect(mockPlayers[0].pause).toHaveBeenCalled()
    expect(controller.notePlayers.takeDetached('r1\u0000file://note.mp4')).toBeNull()
    controller.notePlayers.setActive(false)
  })

  it('does not autoplay a view-once note in the list', async () => {
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, isRoundVideoAutoplayEnabled: true })
    await renderNote(controller, makeMessage({ isViewOnce: true }))
    expect(mockPlayers[0].play).not.toHaveBeenCalled()
    expect(mockPlayers[0].loop).toBe(false)
  })

  it('raise to listen: restarts at the ear under a second in, pauses when lowered', async () => {
    jest.useFakeTimers()
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    const { getByLabelText } = await renderNote(controller, makeMessage())
    const player = mockPlayers[0]

    await fireEvent.press(getByLabelText('play video note'))
    player.currentTime = 0.4
    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: true })
    })
    expect(player.currentTime).toBe(0)
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(mockSessionOptions.at(-1)).toMatchObject({ iosCategory: 'playAndRecord' })

    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: false })
    })
    await act(async () => {
      jest.runAllTimers()
    })
    expect(player.pause).toHaveBeenCalled()
    expect(mockSessionOptions.at(-1)).toMatchObject({ iosCategory: 'playback' })
    jest.useRealTimers()
  })

  it('raise to listen resumes a paused note past a second without rewinding', async () => {
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    const { getByLabelText } = await renderNote(controller, makeMessage())
    const player = mockPlayers[0]

    await fireEvent.press(getByLabelText('play video note'))
    await fireEvent.press(getByLabelText('pause video note'))
    player.currentTime = 4
    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: true })
    })
    expect(player.currentTime).toBe(4)
    expect(player.play).toHaveBeenCalledTimes(2)
    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: false })
    })
  })

  it('shows a transcribe button beside the note and the text once it arrives', async () => {
    const onTranscribe = jest.fn()
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, onTranscribe })
    const message = makeMessage()
    const { getByLabelText, queryByText, rerenderWith } = await renderNote(controller, message)

    await fireEvent.press(getByLabelText('transcribe'))
    expect(onTranscribe).toHaveBeenCalledWith(message)
    expect(getByLabelText('transcribe').props.accessibilityState).toMatchObject({ busy: true })

    await rerenderWith({ ...message, transcription: 'See you at five' })
    expect(queryByText('See you at five')).toBeTruthy()
    expect(getByLabelText('transcribe').props.accessibilityState).toMatchObject({ expanded: true })
  })

  it('has no transcribe button without onTranscribe or a transcription', async () => {
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    const { queryByLabelText } = await renderNote(controller, makeMessage())
    expect(queryByLabelText('transcribe')).toBeNull()
  })
})

describe('round note transcribe placement', () => {
  it('sits just past an incoming note and before an outgoing one, level with the bottom', () => {
    expect(roundTranscribePosition(true, 200, 0)).toEqual({ left: 200 + ROUND_TRANSCRIBE_GAP, bottom: 0 })
    expect(roundTranscribePosition(false, 200, 0)).toEqual({
      left: -(ROUND_TRANSCRIBE_SIZE + ROUND_TRANSCRIBE_GAP),
      bottom: 0,
    })
  })

  it('moves in onto the corner of a grown note', () => {
    expect(roundTranscribePosition(true, 300, 1)).toEqual({ left: 300 + ROUND_TRANSCRIBE_GAP - 40, bottom: 28 })
    expect(roundTranscribePosition(false, 300, 1).left).toBe(-(ROUND_TRANSCRIBE_SIZE + ROUND_TRANSCRIBE_GAP) + 28)
  })
})

describe('floating round note switch', () => {
  afterEach(() => {
    stopAllPlayback()
  })

  const setUp = (options: object, canFloat?: boolean) => {
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, ...options })
    const cache = controller.notePlayers
    cache.setActive(true)
    const player = mockFakePlayer()
    cache.get('k', () => player)
    cache.keep('k', true)
    player.playing = true
    detachRoundNoteFromRow(controller, cache, 'k', 'r1', player, true, canFloat)
    return { controller, cache, player }
  }

  it('floats a note still playing as its row goes, by default', () => {
    const { cache, controller } = setUp({})
    expect(controller.getNowPlaying()?.messageId).toBe('r1')
    expect(cache.takeDetached('k')).not.toBeNull()
    cache.setActive(false)
  })

  it('stops it with its row when the floating note is off', () => {
    const { cache, controller, player } = setUp({ isFloatingRoundNoteEnabled: false })
    expect(player.pause).toHaveBeenCalled()
    expect(controller.getNowPlaying()).toBeNull()
    expect(cache.takeDetached('k')).toBeNull()
    cache.setActive(false)
  })

  it('never floats a note that may not outlive its row', () => {
    const { cache, player } = setUp({}, false)
    expect(player.pause).toHaveBeenCalled()
    expect(cache.takeDetached('k')).toBeNull()
    cache.setActive(false)
  })
})
