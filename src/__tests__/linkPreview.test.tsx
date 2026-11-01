import React from 'react'
import { Linking, Text } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'

import { Bubble, IMessage, findFirstUrl } from '..'
import { resetLinkPreviewCache } from '../components/LinkPreviewCard'
import { render } from './renderWithGestureRoot'

const message = (text: string, extra: Partial<IMessage> = {}): IMessage => ({
  _id: 1,
  text,
  createdAt: new Date(2024, 0, 1, 12, 0).getTime(),
  user: { _id: 2, name: 'Alice' },
  ...extra,
})

const PREVIEW = {
  siteName: 'GitHub',
  title: 'kesha-antonov/react-native-chat',
  description: 'The most complete chat UI for React Native',
  image: 'https://example.com/og.png',
  imageWidth: 1200,
  imageHeight: 600,
}

beforeEach(() => resetLinkPreviewCache())

describe('findFirstUrl', () => {
  it('finds the first link and gives it a scheme', () => {
    expect(findFirstUrl('see https://github.com/x/y, nice')).toBe('https://github.com/x/y')
    expect(findFirstUrl('www.example.com.')).toBe('https://www.example.com')
    expect(findFirstUrl('go to telegram.org now')).toBe('https://telegram.org')
    expect(findFirstUrl('no links here')).toBeUndefined()
    expect(findFirstUrl('mail me at me@example.com')).toBeUndefined()
  })
})

describe('link preview', () => {
  it('draws the message\'s own preview under the text', async () => {
    const { getByText, getByTestId } = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('look https://github.com/kesha-antonov/react-native-chat', { linkPreview: PREVIEW })} />
    )
    expect(getByTestId('link-preview')).toBeTruthy()
    expect(getByText('GitHub')).toBeTruthy()
    expect(getByText('kesha-antonov/react-native-chat')).toBeTruthy()
    expect(getByText('The most complete chat UI for React Native')).toBeTruthy()
  })

  it('opens the page when tapped', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { getByTestId } = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('look https://github.com/x', { linkPreview: PREVIEW })} />
    )
    await fireEvent.press(getByTestId('link-preview'))
    expect(openURL).toHaveBeenCalledWith('https://github.com/x')
  })

  it('falls back to the host for the site name', async () => {
    const { getByText } = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('https://www.telegram.org/blog', { linkPreview: { title: 'Blog' } })} />
    )
    expect(getByText('telegram.org')).toBeTruthy()
  })

  it('fetches one for a link without a preview, once per URL', async () => {
    const fetchLinkPreview = jest.fn(async () => PREVIEW)
    const first = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('https://github.com/x')} fetchLinkPreview={fetchLinkPreview} />
    )
    await act(async () => {})
    expect(first.getByText('GitHub')).toBeTruthy()
    await first.unmount()

    const second = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('again https://github.com/x')} fetchLinkPreview={fetchLinkPreview} />
    )
    expect(second.getByText('GitHub')).toBeTruthy()
    expect(fetchLinkPreview).toHaveBeenCalledTimes(1)
    expect(fetchLinkPreview).toHaveBeenCalledWith('https://github.com/x')
  })

  it('draws nothing for a page without a preview, or a message that turns it off', async () => {
    const fetchLinkPreview = jest.fn(async () => null)
    const none = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('https://nothing.example')} fetchLinkPreview={fetchLinkPreview} />
    )
    await act(async () => {})
    expect(none.queryByTestId('link-preview')).toBeNull()
    await none.unmount()

    const off = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('https://github.com/y', { linkPreview: null })} fetchLinkPreview={fetchLinkPreview} />
    )
    await act(async () => {})
    expect(off.queryByTestId('link-preview')).toBeNull()
  })

  it('takes a custom renderer, or null', async () => {
    const custom = await render(
      <Bubble
        user={{ _id: 1 }}
        position='left'
        currentMessage={message('https://github.com/x', { linkPreview: PREVIEW })}
        renderLinkPreview={({ preview }) => <Text>{`custom ${preview.url}`}</Text>}
      />
    )
    expect(custom.getByText('custom https://github.com/x')).toBeTruthy()
    await custom.unmount()

    const hidden = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('https://github.com/x', { linkPreview: PREVIEW })} renderLinkPreview={null} />
    )
    expect(hidden.queryByTestId('link-preview')).toBeNull()
  })
})
