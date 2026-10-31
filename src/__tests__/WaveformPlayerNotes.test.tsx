import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

import { MediaPlaybackContext, createMediaPlaybackController } from '../components/mediaPlayback'
import { WaveformPlayer } from '../components/WaveformPlayer'
import { IMessage } from '../Models'

const sources: any[] = []
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

jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    setAudioSessionOptions: (options: unknown) => mockSessionOptions.push(options),
  },
  AudioContext: function AudioContext (this: any) {
    this.currentTime = 0
    this.destination = {}
    this.decodeAudioData = () => Promise.resolve({
      duration: 12,
      getChannelData: () => new Float32Array(1200).fill(0.5),
    })
    this.createBufferSource = () => {
      const source = {
        playbackRate: { value: 1 },
        connect: () => {},
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
      }
      sources.push(source)
      return source
    }
    this.close = () => {}
  },
}), { virtual: true })

const baseOptions = { isAutoPlayNextEnabled: true, isRoundVideoAutoplayEnabled: false }

const message: IMessage = {
  _id: 'v1',
  text: '',
  createdAt: 0,
  user: { _id: 2 },
  audio: 'file://note.m4a',
  duration: 12,
}

const renderPlayer = async (
  controller: ReturnType<typeof createMediaPlaybackController>,
  props: Partial<React.ComponentProps<typeof WaveformPlayer>> = {}
) => {
  const element = (extra: typeof props) => (
    <MediaPlaybackContext.Provider value={controller}>
      <WaveformPlayer
        uri='file://note.m4a'
        position='left'
        duration={12}
        messageId={message._id}
        message={message}
        {...props}
        {...extra}
      />
    </MediaPlaybackContext.Provider>
  )
  const utils = await render(element({}))
  await act(async () => {})
  await act(async () => {
    utils.getByLabelText('seek').props.onLayout({ nativeEvent: { layout: { width: 150, height: 30 } } })
  })
  return { ...utils, rerenderWith: (extra: typeof props) => utils.rerender(element(extra)) }
}

describe('WaveformPlayer notes', () => {
  beforeEach(() => {
    sources.length = 0
    mockSessionOptions.length = 0
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0)
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  it('has no transcribe button without onTranscribe', async () => {
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    const { queryByLabelText } = await renderPlayer(controller)
    expect(queryByLabelText('transcribe')).toBeNull()
  })

  it('asks for a transcription, loads, then opens and toggles it', async () => {
    const onTranscribe = jest.fn()
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, onTranscribe })
    const { getByLabelText, queryByText, rerenderWith } = await renderPlayer(controller)

    await fireEvent.press(getByLabelText('transcribe'))
    expect(onTranscribe).toHaveBeenCalledWith(message)
    expect(getByLabelText('transcribe').props.accessibilityState).toMatchObject({ busy: true })

    // Taps while loading are ignored.
    await fireEvent.press(getByLabelText('transcribe'))
    expect(onTranscribe).toHaveBeenCalledTimes(1)

    await rerenderWith({ transcription: 'Hello there' })
    expect(queryByText('Hello there')).toBeTruthy()
    expect(getByLabelText('transcribe').props.accessibilityState).toMatchObject({ busy: false, expanded: true })

    await fireEvent.press(getByLabelText('transcribe'))
    expect(getByLabelText('transcribe').props.accessibilityState).toMatchObject({ expanded: false })
    expect(onTranscribe).toHaveBeenCalledTimes(1)
  })

  it('plays a view-once note once and reports its end', async () => {
    const onViewOnceEnd = jest.fn()
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, onViewOnceEnd })
    const { getByLabelText, getByTestId } = await renderPlayer(controller, { isViewOnce: true })

    expect(getByTestId('view-once-badge')).toBeTruthy()

    await fireEvent.press(getByLabelText('play'))
    expect(sources).toHaveLength(1)
    expect(onViewOnceEnd).not.toHaveBeenCalled()

    await act(async () => {
      sources[0].onended()
    })
    expect(onViewOnceEnd).toHaveBeenCalledWith(message)

    // Spent: a second press does nothing.
    await fireEvent.press(getByLabelText('play'))
    expect(sources).toHaveLength(1)
    expect(onViewOnceEnd).toHaveBeenCalledTimes(1)
  })

  it('a view-once note pauses without being spent, and is spent when stopped', async () => {
    const onViewOnceEnd = jest.fn()
    const controller = createMediaPlaybackController()
    controller.setOptions({ ...baseOptions, onViewOnceEnd })
    const { getByLabelText, unmount } = await renderPlayer(controller, { isViewOnce: true })

    await fireEvent.press(getByLabelText('play'))
    await fireEvent.press(getByLabelText('pause'))
    expect(onViewOnceEnd).not.toHaveBeenCalled()

    // Closing it (here, the row going away) after it started spends it.
    await unmount()
    expect(onViewOnceEnd).toHaveBeenCalledTimes(1)
  })

  it('raise to listen: earpiece and restart at the ear, pause when lowered', async () => {
    jest.useFakeTimers()
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    const { getByLabelText } = await renderPlayer(controller)

    await fireEvent.press(getByLabelText('play'))
    expect(sources).toHaveLength(1)

    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: true })
    })
    // Under a second in: restarted from 0 on the earpiece route.
    expect(sources).toHaveLength(2)
    expect(sources[1].start).toHaveBeenCalledWith(0, 0)
    expect(mockSessionOptions.at(-1)).toMatchObject({ iosCategory: 'playAndRecord' })

    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: false })
    })
    await act(async () => {
      jest.runAllTimers()
    })
    expect(sources[1].stop).toHaveBeenCalled()
    expect(getByLabelText('play')).toBeTruthy()
    expect(mockSessionOptions.at(-1)).toMatchObject({ iosCategory: 'playback' })
    jest.useRealTimers()
  })

  it('raising the phone with no current note does nothing', async () => {
    const controller = createMediaPlaybackController()
    controller.setOptions(baseOptions)
    await renderPlayer(controller)

    await act(async () => {
      controller.setOptions({ ...baseOptions, isNearEar: true })
    })
    expect(sources).toHaveLength(0)
    expect(mockSessionOptions).toHaveLength(0)
  })
})
