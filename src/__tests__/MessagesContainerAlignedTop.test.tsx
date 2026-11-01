import React from 'react'
import { act } from '@testing-library/react-native'

import { MessagesContainer } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'
import { render } from './renderWithGestureRoot'

// The shipped mock records listeners but never calls them, so keyboard transitions are
// unobservable. Swap in a tiny emitter and keep everything else it provides.
const mockKeyboardListeners = new Map<string, Set<() => void>>()

jest.mock('react-native-keyboard-controller', () => ({
  ...jest.requireActual('react-native-keyboard-controller/jest'),
  KeyboardController: {
    ...jest.requireActual('react-native-keyboard-controller/jest').KeyboardController,
    isVisible: () => false,
  },
  KeyboardEvents: {
    addListener: (event: string, listener: () => void) => {
      const listeners = mockKeyboardListeners.get(event) ?? new Set()
      listeners.add(listener)
      mockKeyboardListeners.set(event, listeners)

      return { remove: () => listeners.delete(listener) }
    },
  },
}))

const emitKeyboardEvent = (event: 'keyboardWillShow' | 'keyboardWillHide') =>
  act(() => {
    mockKeyboardListeners.get(event)?.forEach(listener => listener())
  })

const MESSAGES = [
  { ...DEFAULT_TEST_MESSAGE, _id: 'test1' },
  { ...DEFAULT_TEST_MESSAGE, _id: 'test2' },
]

// The list renders oldest first, top to bottom; `alignItemsAtEnd` puts a conversation shorter
// than the list at its bottom.
const getAlignItemsAtEnd = (tree: any): unknown => {
  const findList = (node: any): any => {
    if (node == null || typeof node !== 'object')
      return undefined

    if (node.props?.alignItemsAtEnd !== undefined)
      return node

    const children = (Array.isArray(node) ? node : node.children ?? []) as any[]

    return children.reduce<any>((found, child) => found ?? findList(child), undefined)
  }

  return findList(tree)?.props?.alignItemsAtEnd
}

beforeEach(() => mockKeyboardListeners.clear())

it('keeps a short conversation at the bottom by default', async () => {
  const { toJSON } = await render(<MessagesContainer messages={MESSAGES} user={{ _id: 1 }} />)

  expect(getAlignItemsAtEnd(toJSON())).toBe(true)
})

it('pins a short conversation to the top when isAlignedTop is set', async () => {
  const { toJSON } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isAlignedTop />
  )

  expect(getAlignItemsAtEnd(toJSON())).toBe(false)
})

it('pins to the top the same way for a non-inverted list', async () => {
  const { toJSON } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isAlignedTop isInverted={false} />
  )

  expect(getAlignItemsAtEnd(toJSON())).toBe(false)
})

it('re-anchors to the bottom while the keyboard is open with isAlignedTop=auto (#2736)', async () => {
  const { toJSON } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isAlignedTop='auto' />
  )

  expect(getAlignItemsAtEnd(toJSON())).toBe(false)

  await emitKeyboardEvent('keyboardWillShow')
  expect(getAlignItemsAtEnd(toJSON())).toBe(true)

  await emitKeyboardEvent('keyboardWillHide')
  expect(getAlignItemsAtEnd(toJSON())).toBe(false)
})

it('does not react to the keyboard unless isAlignedTop is auto', async () => {
  const { toJSON } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isAlignedTop />
  )

  expect(mockKeyboardListeners.size).toBe(0)

  await emitKeyboardEvent('keyboardWillShow')
  expect(getAlignItemsAtEnd(toJSON())).toBe(false)
})
