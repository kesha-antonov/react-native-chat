import React from 'react'
import { Linking } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { PRESS_HOLD_MS, suppressPressAfterHold } from '../components/messagePress'
import { MessageLocation } from '../MessageLocation'
import { DEFAULT_TEST_MESSAGE } from './data'

// A long-press on a message opens its menu. Letting go must not also fire the
// tappable under the finger (photo viewer, maps, playback).
describe('tappables inside a bubble', () => {
  it('count a hold as long as the message long-press as a long-press', () => {
    expect(suppressPressAfterHold.delayLongPress).toBe(PRESS_HOLD_MS)
    expect(typeof suppressPressAfterHold.onLongPress).toBe('function')
  })

  it('do not open the location after a long-press', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { getByRole } = await render(
      <MessageLocation
        currentMessage={{ ...DEFAULT_TEST_MESSAGE, location: { latitude: 1, longitude: 2 } }}
      />
    )

    await fireEvent(getByRole('button'), 'longPress')
    expect(openURL).not.toHaveBeenCalled()

    await fireEvent.press(getByRole('button'))
    expect(openURL).toHaveBeenCalledTimes(1)
  })
})
