import React, { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import { Chat, IMessage } from '..'
import { RecordingBar } from '../components/RecordingBar'
import { MessageProps } from '../Message'
import { LIST_ITEM_DURATION } from '../MessagesContainer/listTransitions'
import { createStore } from '../store'
import { TypingIndicator, TypingIndicatorListAnimationContext } from '../TypingIndicator'
import { render as renderPlain } from './renderWithGestureRoot'
import { waitForRows } from './waitForRows'

const messages: IMessage[] = [
  { _id: 'b', text: 'Second', createdAt: new Date(2026, 0, 1, 10, 1), user: { _id: 2, name: 'Bob' } },
  { _id: 'a', text: 'First', createdAt: new Date(2026, 0, 1, 10, 0), user: { _id: 1, name: 'Me' } },
]

describe('list motion', () => {
  it('uses the list animation duration', () => {
    expect(LIST_ITEM_DURATION).toBe(250)
  })
})

describe('Chat across a color scheme switch', () => {
  // Switching to the dark theme (which paints outgoing bubbles from a screen-wide gradient)
  // used to wrap the list in a new provider, so React remounted it and the chat jumped back
  // to the newest message. A remount gives a new host instance for the same row.
  it('keeps the message list mounted', async () => {
    let mounts = 0
    const Row = ({ text }: { text?: string }) => {
      useEffect(() => {
        mounts++
      }, [])
      return <Text>{text}</Text>
    }
    const renderMessage = (rowProps: MessageProps<IMessage>) => <Row text={rowProps.currentMessage.text} />
    const onSend = () => {}
    let setScheme: ((scheme: 'light' | 'dark') => void) | undefined
    const Parent = () => {
      const [scheme, setSchemeState] = useState<'light' | 'dark'>('light')
      setScheme = setSchemeState
      return <Chat messages={messages} onSend={onSend} user={{ _id: 1 }} renderMessage={renderMessage} colorScheme={scheme} />
    }

    const { getByTestId } = await render(<Parent />)
    await fireEvent(getByTestId('GC_WRAPPER'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } })
    await waitForRows()
    expect(mounts).toBeGreaterThan(0) // guard: rows really mounted
    mounts = 0

    await act(async () => {
      setScheme!('dark')
    })

    expect(mounts).toBe(0)
  })
})

describe('TypingIndicator inside an animated list', () => {
  it('mounts while typing and unmounts when it stops', async () => {
    const { queryByTestId, rerender } = await renderPlain(
      <TypingIndicatorListAnimationContext.Provider value>
        <TypingIndicator isTyping style={{ opacity: 1 }} />
      </TypingIndicatorListAnimationContext.Provider>
    )
    expect(queryByTestId('typing-indicator')).not.toBeNull()

    await rerender(
      <TypingIndicatorListAnimationContext.Provider value>
        <TypingIndicator isTyping={false} />
      </TypingIndicatorListAnimationContext.Provider>
    )
    expect(queryByTestId('typing-indicator')).toBeNull()
  })
})

describe('RecordingBar', () => {
  const baseProps = {
    elapsed: createStore(3_400),
    isBlinking: true,
    isCancelled: false,
    slideProgress: { value: 1 } as never,
    slideDistance: 100,
    onCancel: () => {},
  }

  it('keeps CANCEL while a locked take is cancelled', async () => {
    const { queryByText, rerender } = await renderPlain(<RecordingBar {...baseProps} isLocked />)
    expect(queryByText('CANCEL')).not.toBeNull()

    // The composer clears the lock as it cancels; the bar must not fall back to its unlocked look.
    await rerender(<RecordingBar {...baseProps} isLocked={false} isCancelled />)
    expect(queryByText('CANCEL')).not.toBeNull()
  })

  it('ticks its timer from the meter store', async () => {
    const elapsed = createStore(3_400)
    const { getByLabelText } = await renderPlain(<RecordingBar {...baseProps} elapsed={elapsed} isLocked={false} />)
    expect(getByLabelText('0:03,4')).toBeTruthy()

    await act(async () => {
      elapsed.set(5_600)
    })
    expect(getByLabelText('0:05,6')).toBeTruthy()
  })

  it('drops CANCEL for an unlocked take', async () => {
    const { queryByText } = await renderPlain(<RecordingBar {...baseProps} isLocked={false} />)
    expect(queryByText('CANCEL')).toBeNull()
  })
})
