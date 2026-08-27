import React from 'react'
import { render, within } from '@testing-library/react-native'
import { Gesture } from 'react-native-gesture-handler'

import { Bubble } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler')
  const ReactActual = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')

  return {
    ...actual,
    // Tag the detector so tests can assert whether the bubble attached gestures.
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, { testID: 'bubble-gesture-detector' }, children),
  }
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
    const tapSpy = jest.spyOn(Gesture, 'Tap')
    const longPressSpy = jest.spyOn(Gesture, 'LongPress')

    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        onPressMessage={jest.fn()}
      />
    )

    expect(tapSpy.mock.results[0]!.value.config.cancelsTouchesInView).toBe(false)
    expect(longPressSpy.mock.results[0]!.value.config.cancelsTouchesInView).toBe(false)

    tapSpy.mockRestore()
    longPressSpy.mockRestore()
  })

  it('only composes the tap gesture when onPressMessage is provided', async () => {
    const exclusiveSpy = jest.spyOn(Gesture, 'Exclusive')

    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
      />
    )

    expect(exclusiveSpy).not.toHaveBeenCalled()

    await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={REACTIONS}
        onPressMessage={jest.fn()}
      />
    )

    expect(exclusiveSpy).toHaveBeenCalled()

    exclusiveSpy.mockRestore()
  })
})
