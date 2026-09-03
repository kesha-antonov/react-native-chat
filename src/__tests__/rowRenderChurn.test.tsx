import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import { Chat } from '..'
import { IMessage } from '../Models'

// The shipped Reanimated jest mock returns a BRAND NEW object from `useSharedValue` on every
// call - it is not a hook, unlike the real implementation, which returns one stable object for
// the life of the component. Every `useCallback` in `MessagesContainer` that closes over a
// shared value therefore looks unstable under the stock mock, and this file would measure that
// artifact instead of the library. `CellRendererComponent` is the one that matters: React treats
// it as a component type, so a new identity unmounts and remounts every row rather than
// re-rendering it. Verified both ways - with the stock mock these tests report 12 of 12 rows
// remounting; with the faithful one below, zero.
jest.mock('react-native-reanimated', () => {
  const {
    createJSReanimatedModule,
  } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')
  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}

  const ReactLocal = require('react')
  const mock = require('react-native-reanimated/mock')
  const mockUseSharedValue = mock.useSharedValue

  return {
    ...mock,
    useSharedValue: (init: unknown) => {
      const ref = ReactLocal.useRef(undefined as any)
      if (ref.current === undefined)
        ref.current = mockUseSharedValue(init)
      return ref.current
    },
  }
})

// A render that changes nothing about the conversation must not reach the message rows.
// `Item` is memoized to make that a no-op, but the memo only holds while every prop a row
// receives keeps its identity, and it is bypassed entirely if anything above it changes
// component identity - which remounts rows instead of re-rendering them, throwing away their
// native views and any row-local state (a playing voice note, an expanded bubble).
//
// Two renders have to stay free, and they fail for different reasons:
//   - a keystroke re-renders `Chat` from its own state, so React hands it back the *same*
//     props object and the memos keyed on `props` hold
//   - a parent re-render hands `Chat` a *fresh* props object, invalidating those memos - the
//     common case in a real app (a new message, a typing flag, any context update above it)

const USER = { _id: 1 }
const PLACEHOLDER = 'Type a message...'

const MESSAGES: IMessage[] = Array.from({ length: 20 }, (_, i) => ({
  _id: i + 1,
  text: `message ${i + 1}`,
  createdAt: new Date(2024, 0, 1, 12, 0, i),
  user: { _id: i % 2 === 0 ? 1 : 2, name: 'Someone' },
}))

const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } }

/** Counts row renders and row mounts separately - a remount is the more serious failure. */
function makeRowSpy () {
  const counts = { renders: 0, mounts: 0 }

  const RowSpy = () => {
    counts.renders++
    useEffect(() => {
      counts.mounts++
    }, [])
    return <View />
  }

  return { counts, renderMessage: () => <RowSpy /> }
}

it('does not re-render message rows when the composer text changes', async () => {
  const { counts, renderMessage } = makeRowSpy()
  let toolbarRenders = 0

  const { getByTestId } = await render(
    <Chat
      messages={MESSAGES}
      user={USER}
      onSend={() => {}}
      renderMessage={renderMessage}
      renderSend={() => {
        toolbarRenders++
        return <View />
      }}
    />
  )

  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)

  expect(counts.renders).toBeGreaterThan(0) // guard: rows really mounted
  counts.renders = 0
  counts.mounts = 0
  toolbarRenders = 0

  await fireEvent.changeText(getByTestId(PLACEHOLDER), 'h')

  // Sensitivity guard: prove the keystroke actually re-rendered Chat. Without it, a zero
  // below could just mean the event never landed.
  expect(toolbarRenders).toBeGreaterThan(0)
  expect(counts.renders).toBe(0)
  expect(counts.mounts).toBe(0)
})

it('does not re-render or remount message rows when the parent re-renders', async () => {
  const { counts, renderMessage } = makeRowSpy()
  let toolbarRenders = 0
  let bump: (() => void) | undefined

  const onSend = () => {}
  const renderSend = () => {
    toolbarRenders++
    return <View />
  }
  // `reply` is rebuilt on the way down to the list, so a consumer passing it is the case
  // most likely to regress.
  const reply = { swipe: { onSwipe: () => {} } }

  const Parent = () => {
    const [, setTick] = useState(0)
    bump = () => setTick(t => t + 1)

    return (
      <Chat
        messages={MESSAGES}
        user={USER}
        onSend={onSend}
        reply={reply}
        renderMessage={renderMessage}
        renderSend={renderSend}
      />
    )
  }

  const { getByTestId } = await render(<Parent />)

  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)

  expect(counts.renders).toBeGreaterThan(0) // guard: rows really mounted
  counts.renders = 0
  counts.mounts = 0
  toolbarRenders = 0

  await act(async () => {
    bump!()
  })

  // Sensitivity guard: the parent re-render must actually have reached Chat.
  expect(toolbarRenders).toBeGreaterThan(0)
  expect(counts.renders).toBe(0)
  expect(counts.mounts).toBe(0)
})
