import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import * as SafeAreaContext from 'react-native-safe-area-context'

import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'

function Probe () {
  return <Text>{String(useKeyboardVerticalOffset())}</Text>
}

it('reports how far down the window the chat starts, not the top inset (#11)', () => {
  // A chat below a navigation header: the container starts 120pt down the screen while
  // the top inset stays at the status bar. Only the frame knows about the header.
  const frame = jest
    .spyOn(SafeAreaContext, 'useSafeAreaFrame')
    .mockReturnValue({ x: 0, y: 120, width: 390, height: 724 })

  try {
    const { getByText } = render(<Probe />)

    expect(getByText('120')).toBeTruthy()
  } finally {
    frame.mockRestore()
  }
})

it('is 0 for a full-screen chat', () => {
  const { getByText } = render(<Probe />)

  expect(getByText('0')).toBeTruthy()
})
