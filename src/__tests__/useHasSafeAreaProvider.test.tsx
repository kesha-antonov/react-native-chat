import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { useHasSafeAreaProvider } from '../hooks/useHasSafeAreaProvider'

function Probe () {
  return <Text>{String(useHasSafeAreaProvider())}</Text>
}

it('reports false when no SafeAreaProvider is mounted above', () => {
  const { getByText } = render(<Probe />)

  expect(getByText('false')).toBeTruthy()
})

it('reports true when the app already provides safe-area insets (#jump)', () => {
  // The regression this guards: with an app-level provider, Chat used to mount a
  // second one. A nested provider renders first with the parent's insets and only
  // then with its own measured values - bottom 34 -> 0 on an iPhone - so every
  // chat mount visibly jumped as the toolbar's padding collapsed.
  const { getByText } = render(
    <SafeAreaInsetsContext.Provider value={{ top: 62, bottom: 34, left: 0, right: 0 }}>
      <Probe />
    </SafeAreaInsetsContext.Provider>
  )

  expect(getByText('true')).toBeTruthy()
})
