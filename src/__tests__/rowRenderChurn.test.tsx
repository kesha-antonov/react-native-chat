import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import { Chat } from '..'
import { IMessage } from '../Models'
import { waitForRows } from './waitForRows'

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
  await waitForRows()

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
  let chatRenders = 0
  let bump: (() => void) | undefined

  const onSend = () => {}
  const renderSend = () => {
    toolbarRenders++
    return <View />
  }
  // `reply` is rebuilt on the way down to the list, so a consumer passing it is the case
  // most likely to regress.
  const reply = { swipe: { onSwipe: () => {} } }
  // Drawn by `Chat` on each of its renders: the probe that the parent re-render reached it.
  const renderChatFooter = () => {
    chatRenders++
    return null
  }

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
        renderChatFooter={renderChatFooter}
      />
    )
  }

  const { getByTestId } = await render(<Parent />)

  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)
  await waitForRows()

  expect(counts.renders).toBeGreaterThan(0) // guard: rows really mounted
  counts.renders = 0
  counts.mounts = 0
  toolbarRenders = 0
  chatRenders = 0

  await act(async () => {
    bump!()
  })

  // Sensitivity guard: the parent re-render must actually have reached Chat.
  expect(chatRenders).toBeGreaterThan(0)
  // Neither the rows nor the composer have anything new to draw.
  expect(toolbarRenders).toBe(0)
  expect(counts.renders).toBe(0)
  expect(counts.mounts).toBe(0)
})

it('re-renders only the new row and its neighbour when a message is sent', async () => {
  const rendered: Array<string | number> = []
  const RowSpy = ({ id }: { id: string | number }) => {
    rendered.push(id)
    return <View />
  }
  const renderMessage = (props: { currentMessage: IMessage }) => <RowSpy id={props.currentMessage._id} />
  // The list keeps the newest message first.
  const initial = [...MESSAGES].reverse()
  let setMessages: ((messages: IMessage[]) => void) | undefined

  const Parent = () => {
    const [messages, set] = useState(initial)
    setMessages = set
    // An inline `onSend`, as most apps write it: composer props must not reach the rows.
    return <Chat messages={messages} user={USER} onSend={() => {}} renderMessage={renderMessage} />
  }

  const { getByTestId } = await render(<Parent />)
  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)
  await waitForRows()

  expect(rendered.length).toBeGreaterThan(0) // guard: rows really mounted
  rendered.length = 0

  const sent: IMessage = { _id: 100, text: 'new', createdAt: new Date(2024, 0, 1, 12, 1), user: USER }
  await act(async () => {
    setMessages!([sent, ...initial])
  })

  // The new row, and the previous newest one, whose `nextMessage` is now the new message.
  expect(new Set(rendered)).toEqual(new Set([100, 20]))
})

describe('row store', () => {
  // The newest message first, as the list keeps it.
  const initial = [...MESSAGES].reverse()

  async function setup (extraProps?: (tick: number) => Record<string, unknown>) {
    const rendered: Array<string | number> = []
    const RowSpy = ({ id }: { id: string | number }) => {
      rendered.push(id)
      return <View />
    }
    const renderMessage = (props: { currentMessage: IMessage }) => <RowSpy id={props.currentMessage._id} />
    let setMessages: ((messages: IMessage[]) => void) | undefined
    let bump: (() => void) | undefined

    const Parent = () => {
      const [messages, set] = useState(initial)
      const [tick, setTick] = useState(0)
      setMessages = set
      bump = () => setTick(t => t + 1)
      return (
        <Chat
          messages={messages}
          user={USER}
          onSend={() => {}}
          renderMessage={renderMessage}
          {...extraProps?.(tick)}
        />
      )
    }

    const { getByTestId } = await render(<Parent />)
    await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)
    await waitForRows()
    expect(rendered.length).toBeGreaterThan(0) // guard: rows really mounted
    rendered.length = 0
    return { rendered, setMessages: (m: IMessage[]) => setMessages!(m), bump: () => bump!() }
  }

  it('re-renders only the row whose status changed', async () => {
    const { rendered, setMessages } = await setup()
    await act(async () => {
      setMessages(initial.map(m => (m._id === 18 ? { ...m, sent: true } : m)))
    })
    expect(rendered).toEqual([18])
  })

  it('re-renders nothing when every message object is rebuilt with the same content', async () => {
    const { rendered, setMessages } = await setup()
    await act(async () => {
      setMessages(initial.map(m => ({ ...m, user: { ...m.user } })))
    })
    expect(rendered).toEqual([])
  })

  it('ignores inline handlers and inline styles passed to Chat', async () => {
    const { rendered, bump } = await setup(() => ({
      onPressMessage: () => {},
      onLongPressAvatar: () => {},
      messagesContainerStyle: { flex: 1 },
      timeTextStyle: { left: { color: 'red' } },
    }))
    await act(async () => {
      bump()
    })
    expect(rendered).toEqual([])
  })

  it('re-renders the rows when a new render function is passed', async () => {
    const { rendered, bump } = await setup(tick => ({ renderTime: () => <View testID={`time-${tick}`} /> }))
    await act(async () => {
      bump()
    })
    expect(rendered.length).toBeGreaterThan(0)
  })
})
