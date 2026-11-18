import React from 'react'
import { Dimensions, View } from 'react-native'
import { act, render, fireEvent } from '@testing-library/react-native'
import { KeyboardContext } from 'react-native-keyboard-controller'
import * as SafeAreaContext from 'react-native-safe-area-context'

import { Chat } from '..'
import { waitForRows } from './waitForRows'

// The offset each chat hands its keyboard lift.
const mockLiftOffsets: number[] = []
jest.mock('../components/keyboardLift', () => {
  const actual = jest.requireActual('../components/keyboardLift')
  return {
    ...actual,
    useKeyboardLift: (offset: number) => {
      mockLiftOffsets.push(offset)
      return actual.useKeyboardLift(offset)
    },
  }
})

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
    createdAt: new Date(Date.UTC(2024, 0, 1, 12, 0)),
    user: {
      _id: 2,
      name: 'John Doe',
    },
  },
]

it('should render <Chat/> and compare with snapshot', async () => {
  const { toJSON } = await render(
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

it('preserves the default `text` prop on initial render (#603)', async () => {
  const { getByDisplayValue, getByTestId } = await render(
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
  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })

  // The composer must show the provided default text, not a cleared value.
  expect(getByDisplayValue('test')).toBeTruthy()
})

it('keeps the toolbar hidden until the keyboard offset is actually measured (#12)', async () => {
  // Leaves the native measurement pending instead of resolving it, so we can
  // inspect the state in between the layout event and the measurement landing.
  let resolveMeasurement: ((x: number, y: number) => void) | undefined

  const measureInWindow = jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => {
      resolveMeasurement = callback
    }) as never)

  try {
    const { getByTestId } = await render(
      <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
    )

    await fireEvent(getByTestId('GC_WRAPPER'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    })

    // The layout event fired, but the native measurement it kicked off has not
    // resolved yet - the toolbar must stay hidden rather than paint at the
    // pre-measurement seed (offset 0), which is wrong for any chat that is not
    // full-screen.
    expect(getByTestId('GC_CONTENT').props.style).toContainEqual({ opacity: 0 })

    await act(() => {
      resolveMeasurement?.(0, 96)
    })

    // Once the real offset has landed, the toolbar is revealed.
    expect(getByTestId('GC_CONTENT').props.style).not.toContainEqual({ opacity: 0 })
  } finally {
    measureInWindow.mockRestore()
  }
})

it('should render <Chat/> with light colorScheme and compare with snapshot', async () => {
  const { toJSON } = await render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='light'
    />
  )
  await waitForRows()

  expect(toJSON()).toMatchSnapshot()
})

it('should render <Chat/> with dark colorScheme and compare with snapshot', async () => {
  const { toJSON } = await render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='dark'
    />
  )
  await waitForRows()

  expect(toJSON()).toMatchSnapshot()
})

const findKeyboardProviders = (tree: any): any[] => {
  if (tree == null || typeof tree !== 'object')
    return []

  const children = (Array.isArray(tree) ? tree : tree.children ?? []) as any[]
  const nested = children.flatMap(findKeyboardProviders)

  return tree.type === 'KeyboardProvider' ? [tree, ...nested] : nested
}

it('mounts its own KeyboardProvider when the app has none', async () => {
  const { toJSON } = await render(
    <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(1)
})

it('reuses the app KeyboardProvider instead of nesting a second one (#11)', async () => {
  const { toJSON } = await render(
    <KeyboardContext.Provider value={mountedKeyboardProvider}>
      <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
    </KeyboardContext.Provider>
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(0)
})

// The keyboard lifts the chat by its height less the space under the chat (and the composer's
// home-indicator inset, 0 here). That space is the screen less where the chat starts and its
// height, so it shows whether the chat's start came from the right place.
const screenHeight = Dimensions.get('window').height
const layoutChat = (getByTestId: (id: string) => any, height: number) =>
  fireEvent(getByTestId('GC_WRAPPER'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } })

it('lifts the keyboard by where the chat actually sits, not by the top inset (#11)', async () => {
  // A chat below a navigation header: the container starts 120pt down the screen while
  // the top inset stays at the status bar. Only the frame knows about the header. It ends 50pt
  // above the screen's bottom (a tab bar).
  const frame = jest
    .spyOn(SafeAreaContext, 'useSafeAreaFrame')
    .mockReturnValue({ x: 0, y: 120, width: 390, height: 724 })

  try {
    const { getByTestId } = await render(
      <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />
    )
    await layoutChat(getByTestId, screenHeight - 120 - 50)

    expect(mockLiftOffsets.at(-1)).toBe(50)
  } finally {
    frame.mockRestore()
  }
})

it('lets `keyboardAvoidingViewProps.keyboardVerticalOffset` say where the chat starts', async () => {
  const { getByTestId } = await render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{ _id: 1 }}
      keyboardAvoidingViewProps={{ keyboardVerticalOffset: 64 }}
    />
  )
  await layoutChat(getByTestId, screenHeight - 64 - 30)

  expect(mockLiftOffsets.at(-1)).toBe(30)
})

it('skips the KeyboardProvider when `enableKeyboardProvider` is false', async () => {
  const { toJSON } = await render(
    <Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} enableKeyboardProvider={false} />
  )

  expect(findKeyboardProviders(toJSON())).toHaveLength(0)
})

it('does not force the system bars translucent on the app window (#2755)', async () => {
  // Those props tell Android "the app already draws behind the system bars", and the
  // provider answers by zeroing the activity content view's margins - a window-level
  // change it never undoes, so the host app stays under the navigation bar after the
  // chat screen is gone. Only the app knows whether it is edge-to-edge.
  const [provider] = findKeyboardProviders(
    (await render(<Chat messages={messages} onSend={() => {}} user={{ _id: 1 }} />)).toJSON()
  )

  expect(provider.props.statusBarTranslucent).toBeUndefined()
  expect(provider.props.navigationBarTranslucent).toBeUndefined()
})

it('still lets `keyboardProviderProps` set the translucency explicitly', async () => {
  const [provider] = findKeyboardProviders(
    (await render(
      <Chat
        messages={messages}
        onSend={() => {}}
        user={{ _id: 1 }}
        keyboardProviderProps={{ statusBarTranslucent: true, navigationBarTranslucent: true }}
      />
    )).toJSON()
  )

  expect(provider.props.statusBarTranslucent).toBe(true)
  expect(provider.props.navigationBarTranslucent).toBe(true)
})
