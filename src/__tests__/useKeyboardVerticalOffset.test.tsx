import React from 'react'
import { Text, View } from 'react-native'
import { act, render } from '@testing-library/react-native'
import * as SafeAreaContext from 'react-native-safe-area-context'

import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'

function Probe () {
  const { ref, onLayout, keyboardVerticalOffset } = useKeyboardVerticalOffset()

  return (
    <View ref={ref} onLayout={onLayout} testID='container'>
      <Text>{String(keyboardVerticalOffset)}</Text>
    </View>
  )
}

const layoutEvent = {
  nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 724 } },
} as never

it('falls back to the safe-area frame before the container has been measured', () => {
  // A chat below a navigation header, in an app whose own SafeAreaProvider does
  // report the offset: the frame is a usable seed until the measurement lands.
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

it('prefers the measured window position over the safe-area frame (#11)', () => {
  // The regression this guards: when the host app mounts its own
  // SafeAreaProvider, a nested provider is seeded from the parent and reports
  // y = 0 however far down the screen the chat actually starts. Measuring the
  // container gives the real offset, so the toolbar is not left a header-height
  // too low - i.e. behind the keyboard.
  const frame = jest
    .spyOn(SafeAreaContext, 'useSafeAreaFrame')
    .mockReturnValue({ x: 0, y: 0, width: 390, height: 724 })

  const measureInWindow = jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => {
      callback(0, 96)
    }) as never)

  try {
    const { getByTestId, getByText } = render(<Probe />)

    act(() => {
      getByTestId('container').props.onLayout(layoutEvent)
    })

    expect(getByText('96')).toBeTruthy()
  } finally {
    frame.mockRestore()
    measureInWindow.mockRestore()
  }
})
