import React from 'react'
import { render } from '@testing-library/react-native'

import { ChatList } from '../ChatList'
import { formatChatListDate } from '../ChatList/utils'
import { buildDefaultMessageActions } from '../components/defaultMessageActions'
import { splitHighlights } from '../components/textHighlight'
import { resolveLabels } from '../i18n'
import { LinkParser } from '../linkParser'
import { IMessage } from '../Models'
import { resolveTheme, defaultLightTheme } from '../Theme'

const ME = { _id: 1 }

describe('highlighted words', () => {
  it('splits text around every case-insensitive match', () => {
    expect(splitHighlights('Take the pill, then another Pill', 'pill')).toEqual([
      { text: 'Take the ', isMatch: false },
      { text: 'pill', isMatch: true },
      { text: ', then another ', isMatch: false },
      { text: 'Pill', isMatch: true },
    ])
    expect(splitHighlights('nothing here', '  ')).toEqual([{ text: 'nothing here', isMatch: false }])
    // Regex characters in the query are plain text
    expect(splitHighlights('a (b) c', '(b)').map(part => part.isMatch)).toEqual([false, true, false])
  })

  it('marks the words in plain text and in links', async () => {
    const { getAllByText } = await render(
      <LinkParser text='see example.com for the example' highlight='example' highlightStyle={{ color: 'red' }} />
    )
    // Both the link's and the text's "example" are marked spans
    const marked = getAllByText('example', { exact: true })
    expect(marked).toHaveLength(2)
    expect(marked.every(node => JSON.stringify(node.props.style).includes('red'))).toBe(true)
  })
})

describe('chat list dates', () => {
  it('uses the given time format today and the date format before this week', () => {
    const today = new Date()
    today.setHours(0, 36, 0, 0)
    expect(formatChatListDate(today, 'en', { timeFormat: 'HH:mm' })).toBe('00:36')

    const old = new Date(today.getFullYear(), today.getMonth() - 2, 5)
    expect(formatChatListDate(old, 'en', { dateFormat: 'DD.MM.YY' })).toMatch(/^05\.\d\d\.\d\d$/)
  })
})

describe('text scale', () => {
  it('multiplies every typography size, and leaves the default theme alone', () => {
    const theme = resolveTheme('light', { textScale: 1.5 })
    expect(theme.typography.message.fontSize).toBe(defaultLightTheme.typography.message.fontSize * 1.5)
    expect(theme.typography.time.lineHeight).toBe(defaultLightTheme.typography.time.lineHeight! * 1.5)
    expect(theme.typography.composer.fontSize).toBe(defaultLightTheme.typography.composer.fontSize * 1.5)
    expect(resolveTheme('light').typography.message.fontSize).toBe(defaultLightTheme.typography.message.fontSize)
  })
})

describe('retry for failed messages', () => {
  const labels = resolveLabels('en')
  const failed = { _id: 'm1', text: 'hi', createdAt: 0, user: ME, isFailed: true } as IMessage

  it('comes first for your own failed message', () => {
    const onRetry = jest.fn()
    const items = buildDefaultMessageActions({ message: failed, user: ME, labels, keys: ['delete'], clipboard: null, onRetry, onDelete: jest.fn() })
    expect(items.map(item => item.key)).toEqual(['retry', 'delete'])
    items[0].onPress?.()
    expect(onRetry).toHaveBeenCalledWith(failed)
  })

  it('is not offered for a sent message or someone else\'s', () => {
    const onRetry = jest.fn()
    const sent = { ...failed, isFailed: false }
    const theirs = { ...failed, user: { _id: 2 } }
    expect(buildDefaultMessageActions({ message: sent, user: ME, labels, keys: [], clipboard: null, onRetry })).toEqual([])
    expect(buildDefaultMessageActions({ message: theirs, user: ME, labels, keys: [], clipboard: null, onRetry })).toEqual([])
  })
})

describe('chat list status', () => {
  it('marks a failed last message instead of showing a check', async () => {
    const chats = [{
      id: 'c1',
      title: 'Anna',
      lastMessage: { _id: 'm1', text: 'hi', createdAt: Date.now(), user: ME, isFailed: true },
    }]
    const { queryByTestId } = await render(<ChatList chats={chats} user={ME} />)
    expect(queryByTestId('chat-list-failed-badge')).toBeTruthy()
  })
})
