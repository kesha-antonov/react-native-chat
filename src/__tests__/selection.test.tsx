import React from 'react'
import { Text, View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { Chat, IMessage } from '..'
import { createMessageSelectionStore } from '../components/messageSelection'

const mockSetStringAsync = jest.fn(() => Promise.resolve(true))
jest.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockSetStringAsync(text),
}), { virtual: true })

const ME = { _id: 1, name: 'Me' }
const ALICE = { _id: 2, name: 'Alice' }

// Newest first.
const MESSAGES: IMessage[] = [3, 2, 1].map(id => ({
  _id: id,
  text: `message ${id}`,
  user: id === 2 ? ME : ALICE,
  createdAt: new Date(2024, 0, 1, 12, id).getTime(),
}))

const mountChat = async (ui: React.ReactElement) => {
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await render(ui)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })
  return utils
}

const settle = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
})

/**
 * Long-presses a message and picks "Select". Every row registers its gesture under the same test
 * id and the last one wins, so this is the oldest message (`_id` 1, the last row).
 */
const startSelecting = async (utils: Awaited<ReturnType<typeof mountChat>>) => {
  await act(() => {
    fireGestureHandler(getByGestureTestId('message-long-press'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ])
  })
  await fireEvent.press(utils.getByText('Select'))
  await settle()
}

describe('selection store', () => {
  it('starts with one message, toggles, and ends with the last one unchecked', () => {
    const store = createMessageSelectionStore()
    const listener = jest.fn()
    store.subscribe(listener)

    store.start(1)
    expect(store.isActive()).toBe(true)
    store.toggle(2)
    expect(store.getSelectedIds()).toEqual([1, 2])
    store.toggle(1)
    store.toggle(2)
    expect(store.isActive()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('drops deleted messages', () => {
    const store = createMessageSelectionStore()
    store.start(1)
    store.toggle(2)
    store.retain(new Set([2, 3]))
    expect(store.getSelectedIds()).toEqual([2])
    store.retain(new Set([3]))
    expect(store.isActive()).toBe(false)
  })
})

describe('multi-select', () => {
  it('starts from the menu\'s Select, with checks and the selection bar', async () => {
    const utils = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} />)
    await startSelecting(utils)

    expect(utils.getByTestId('selection-bar')).toBeTruthy()
    expect(utils.getByText('1')).toBeTruthy()
    expect(utils.getAllByRole('checkbox', { checked: true }).length).toBeGreaterThan(0)
    // The composer gives way to the bar.
    expect(utils.queryByPlaceholderText('Type a message...')).toBeNull()
  })

  it('checks and unchecks messages with a tap, and reports the selection', async () => {
    const onSelectionChange = jest.fn()
    const utils = await mountChat(
      <Chat messages={MESSAGES} onSend={() => {}} user={ME} onSelectionChange={onSelectionChange} />
    )
    await startSelecting(utils)
    expect(onSelectionChange).toHaveBeenLastCalledWith([MESSAGES[2]])

    const toggles = utils.getAllByTestId('message-select-toggle')
    await fireEvent.press(toggles[1])
    expect(utils.getByText('2')).toBeTruthy()
    expect(onSelectionChange).toHaveBeenLastCalledWith([MESSAGES[2], MESSAGES[1]])

    // Unchecking everything ends the mode.
    await fireEvent.press(toggles[2])
    await fireEvent.press(toggles[1])
    expect(onSelectionChange).toHaveBeenLastCalledWith([])
    expect(utils.queryByTestId('selection-bar')).toBeNull()
  })

  it('copies the selected texts, oldest first', async () => {
    const utils = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} />)
    await startSelecting(utils)
    await fireEvent.press(utils.getAllByTestId('message-select-toggle')[0])

    await fireEvent.press(utils.getByLabelText('Copy'))
    expect(mockSetStringAsync).toHaveBeenCalledWith('message 1\n\nmessage 3')
    expect(utils.queryByTestId('selection-bar')).toBeNull()
  })

  it('deletes through onDeleteMessage, one call per message', async () => {
    const onDeleteMessage = jest.fn()
    const utils = await mountChat(
      <Chat messages={MESSAGES} onSend={() => {}} user={ME} onDeleteMessage={onDeleteMessage} />
    )
    await startSelecting(utils)
    await fireEvent.press(utils.getAllByTestId('message-select-toggle')[1])

    await fireEvent.press(utils.getByLabelText('Delete'))
    expect(onDeleteMessage.mock.calls.map(([message]) => message._id)).toEqual([1, 2])
  })

  it('prefers the batch callbacks when given', async () => {
    const onForwardMessages = jest.fn()
    const onDeleteMessages = jest.fn()
    const utils = await mountChat(
      <Chat
        messages={MESSAGES}
        onSend={() => {}}
        user={ME}
        onForwardMessages={onForwardMessages}
        onDeleteMessages={onDeleteMessages}
      />
    )
    await startSelecting(utils)
    await fireEvent.press(utils.getByLabelText('Forward'))
    expect(onForwardMessages).toHaveBeenCalledWith([MESSAGES[2]])
  })

  it('closes with the X', async () => {
    const utils = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} />)
    await startSelecting(utils)
    await fireEvent.press(utils.getByLabelText('Cancel selection'))
    expect(utils.queryByTestId('selection-bar')).toBeNull()
  })

  it('takes a custom bar, or none', async () => {
    const custom = await mountChat(
      <Chat
        messages={MESSAGES}
        onSend={() => {}}
        user={ME}
        renderSelectionBar={({ count, messages }) => <Text>{`picked ${count}: ${messages.map(m => m._id).join(',')}`}</Text>}
      />
    )
    await startSelecting(custom)
    expect(custom.getByText('picked 1: 1')).toBeTruthy()
    await custom.unmount()

    const none = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} renderSelectionBar={null} />)
    await startSelecting(none)
    expect(none.queryByTestId('selection-bar')).toBeNull()
    expect(none.getAllByTestId('message-select-toggle').length).toBe(3)
  })
})
