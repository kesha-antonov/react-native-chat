import React from 'react'
import { act, render } from '@testing-library/react-native'

import { StreamingCursor } from '../components/StreamingCursor'
import { TypingIndicator } from '../TypingIndicator'

const mockCancelAnimation = jest.fn()

// Reanimated's JS mock drives its animations on timers, so timer-count assertions here would
// measure the mock rather than the library. What is unambiguous is whether the library asks
// Reanimated to cancel: these components start `withRepeat(..., 0 | -1)` animations, which
// never settle on their own and keep driving their shared value after the component is gone
// unless explicitly cancelled.
jest.mock('react-native-reanimated', () => {
  const {
    createJSReanimatedModule,
  } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')
  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}

  const mock = require('react-native-reanimated/mock')

  return {
    ...mock,
    cancelAnimation: (...args: unknown[]) => {
      mockCancelAnimation(...args)
      return mock.cancelAnimation?.(...args)
    },
  }
})

/** `unmount()` alone does not flush effect cleanups here - they land on the next act pass. */
async function unmountAndFlush (unmount: () => void) {
  await act(async () => {
    unmount()
  })
}

beforeEach(() => {
  mockCancelAnimation.mockClear()
})

it('cancels every looping dot animation when the typing indicator unmounts', async () => {
  const { unmount } = await render(<TypingIndicator isTyping />)

  expect(mockCancelAnimation).not.toHaveBeenCalled() // guard: nothing cancelled while mounted

  await unmountAndFlush(unmount)

  // One per dot. Each runs `withRepeat(..., 0, true)`, which repeats forever.
  expect(mockCancelAnimation).toHaveBeenCalledTimes(3)
  // Three distinct shared values, not the same one three times.
  expect(new Set(mockCancelAnimation.mock.calls.map(([sv]) => sv)).size).toBe(3)
})

it('cancels the blinking cursor animation when the streaming cursor unmounts', async () => {
  // Reference case: this component already had the cleanup, and pins the pattern the
  // typing indicator now follows.
  const { unmount } = await render(<StreamingCursor />)

  await unmountAndFlush(unmount)

  expect(mockCancelAnimation).toHaveBeenCalledTimes(1)
})
