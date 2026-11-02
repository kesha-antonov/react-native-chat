import React from 'react'
import { View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { Chat, IMessage } from '..'
import { waitForRows } from './waitForRows'

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

const ME = { _id: 1, name: 'Me' }
const MESSAGE: IMessage = { _id: 1, text: 'typo', user: ME, createdAt: new Date(2024, 0, 1, 12).getTime() }

const mountChat = async (ui: React.ReactElement) => {
  // Lands the keyboard-offset measurement at once, so the chat is revealed.
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await render(ui)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', LAYOUT)
  await waitForRows()
  return utils
}

const longPress = () => act(() => {
  fireGestureHandler(getByGestureTestId('message-long-press'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ])
})

const settle = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
})

// Edit and reply state used to live in `Chat`, and the row menu was rebuilt around the message
// being edited, so starting either re-rendered `Chat` and every mounted row with it.
it('an edit, from start to save, re-renders the composer, not Chat', async () => {
  const onEditMessage = jest.fn()
  const { getByText, getByDisplayValue, queryByText } = await mountChat(
    <Chat messages={[MESSAGE]} onSend={() => {}} user={ME} onEditMessage={onEditMessage} isMultiline={false} />
  )
  await longPress()
  avoidingViewRenders.count = 0

  await fireEvent.press(getByText('Edit'))
  await settle()
  expect(getByText('Editing')).toBeTruthy()
  expect(getByDisplayValue('typo')).toBeTruthy()

  const input = getByDisplayValue('typo')
  await fireEvent.changeText(input, 'fixed')
  await fireEvent(input, 'submitEditing')
  await settle()
  expect(onEditMessage).toHaveBeenCalledWith(expect.objectContaining({ _id: 1 }), 'fixed')
  expect(queryByText('Editing')).toBeNull()
  expect(avoidingViewRenders.count).toBe(0)
})

it('starting a reply re-renders the composer, not Chat', async () => {
  const onSend = jest.fn()
  const { getByText, getByTestId } = await mountChat(
    <Chat messages={[{ ...MESSAGE, user: { _id: 2, name: 'Alice' } }]} onSend={onSend} user={ME} isMultiline={false} />
  )
  await longPress()
  avoidingViewRenders.count = 0

  await fireEvent.press(getByText('Reply'))
  await settle()
  expect(getByText(/Alice/)).toBeTruthy()
  expect(avoidingViewRenders.count).toBe(0)

  // The reply still goes out with the message.
  await fireEvent.changeText(getByTestId(PLACEHOLDER), 'sure')
  await fireEvent(getByTestId(PLACEHOLDER), 'submitEditing')
  expect(onSend).toHaveBeenCalledWith([expect.objectContaining({ text: 'sure', replyMessage: expect.objectContaining({ _id: 1 }) })])
})
