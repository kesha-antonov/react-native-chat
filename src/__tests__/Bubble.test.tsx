import React from 'react'
import { render, within } from '@testing-library/react-native'

import { Bubble } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

interface MockGestureConfig {
  cancelsTouchesInView?: boolean
  enabled?: boolean
  minDurationMs?: number
}
interface MockGesture { type: string, config: MockGestureConfig, gestures?: MockGesture[] }

// The gesture each detector was last rendered with, most recent last.
const mockDetectedGestures: MockGesture[] = []

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler')
  const ReactActual = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')

  return {
    ...actual,
    // Tag the detector so tests can assert whether the bubble attached gestures,
    // and record what it was handed.
    GestureDetector: ({ children, gesture }: { children: React.ReactNode, gesture: MockGesture }) => {
      mockDetectedGestures.push(gesture)
      return ReactActual.createElement(View, { testID: 'bubble-gesture-detector' }, children)
    },
  }
})

// The bubble attaches one composed gesture; pick a member of it by handler type.
function lastGestureOfType (type: 'TapGestureHandler' | 'LongPressGestureHandler') {
  const composed = mockDetectedGestures[mockDetectedGestures.length - 1]!
  return composed.gestures!.find(gesture => gesture.type === type)!
}

beforeEach(() => {
  mockDetectedGestures.length = 0
})

const REACTIONS = { isEnabled: true, onReactionPress: jest.fn() }

it('should render <Bubble /> and compare with snapshot', async () => {
  const { toJSON } = await render(
    <Bubble
      user={{ _id: 1 }}
      currentMessage={DEFAULT_TEST_MESSAGE}
      position='left'
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

describe('bubble gestures', () => {
  it('covers the bubble with the row gesture when reactions are enabled', async () => {
    const { getByTestId } = await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
      />
    )

    const detector = getByTestId('bubble-gesture-detector')
    expect(within(detector).queryByText(DEFAULT_TEST_MESSAGE.text)).not.toBeNull()
  })

  it('keeps the row gesture but drops the bubble when isMessageGestureEnabled is false', async () => {
    const { getByTestId, queryByText } = await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        isMessageGestureEnabled={false}
      />
    )

    // the surface beside the bubble still opens the picker...
    const detector = getByTestId('bubble-gesture-detector')
    // ...but the bubble body sits outside it and keeps its own touches
    expect(within(detector).queryByText(DEFAULT_TEST_MESSAGE.text)).toBeNull()
    expect(queryByText(DEFAULT_TEST_MESSAGE.text)).not.toBeNull()
  })

  it('accepts a per-message isMessageGestureEnabled predicate', async () => {
    const videoMessage = { ...DEFAULT_TEST_MESSAGE, video: 'https://example.com/v.mp4' }
    const isMessageGestureEnabled = (message: typeof videoMessage) => !message.video

    const { getByTestId, rerender } = await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={videoMessage}
        position='left'
        reactions={REACTIONS}
        isMessageGestureEnabled={isMessageGestureEnabled}
      />
    )

    expect(within(getByTestId('bubble-gesture-detector')).queryByText(DEFAULT_TEST_MESSAGE.text)).toBeNull()

    await rerender(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        isMessageGestureEnabled={isMessageGestureEnabled}
      />
    )

    expect(within(getByTestId('bubble-gesture-detector')).queryByText(DEFAULT_TEST_MESSAGE.text)).not.toBeNull()
  })

  // Regression: gesture recognizers cancelled touches on native subviews, so
  // video controls rendered through renderMessageVideo were dead (#1).
  it('does not cancel touches in native subviews', async () => {
    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        onPressMessage={jest.fn()}
      />
    )

    expect(lastGestureOfType('TapGestureHandler').config.cancelsTouchesInView).toBe(false)
    expect(lastGestureOfType('LongPressGestureHandler').config.cancelsTouchesInView).toBe(false)
  })

  it('holds for the 0.4s system long-press timeout before opening', async () => {
    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
      />
    )

    expect(lastGestureOfType('LongPressGestureHandler').config.minDurationMs).toBe(400)
  })

  it('only enables the tap gesture when onPressMessage is provided', async () => {
    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
      />
    )

    expect(lastGestureOfType('TapGestureHandler').config.enabled).toBe(false)

    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        onPressMessage={jest.fn()}
      />
    )

    expect(lastGestureOfType('TapGestureHandler').config.enabled).toBe(true)
  })
})
