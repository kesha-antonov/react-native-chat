import React from 'react'
import { act, fireEvent } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { WaveformPlayer } from '../components/WaveformPlayer'
import { render } from './renderWithGestureRoot'

const sources: any[] = []

// The shared Reanimated mock hands out a fresh shared value on every render;
// the player's gesture reads values written by layout, so keep them stable
// across renders as the real hook does.
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
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
      }
      sources.push(source)
      return source
    }
    this.close = jest.fn()
  },
}), { virtual: true })

const renderPlayer = async () => {
  const utils = await render(<WaveformPlayer uri='file://note.m4a' position='left' duration={12} />)
  // Let the decode promise settle.
  await act(async () => {})
  await act(async () => {
    utils.getByLabelText('seek').props.onLayout({ nativeEvent: { layout: { width: 150, height: 30 } } })
  })
  return utils
}

describe('WaveformPlayer', () => {
  beforeEach(() => {
    sources.length = 0
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0)
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  it('shows the full length zero-padded under the waveform', async () => {
    const { getByText } = await renderPlayer()
    expect(getByText('00:12')).toBeTruthy()
  })

  it('a tap on the waveform toggles playback instead of seeking', async () => {
    const { getByLabelText } = await renderPlayer()

    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-waveform-tap'), [
        { state: State.BEGAN, x: 120 },
        { state: State.ACTIVE, x: 120 },
        { state: State.END, x: 120 },
      ])
    })

    expect(sources).toHaveLength(1)
    // Started from the beginning, not from where the finger landed.
    expect(sources[0].start).toHaveBeenCalledWith(0, 0)
    expect(getByLabelText('pause')).toBeTruthy()
  })

  it('a drag seeks once, on release, by the distance travelled', async () => {
    const { getByLabelText, getByText } = await renderPlayer()

    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-waveform-pan'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 30 },
        { state: State.ACTIVE, translationX: 75 },
        { state: State.END, translationX: 75 },
      ])
    })

    // Not playing: the drag only sets where play will start (half way).
    expect(sources).toHaveLength(0)
    expect(getByText('00:06')).toBeTruthy()

    // Play then resumes from the dragged position.
    await fireEvent.press(getByLabelText('play'))
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledWith(0, 6)
  })

  it('a drag mid-playback restarts the source once, at release', async () => {
    // While playing, the bars run to the end on the UI thread. The Reanimated mock finishes
    // every animation at once, which would put the bars at the end the moment play starts;
    // hold the playback run where it starts, as it is on a device a moment after the tap.
    const reanimated = require('react-native-reanimated')
    const realWithTiming = reanimated.withTiming
    jest.spyOn(reanimated, 'withTiming').mockImplementation((...args: any[]) =>
      args[1]?.reduceMotion === reanimated.ReduceMotion.Never ? 0 : realWithTiming(...args))
    const { getByLabelText } = await renderPlayer()
    await fireEvent.press(getByLabelText('play'))
    expect(sources).toHaveLength(1)

    await act(async () => {
      fireGestureHandler(getByGestureTestId('voice-waveform-pan'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 20 },
        { state: State.ACTIVE, translationX: 40 },
        { state: State.ACTIVE, translationX: 37.5 },
        { state: State.END, translationX: 37.5 },
      ])
    })

    expect(sources).toHaveLength(2)
    expect(sources[1].start).toHaveBeenCalledWith(0, 3)
  })
})
