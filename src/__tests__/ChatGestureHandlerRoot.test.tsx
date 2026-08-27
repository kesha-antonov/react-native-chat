import React from 'react'
import { render } from '@testing-library/react-native'

import { Chat } from '..'

// Both branches of the opt-out render a plain `View` at the root, and RNTL v14 dropped
// the `UNSAFE_*ByType` queries that used to tell them apart by component identity - so
// tag the root view here. The mock lives in its own file to keep the extra `testID` out
// of the snapshots in `Chat.test.tsx`.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    ...jest.requireActual('react-native-gesture-handler'),
    GestureHandlerRootView: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: 'GH_ROOT' }, children),
  }
})

const messages = [
  {
    _id: 1,
    text: 'Hello developer',
    createdAt: new Date(),
    user: {
      _id: 2,
      name: 'John Doe',
    },
  },
]

it('mounts its own GestureHandlerRootView when the app has none', async () => {
  const { queryAllByTestId } = await render(
    <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
  )

  expect(queryAllByTestId('GH_ROOT')).toHaveLength(1)
})

it('skips the GestureHandlerRootView when `enableGestureHandlerRootView` is false (#17)', async () => {
  // An app that already mounts its own (directly, or via something like a bottom sheet
  // library) can't be auto-detected the way `KeyboardProvider` is - gesture-handler
  // doesn't expose that publicly - so this has to be an explicit opt-out.
  const { queryAllByTestId } = await render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{ _id: 1 }}
      enableGestureHandlerRootView={false}
    />
  )

  expect(queryAllByTestId('GH_ROOT')).toHaveLength(0)
})
