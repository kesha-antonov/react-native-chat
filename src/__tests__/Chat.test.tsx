import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { KeyboardContext } from 'react-native-keyboard-controller'
import * as SafeAreaContext from 'react-native-safe-area-context'

import { Chat } from '..'

// Stands in for what a mounted `KeyboardProvider` puts in the context: one Reanimated
// shared value per field.
const mountedKeyboardProvider = {
  reanimated: {
    progress: { value: 0, _isReanimatedSharedValue: true },
    height: { value: 0, _isReanimatedSharedValue: true },
  },
} as any

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

it('should render <Chat/> and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

it('preserves the default `text` prop on initial render (#603)', () => {
  const { getByDisplayValue, getByTestId } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      text='test'
    />
  )

  // Mount the input toolbar by simulating the initial layout pass (this is also
  // where the text-init/reset logic runs that #603 reported as clearing text).
  fireEvent(getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })

  // The composer must show the provided default text, not a cleared value.
  expect(getByDisplayValue('test')).toBeTruthy()
})

it('should render <Chat/> with light colorScheme and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='light'
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

it('should render <Chat/> with dark colorScheme and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='dark'
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

const findKeyboardProviders = (tree: any): any[] => {
  if (tree == null || typeof tree !== 'object')
    return []

  const children = (Array.isArray(tree) ? tree : tree.children ?? []) as any[]
  const nested = children.flatMap(findKeyboardProviders)

  return tree.type === 'KeyboardProvider' ? [tree, ...nested] : nested
}

it('mounts its own KeyboardProvider when the app has none', () => {
  const { toJSON } = render(
    <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(1)
})

it('reuses the app KeyboardProvider instead of nesting a second one (#11)', () => {
  const { toJSON } = render(
    <KeyboardContext.Provider value={mountedKeyboardProvider}>
      <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
    </KeyboardContext.Provider>
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(0)
})

const findKeyboardVerticalOffset = (tree: any): number | undefined => {
  if (tree == null || typeof tree !== 'object')
    return undefined

  if (tree.props?.keyboardVerticalOffset !== undefined)
    return tree.props.keyboardVerticalOffset

  const children = (Array.isArray(tree) ? tree : tree.children ?? []) as any[]

  return children.reduce<number | undefined>(
    (found, child) => found ?? findKeyboardVerticalOffset(child),
    undefined
  )
}

it('offsets the keyboard by where the chat actually sits, not by the top inset (#11)', () => {
  // A chat below a navigation header: the container starts 120pt down the screen while
  // the top inset stays at the status bar. Only the frame knows about the header.
  const frame = jest
    .spyOn(SafeAreaContext, 'useSafeAreaFrame')
    .mockReturnValue({ x: 0, y: 120, width: 390, height: 724 })

  try {
    const { toJSON } = render(
      <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
    )

    expect(findKeyboardVerticalOffset(toJSON())).toBe(120)
  } finally {
    frame.mockRestore()
  }
})

it('lets `keyboardAvoidingViewProps` override the measured offset', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{ _id: 1 }}
      keyboardAvoidingViewProps={{ keyboardVerticalOffset: 64 }}
    />
  )

  expect(findKeyboardVerticalOffset(toJSON())).toBe(64)
})

it('skips the KeyboardProvider when `disableKeyboardProvider` is set', () => {
  const { toJSON } = render(
    <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} disableKeyboardProvider />
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(0)
})

it('does not force the system bars translucent on the app window (#2755)', () => {
  // Those props tell Android "the app already draws behind the system bars", and the
  // provider answers by zeroing the activity content view's margins - a window-level
  // change it never undoes, so the host app stays under the navigation bar after the
  // chat screen is gone. Only the app knows whether it is edge-to-edge.
  const [provider] = findKeyboardProviders(
    render(<Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />).toJSON()
  )

  expect(provider.props.statusBarTranslucent).toBeUndefined()
  expect(provider.props.navigationBarTranslucent).toBeUndefined()
})

it('still lets `keyboardProviderProps` set the translucency explicitly', () => {
  const [provider] = findKeyboardProviders(
    render(
      <Chat
        messages={messages}
        onSend={() => {}}
        user={{ _id: 1 }}
        keyboardProviderProps={{ statusBarTranslucent: true, navigationBarTranslucent: true }}
      />
    ).toJSON()
  )

  expect(provider.props.statusBarTranslucent).toBe(true)
  expect(provider.props.navigationBarTranslucent).toBe(true)
})
