import React from 'react'
import { StyleSheet } from 'react-native'

import { Bubble, ChatContext, IMessage } from '..'
import { countEmojiOnly } from '../emojiOnly'
import { defaultLightTheme, mergeTheme } from '../Theme'
import { render } from './renderWithGestureRoot'

describe('countEmojiOnly', () => {
  it('counts plain emoji, ignoring spaces', () => {
    expect(countEmojiOnly('😀')).toBe(1)
    expect(countEmojiOnly('😀😂')).toBe(2)
    expect(countEmojiOnly(' 😀 😂 🎉 ')).toBe(3)
  })

  it('counts a sequence as one emoji', () => {
    expect(countEmojiOnly('👨‍👩‍👧‍👦')).toBe(1) // ZWJ family
    expect(countEmojiOnly('👍🏽')).toBe(1) // skin tone
    expect(countEmojiOnly('🇫🇷')).toBe(1) // flag
    expect(countEmojiOnly('1️⃣')).toBe(1) // keycap
    expect(countEmojiOnly('❤️')).toBe(1) // VS16
    expect(countEmojiOnly('🏳️‍🌈')).toBe(1)
  })

  it('is 0 for anything with text in it', () => {
    expect(countEmojiOnly('hi 😀')).toBe(0)
    expect(countEmojiOnly('1')).toBe(0)
    expect(countEmojiOnly('©')).toBe(0)
    expect(countEmojiOnly('')).toBe(0)
    expect(countEmojiOnly(undefined)).toBe(0)
  })

  it('gives up past the cap', () => {
    expect(countEmojiOnly('😀😀😀', 3)).toBe(3)
    expect(countEmojiOnly('😀😀😀😀', 3)).toBe(0)
  })
})

const message = (text: string, extra: Partial<IMessage> = {}): IMessage => ({
  _id: 1,
  text,
  createdAt: new Date(2024, 0, 1, 12, 0).getTime(),
  user: { _id: 2, name: 'Alice' },
  ...extra,
})

const fontSizeOf = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never)?.fontSize

describe('big emoji in a bubble', () => {
  it('draws a lone emoji large, Telegram\'s size, with no bubble fill', async () => {
    const { getByText, toJSON } = await render(
      <Bubble user={{ _id: 1 }} position='left' currentMessage={message('😀')} />
    )
    expect(fontSizeOf(getByText('😀'))).toBe(40.8)
    // The bubble's fill is cleared, and the time moves into a service pill.
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('{"backgroundColor":"transparent"}')
    expect(tree).toContain(`"backgroundColor":"${defaultLightTheme.colors.dayPillBackground}"`)
  })

  it('steps the size down with the count', async () => {
    const three = await render(<Bubble user={{ _id: 1 }} position='left' currentMessage={message('😀😂🎉')} />)
    expect(fontSizeOf(three.getByText('😀😂🎉'))).toBe(33.6)
    await three.unmount()

    const many = await render(<Bubble user={{ _id: 1 }} position='left' currentMessage={message('😀😂🎉😀😂🎉')} />)
    expect(fontSizeOf(many.getByText('😀😂🎉😀😂🎉'))).toBe(22.8)
  })

  it('keeps the bubble for text, media and quotes', async () => {
    const withText = await render(<Bubble user={{ _id: 1 }} position='left' currentMessage={message('hi 😀')} />)
    expect(fontSizeOf(withText.getByText('hi 😀'))).not.toBe(40.8)
    await withText.unmount()

    const quoted = await render(
      <Bubble
        user={{ _id: 1 }}
        position='left'
        currentMessage={message('😀', { replyMessage: { _id: 9, text: 'earlier', user: { _id: 1 } } })}
      />
    )
    expect(fontSizeOf(quoted.getByText('😀'))).not.toBe(40.8)
  })

  it('can be turned off from the theme', async () => {
    const theme = mergeTheme(defaultLightTheme, { bubble: { bigEmojiMaxCount: 0 } })
    const context = { actionSheet: () => ({ showActionSheetWithOptions: () => {} }), getLocale: () => 'en', getColorScheme: () => 'light' as const, getTheme: () => theme }
    const { getByText } = await render(
      <ChatContext.Provider value={context}>
        <Bubble user={{ _id: 1 }} position='left' currentMessage={message('😀')} />
      </ChatContext.Provider>
    )
    expect(fontSizeOf(getByText('😀'))).not.toBe(40.8)
  })
})
