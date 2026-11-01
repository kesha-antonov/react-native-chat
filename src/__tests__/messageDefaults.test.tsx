import React from 'react'
import { View } from 'react-native'
import { act, fireEvent, render, renderHook } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { Chat, IMessage, MessageMenuItem, getChatCapabilities, toggleReaction, useChatMessages } from '..'
import { buildDefaultMessageActions, DEFAULT_MESSAGE_ACTION_KEYS } from '../components/defaultMessageActions'
import { createMessageHighlightStore } from '../components/messageHighlight'
import { defaultLabels } from '../i18n'

const mockSetStringAsync = jest.fn(() => Promise.resolve(true))
jest.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockSetStringAsync(text),
}), { virtual: true })

const ME = { _id: 1, name: 'Me' }
/** Where the swipe takes over from the list, 0.4cm (`getPixelsInCM(0.4f)`). */
const SWIPE_TAKEOVER = 25
const ALICE = { _id: 2, name: 'Alice' }
const BOB = { _id: 3, name: 'Bob' }

const message = (id: number, user = ALICE, text = `message ${id}`): IMessage => ({
  _id: id,
  text,
  user,
  createdAt: new Date(2024, 0, 1, 12, id).getTime(),
})

const clipboard = { setString: jest.fn() }

const build = (overrides: Partial<Parameters<typeof buildDefaultMessageActions>[0]> = {}) =>
  buildDefaultMessageActions({
    message: message(1, ME),
    user: ME,
    labels: defaultLabels,
    keys: DEFAULT_MESSAGE_ACTION_KEYS,
    clipboard,
    onReply: jest.fn(),
    onEdit: jest.fn(),
    onForward: jest.fn(),
    onPin: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  })

describe('default message actions', () => {
  it('offers Telegram\'s set in Telegram\'s order, with icons and a red Delete', () => {
    const items = build()
    expect(items.map(item => item.key)).toEqual(['reply', 'copy', 'forward', 'pin', 'edit', 'delete'])
    expect(items.map(item => item.label)).toEqual(['Reply', 'Copy', 'Forward', 'Pin', 'Edit', 'Delete'])
    expect(items.every(item => typeof item.icon === 'function')).toBe(true)
    expect(items.find(item => item.key === 'delete')!.destructive).toBe(true)
  })

  it('shows each action only when it can work', () => {
    expect(build({ onReply: undefined, onForward: undefined, onPin: undefined, onDelete: undefined }).map(i => i.key))
      .toEqual(['copy', 'edit'])
    // A pinned message offers Unpin.
    expect(build({ message: { ...message(1, ME), isPinned: true } }).find(i => i.key === 'pin')!.label).toBe('Unpin')
    // Someone else's message cannot be edited.
    expect(build({ message: message(1, ALICE) }).map(i => i.key)).not.toContain('edit')
    // Nothing to copy or edit without text.
    expect(build({ message: { ...message(1, ME), text: '', image: 'x' } }).map(i => i.key))
      .toEqual(['reply', 'forward', 'pin', 'delete'])
    // No clipboard peer, no Copy.
    expect(build({ clipboard: null }).map(i => i.key)).not.toContain('copy')
    // System messages get no menu.
    expect(build({ message: { ...message(1, ME), system: true } })).toEqual([])
  })

  it('follows the keys it is given, in their order', () => {
    expect(build({ keys: ['delete', 'reply'] }).map(i => i.key)).toEqual(['delete', 'reply'])
  })

  it('copies the text through the clipboard', () => {
    build().find(item => item.key === 'copy')!.onPress()
    expect(clipboard.setString).toHaveBeenCalledWith('message 1')
  })
})

describe('Chat.toggleReaction', () => {
  const base = [message(1), message(2)]

  it('adds, then takes back, a reaction without touching other messages', () => {
    const added = Chat.toggleReaction(base, 1, '👍', ME._id)
    expect(added[0].reactions).toEqual([{ emoji: '👍', userIds: [1] }])
    expect(added[1]).toBe(base[1])
    expect(base[0].reactions).toBeUndefined()

    const removed = toggleReaction(added, 1, '👍', ME._id)
    expect(removed[0].reactions).toEqual([])
  })

  it('joins an existing reaction and keeps other users in it', () => {
    const withAlice = toggleReaction(base, 1, '❤️', ALICE._id)
    const both = toggleReaction(withAlice, 1, '❤️', ME._id)
    expect(both[0].reactions).toEqual([{ emoji: '❤️', userIds: [2, 1] }])
    expect(toggleReaction(both, 1, '❤️', ME._id)[0].reactions).toEqual([{ emoji: '❤️', userIds: [2] }])
  })

  it('replaces the user\'s reaction by default, as Telegram does, unless more are allowed', () => {
    const first = toggleReaction(base, 1, '👍', ME._id)
    expect(toggleReaction(first, 1, '🔥', ME._id)[0].reactions).toEqual([{ emoji: '🔥', userIds: [1] }])
    expect(toggleReaction(first, 1, '🔥', ME._id, { maxPerUser: Infinity })[0].reactions).toEqual([
      { emoji: '👍', userIds: [1] },
      { emoji: '🔥', userIds: [1] },
    ])
  })
})

describe('useChatMessages', () => {
  it('wires send, edit, delete and reactions to local state', async () => {
    const { result } = await renderHook(() => useChatMessages({ initialMessages: [message(1)], user: ME }))

    await act(() => result.current.chatProps.onSend([message(2, ME)]))
    expect(result.current.messages.map(m => m._id)).toEqual([2, 1])

    await act(() => result.current.chatProps.onEditMessage(result.current.messages[0], 'edited'))
    expect(result.current.messages[0].text).toBe('edited')

    await act(() => result.current.chatProps.reactions.onReactionPress(result.current.messages[1], '👍'))
    expect(result.current.messages[1].reactions).toEqual([{ emoji: '👍', userIds: [1] }])

    await act(() => result.current.chatProps.onDeleteMessage(result.current.messages[0]))
    expect(result.current.messages.map(m => m._id)).toEqual([1])
  })
})

describe('message highlight store', () => {
  it('flashes one message at a time and clears itself', () => {
    jest.useFakeTimers()
    try {
      const store = createMessageHighlightStore()
      const listener = jest.fn()
      store.subscribe(listener)

      store.highlight(5)
      expect(store.getToken(5)).toBe(1)
      expect(store.getToken(6)).toBe(0)
      store.highlight(5)
      expect(store.getToken(5)).toBe(2)

      jest.advanceTimersByTime(2500)
      expect(store.getToken(5)).toBe(0)
      expect(listener).toHaveBeenCalledTimes(3)
      store.dispose()
    } finally {
      jest.useRealTimers()
    }
  })
})

it('reports capabilities from the installed peers', () => {
  const capabilities = getChatCapabilities()
  expect(capabilities.clipboard).toBe(true)
  expect(Object.values(capabilities).every(value => typeof value === 'boolean')).toBe(true)
})

const mountChat = async (ui: React.ReactElement) => {
  // Lands the keyboard-offset measurement at once, so the chat is revealed.
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await render(ui)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })
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

describe('Chat defaults', () => {
  it('opens the menu with Reply and Copy on long-press, with nothing configured', async () => {
    const { getByText } = await mountChat(
      <Chat messages={[message(1)]} onSend={() => {}} user={ME} />
    )

    await longPress()
    expect(getByText('Reply')).toBeTruthy()
    expect(getByText('Copy')).toBeTruthy()

    await fireEvent.press(getByText('Copy'))
    await settle()
    expect(mockSetStringAsync).toHaveBeenCalledWith('message 1')
  })

  it('hands a messageActions function the defaults to extend', async () => {
    const custom: MessageMenuItem = { label: 'Report', onPress: jest.fn() }
    const messageActions = jest.fn((_m: IMessage, defaults: MessageMenuItem[]) =>
      [...defaults.filter(item => item.key !== 'copy'), custom])

    const { getByText, queryByText } = await mountChat(
      <Chat messages={[message(1)]} onSend={() => {}} user={ME} messageActions={messageActions} />
    )

    await longPress()
    expect(getByText('Reply')).toBeTruthy()
    expect(getByText('Report')).toBeTruthy()
    expect(queryByText('Copy')).toBeNull()
  })

  it('leaves long-press to an app that already handles it', async () => {
    const onLongPressMessage = jest.fn()
    const { getByText, queryByText } = await mountChat(
      <Chat messages={[message(1)]} onSend={() => {}} user={ME} onLongPressMessage={onLongPressMessage} />
    )

    await fireEvent(getByText('message 1'), 'longPress')
    expect(onLongPressMessage).toHaveBeenCalled()
    expect(queryByText('Reply')).toBeNull()
  })

  it('edits your own message: Edit fills the composer and Send saves through onEditMessage', async () => {
    const onSend = jest.fn()
    const onEditMessage = jest.fn()
    const { getByText, getByDisplayValue, queryByText } = await mountChat(
      <Chat messages={[message(1, ME, 'typo')]} onSend={onSend} user={ME} onEditMessage={onEditMessage} isMultiline={false} />
    )

    await longPress()
    await fireEvent.press(getByText('Edit'))
    await settle()

    expect(getByText('Editing')).toBeTruthy()
    const input = getByDisplayValue('typo')
    await fireEvent.changeText(input, 'fixed')
    await fireEvent(input, 'submitEditing')

    expect(onEditMessage).toHaveBeenCalledWith(expect.objectContaining({ _id: 1 }), 'fixed')
    expect(onSend).not.toHaveBeenCalled()
    await settle()
    expect(queryByText('Editing')).toBeNull()
  })

  it('turns reactions on once onReactionPress is passed', async () => {
    const { getByText } = await mountChat(
      <Chat messages={[message(1)]} onSend={() => {}} user={ME} reactions={{ onReactionPress: jest.fn() }} />
    )

    await longPress()
    expect(getByText('👍')).toBeTruthy()
  })

  it('shows avatars and names only in a group chat', async () => {
    const group = await mountChat(
      <Chat messages={[message(2, BOB), message(1)]} onSend={() => {}} user={ME} />
    )
    expect(group.getByText('Alice')).toBeTruthy()
    expect(group.getByText('Bob')).toBeTruthy()
    // Initials avatars.
    expect(group.getByText('A')).toBeTruthy()
  })

  it('hides avatars and names in a one-to-one chat', async () => {
    const { getByText, queryByText } = await mountChat(
      <Chat messages={[message(2), message(1)]} onSend={() => {}} user={ME} />
    )
    expect(getByText('message 2')).toBeTruthy()
    expect(queryByText('Alice')).toBeNull()
    expect(queryByText('A')).toBeNull()
  })

  it('replies on a swipe past 50pt, Telegram Android\'s threshold, and not before', async () => {
    const { getByText, queryByText } = await mountChat(
      <Chat messages={[message(1)]} onSend={() => {}} user={ME} />
    )

    const swipe = (translationX: number) => act(() => {
      fireGestureHandler(getByGestureTestId('swipe-to-reply'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: -SWIPE_TAKEOVER },
        { state: State.ACTIVE, translationX },
        { state: State.END, translationX },
      ])
    })

    // 25pt to take over, then 40pt of travel: short of the threshold.
    await swipe(-65)
    expect(queryByText('Replying to Alice')).toBeNull()

    await swipe(-90)
    expect(getByText('Replying to Alice')).toBeTruthy()
  })

  it('jumps to the quoted message and flashes it when the quote is tapped', async () => {
    const original = message(1)
    const answer: IMessage = {
      ...message(2, ME, 'answer'),
      replyMessage: { _id: original._id, text: original.text, user: original.user },
    }
    const { getAllByText, queryByTestId, getByTestId } = await mountChat(
      <Chat messages={[answer, original]} onSend={() => {}} user={ME} />
    )

    expect(queryByTestId('message-highlight')).toBeNull()
    // The quote repeats the original's text; the first match is the quote inside the answer.
    await fireEvent.press(getAllByText('message 1')[0])
    expect(getByTestId('message-highlight')).toBeTruthy()
  })

})
