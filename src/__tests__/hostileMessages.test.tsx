import React from 'react'
import { Text, View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { Chat, ChatList, IMessage } from '..'
import { waitForRows } from './waitForRows'

// Messages arrive from a server and, through it, from other people. Whatever shape one comes
// in, it must not take the chat down for the person reading it.

const ME = { _id: 1, name: 'Me' }
const base = { _id: 'm', text: 'hi', createdAt: new Date(2024, 0, 1, 12, 0).getTime(), user: { _id: 2, name: 'Eve' } }

const HOSTILE: Array<[string, Record<string, unknown>]> = [
  ['text as a number', { text: 42 }],
  ['text as an object', { text: { evil: true } }],
  ['text as null', { text: null }],
  ['createdAt as garbage', { createdAt: 'not a date' }],
  ['createdAt as an object', { createdAt: { y: 1 } }],
  ['user name as a number', { user: { _id: 2, name: 7 } }],
  ['user avatar as a number', { user: { _id: 2, name: 'Eve', avatar: 5 } }],
  ['user without _id', { user: { name: 'Eve' } }],
  ['image as a number', { image: 123 }],
  ['image as an object', { image: { uri: 'x' } }],
  ['video as a number', { video: 1 }],
  ['audio as a number', { audio: 1 }],
  ['location with strings', { location: { latitude: '1"; x', longitude: 'y' } }],
  ['location with NaN', { location: { latitude: Number.NaN, longitude: Infinity } }],
  ['location as a string', { location: 'here' }],
  ['file with a string size', { file: { uri: 'https://x/a.pdf', name: 'a.pdf', size: 'big' } }],
  ['file without a uri', { file: { name: 7 } }],
  ['file as a string', { file: 'a.pdf' }],
  ['reactions as a string', { reactions: 'lol' }],
  ['reactions with junk entries', { reactions: [null, 5, { emoji: 7 }, { emoji: '👍', users: 'x' }] }],
  ['reactions as an object', { reactions: { '👍': 'x' } }],
  ['quick replies as a string', { quickReplies: 'yes' }],
  ['quick replies with junk values', { quickReplies: { type: 'radio', values: [null, 3, { title: 9 }] } }],
  ['replyMessage as a string', { replyMessage: 'x' }],
  ['replyMessage with junk', { replyMessage: { _id: 9, text: 5, user: 3 } }],
  ['linkPreview as a string', { linkPreview: 'x' }],
  ['linkPreview with junk', { linkPreview: { url: 5, title: {}, image: 3, imageWidth: 'w' } }],
  ['voice waveform as a string', { audio: 'https://x/a.m4a', waveform: 'loud', duration: 'long' }],
  ['system text as an object', { system: true, text: { a: 1 } }],
  ['huge unbroken text', { text: 'a.'.repeat(50_000) }],
  ['deeply nested markdown', { text: '*'.repeat(10_000) + 'x' + '*'.repeat(10_000) }],
  ['many short links', { text: Array.from({ length: 2000 }, (_, i) => `s${i}.co`).join(' ') }],
  ['no _id', { _id: undefined }],
  ['_id as null', { _id: null }],
  ['_id as an object', { _id: { a: 1 } }],
  ['_id shared with the next message', { _id: 'ok' }],
  ['control and bidi characters', { text: 'a‮b\u0000c﻿d‏e' }],
  ['nested 100000 levels deep', { extra: Array.from({ length: 100_000 }).reduce<unknown>(value => ({ value }), {}) }],
  ['lone surrogates', { text: '𐀀\uD800x\uDFFF' }],
]

const mountChat = async (messages: IMessage[]) => {
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await render(<Chat messages={messages} onSend={() => {}} user={ME} />)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })
  await waitForRows()
  return utils
}

describe('a malformed or hostile message', () => {
  it.each(HOSTILE)('with %s does not take the chat down', async (_name, patch) => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const hostile = { ...base, ...patch } as unknown as IMessage
    const ok: IMessage = { _id: 'ok', text: 'still here', createdAt: base.createdAt, user: { _id: 2, name: 'Eve' } }
    const { getByText, queryAllByText } = await mountChat([ok, hostile])
    expect(getByText('still here')).toBeTruthy()
    // A duplicate id must not show one message twice.
    expect(queryAllByText('still here')).toHaveLength(1)
  })
})

describe('a malformed chat in the chat list', () => {
  const lastMessage = { ...base }
  const HOSTILE_CHATS: Array<[string, Record<string, unknown>]> = [
    ['title as a number', { title: 5 }],
    ['title as an object', { title: { a: 1 } }],
    ['avatar as a number', { avatar: 3 }],
    ['unread count as a string', { unreadCount: 'many' }],
    ['draft as an object', { draft: { a: 1 } }],
    ['typing users as a string', { typingUsers: 'Eve' }],
    ['typing users with junk', { typingUsers: [null, 5, { _id: 3, name: 9 }] }],
    ['last message text as an object', { lastMessage: { ...lastMessage, text: { a: 1 } } }],
    ['last message without a date', { lastMessage: { ...lastMessage, createdAt: 'never' } }],
    ['last message user name as a number', { lastMessage: { ...lastMessage, user: { _id: 2, name: 9 } } }],
    ['last message as a string', { lastMessage: 'hi' }],
    ['last message file name as a number', { lastMessage: { ...lastMessage, text: '', file: { uri: 'https://x', name: 4 } } }],
  ]

  it.each(HOSTILE_CHATS)('with %s does not take the list down', async (_name, patch) => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const hostile = { id: 'h', title: 'Hostile', kind: 'group', lastMessage, ...patch }
    const ok = { id: 'ok', title: 'Still here', lastMessage }
    const { getByText } = await render(<ChatList chats={[hostile, ok] as never} user={ME} />)
    expect(getByText('Still here')).toBeTruthy()
  })
})

describe('a row that throws while rendering', () => {
  it('hides only itself and logs its id, not its content', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest
      .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
      .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
    const messages: IMessage[] = [
      { _id: 'bad', text: 'secret 4111', createdAt: base.createdAt, user: { _id: 2, name: 'Eve' } },
      { _id: 'ok', text: 'still here', createdAt: base.createdAt, user: { _id: 2, name: 'Eve' } },
    ]
    const renderMessageText = (props: { currentMessage: IMessage }) => {
      if (props.currentMessage._id === 'bad')
        throw new Error('boom')
      return <Text>{props.currentMessage.text}</Text>
    }
    const utils = await render(
      <Chat messages={messages} onSend={() => {}} user={ME} renderMessageText={renderMessageText as never} />
    )
    await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    })
    await waitForRows()
    expect(utils.getByText('still here')).toBeTruthy()
    expect(utils.queryByText('secret 4111')).toBeNull()
    const printed = log.mock.calls.flat().join(' ')
    expect(printed).toContain('Message bad failed to render')
    expect(printed).not.toContain('4111')
  })
})
