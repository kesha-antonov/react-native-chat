import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, renderHook } from '@testing-library/react-native'

import { ChatList, ChatListItem, defaultLabels, getChatPreview, sortChats, useChatList } from '..'

const ME = { _id: 'me', name: 'Alex Morgan' }
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000)

const CHATS: ChatListItem[] = [
  { id: 'anna', title: 'Anna Petrova', unreadCount: 2, lastMessage: { _id: 1, text: 'See you at 7!', createdAt: at(5), user: { _id: 'anna', name: 'Anna' } } },
  { id: 'team', title: 'Team', kind: 'group', isPinned: true, lastMessage: { _id: 2, text: 'Shipping tonight', createdAt: at(60), user: ME } },
  { id: 'max', title: 'Max Ivanov', typingUsers: [{ _id: 'max', name: 'Max' }], lastMessage: { _id: 3, text: 'Hi', createdAt: at(1), user: { _id: 'max' } } },
  { id: 'old', title: 'Old Friend', isArchived: true, unreadCount: 3, lastMessage: { _id: 4, text: 'Long time', createdAt: at(9000), user: { _id: 'old' } } },
]

describe('chat list helpers', () => {
  it('puts pinned chats first, then the newest', () => {
    expect(sortChats(CHATS).map(chat => chat.id)).toEqual(['team', 'max', 'anna', 'old'])
  })

  it('previews a group message with its sender and media by type', () => {
    expect(getChatPreview(CHATS[1], defaultLabels, ME)).toMatchObject({ prefix: 'You: ', text: 'Shipping tonight' })
    const photo: ChatListItem = { id: 'p', title: 'P', lastMessage: { _id: 9, text: '', image: 'https://x/y.jpg', createdAt: 0, user: { _id: 2 } } }
    expect(getChatPreview(photo, defaultLabels, ME)).toMatchObject({ attachment: 'Photo', thumbnail: 'https://x/y.jpg' })
  })
})

describe('ChatList', () => {
  it('draws the rows, typing, unread counters and the archive folder', async () => {
    const { getByText, getByLabelText } = await render(<ChatList chats={CHATS} user={ME} />)
    expect(getByText('Chats')).toBeTruthy()
    expect(getByText('See you at 7!')).toBeTruthy()
    expect(getByText('typing…')).toBeTruthy()
    expect(getByText('2')).toBeTruthy()
    expect(getByLabelText('Archived Chats')).toBeTruthy()
  })

  it('opens the archive and searches', async () => {
    const utils = await render(<ChatList chats={CHATS} user={ME} />)
    await fireEvent.press(utils.getByLabelText('Archived Chats'))
    expect(utils.getByText('Long time')).toBeTruthy()
    expect(utils.queryByText('See you at 7!')).toBeNull()
    await fireEvent.press(utils.getByLabelText('Back'))

    await fireEvent.press(utils.getByLabelText('Search'))
    await fireEvent.changeText(utils.getByPlaceholderText('Search'), 'ann')
    expect(utils.getByText('Anna Petrova')).toBeTruthy()
    expect(utils.queryByText('Max Ivanov')).toBeNull()
  })

  it('selects on long press and runs the selection actions', async () => {
    const onPinChats = jest.fn()
    const onDeleteChats = jest.fn()
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => buttons?.[1]?.onPress?.())
    const utils = await render(<ChatList chats={CHATS} user={ME} onPinChats={onPinChats} onDeleteChats={onDeleteChats} />)

    await fireEvent(utils.getByLabelText('Anna Petrova'), 'longPress')
    expect(utils.getByText('1')).toBeTruthy()
    await fireEvent.press(utils.getByLabelText('Pin'))
    expect(onPinChats).toHaveBeenCalledWith([expect.objectContaining({ id: 'anna' })], true)

    await fireEvent(utils.getByLabelText('Max Ivanov'), 'longPress')
    await fireEvent.press(utils.getByLabelText('Delete'))
    expect(onDeleteChats).toHaveBeenCalledWith([expect.objectContaining({ id: 'max' })])
  })

  it('opens a chat on press and shows the new-chat button', async () => {
    const onPressChat = jest.fn()
    const onPressNewChat = jest.fn()
    const utils = await render(<ChatList chats={CHATS} onPressChat={onPressChat} onPressNewChat={onPressNewChat} />)
    await fireEvent.press(utils.getByLabelText('Anna Petrova'))
    expect(onPressChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'anna' }))
    await fireEvent.press(utils.getByLabelText('New message'))
    expect(onPressNewChat).toHaveBeenCalled()
  })

  it('shows the placeholder while loading, and the empty text', async () => {
    const loading = await render(<ChatList chats={[]} isLoading />)
    expect(loading.getByTestId('chat-list-shimmer')).toBeTruthy()
    await loading.unmount()
    const empty = await render(<ChatList chats={[]} />)
    expect(empty.getByText('No chats here yet')).toBeTruthy()
  })
})

describe('useChatList', () => {
  it('pins, archives, reorders and receives messages', async () => {
    const { result } = await renderHook(() => useChatList(CHATS))
    await act(async () => result.current.handlers.onPinChats([CHATS[0]], true))
    expect(result.current.chats[0]).toMatchObject({ id: 'anna', isPinned: true })

    await act(async () => result.current.handlers.onReorderPinnedChats(['team', 'anna']))
    expect(result.current.chats.slice(0, 2).map(chat => chat.id)).toEqual(['team', 'anna'])

    await act(async () => result.current.handlers.onArchiveChats([result.current.chats[0]], true))
    expect(result.current.chats.find(chat => chat.id === 'team')).toMatchObject({ isArchived: true, isPinned: false })

    await act(async () => result.current.receiveMessage('max', { _id: 10, text: 'New!', createdAt: new Date(), user: { _id: 'max' } }))
    expect(result.current.chats.find(chat => chat.id === 'max')).toMatchObject({ unreadCount: 1, lastMessage: expect.objectContaining({ text: 'New!' }) })
  })
})
