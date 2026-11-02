import React from 'react'
import { View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { Chat } from '..'

// `ChatKeyboardAvoidingView` sits between `Chat` and everything it draws, and takes the composer
// among its children, so it renders whenever `Chat` does. Counting its renders tells whether a
// keystroke reached `Chat`, which a render prop cannot: compiled, `Chat` does not call an
// unchanged one again.
const avoidingViewRenders = { count: 0 }
jest.mock('../Chat/ChatKeyboardAvoidingView', () => {
  const actual = jest.requireActual('../Chat/ChatKeyboardAvoidingView')
  return {
    ...actual,
    ChatKeyboardAvoidingView: (props: Record<string, unknown>) => {
      avoidingViewRenders.count++
      return actual.ChatKeyboardAvoidingView(props)
    },
  }
})

const USER = { _id: 1 }
const PLACEHOLDER = 'Type a message...'
const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } }

it('a keystroke re-renders the composer, not Chat', async () => {
  let sendRenders = 0
  const renderSend = (props: { text?: string }) => {
    sendRenders++
    return <View testID={`send:${props.text ?? ''}`} />
  }

  const { getByTestId } = await render(
    <Chat messages={[]} user={USER} onSend={() => {}} renderSend={renderSend} />
  )
  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)

  avoidingViewRenders.count = 0
  sendRenders = 0

  await fireEvent.changeText(getByTestId(PLACEHOLDER), 'h')
  await fireEvent.changeText(getByTestId(PLACEHOLDER), 'hi')

  // Sensitivity guard: the composer did get the text.
  expect(sendRenders).toBeGreaterThan(0)
  expect(getByTestId('send:hi')).toBeTruthy()
  expect(avoidingViewRenders.count).toBe(0)
})

it('a controlled `text` still reaches the composer', async () => {
  const renderSend = (props: { text?: string }) => <View testID={`send:${props.text ?? ''}`} />
  const { getByTestId, rerender } = await render(
    <Chat messages={[]} user={USER} onSend={() => {}} text='a' renderSend={renderSend} />
  )
  await fireEvent(getByTestId('GC_WRAPPER'), 'layout', LAYOUT)
  expect(getByTestId('send:a')).toBeTruthy()

  await rerender(<Chat messages={[]} user={USER} onSend={() => {}} text='ab' renderSend={renderSend} />)
  expect(getByTestId('send:ab')).toBeTruthy()
})
