import React, { useState } from 'react'
import { View } from 'react-native'
import { fireEvent } from '@testing-library/react-native'

import { Chat, EmojiGrid, IMessage } from '..'
import {
  DEFAULT_RECENT_EMOJIS,
  emojiRecents,
  getEmojiCategories,
  searchEmojis,
  takesSkinTone,
  withSkinTone,
  withoutSkinTone,
} from '../emoji/emojiStore'
import { deleteBackward, insertText, previousCharacterStart } from '../emoji/textEditing'
import { render } from './renderWithGestureRoot'

const ME = { _id: 1, name: 'Me' }
const PLACEHOLDER = 'Type a message...'

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

/** Opens the built-in emoji keyboard and lays its grid out, so its rows render. */
const openEmojiKeyboard = async (utils: Awaited<ReturnType<typeof render>>) => {
  await fireEvent.press(utils.getByLabelText('Emoji'))
  await fireEvent(utils.getByTestId('emoji-grid'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
  })
}

beforeEach(() => {
  emojiRecents.reset()
})

describe('text edits', () => {
  it('inserts at the caret, over a selection, or at the end without one', () => {
    expect(insertText('helo', 'l', { start: 2, end: 2 })).toEqual({ text: 'hello', selection: { start: 3, end: 3 } })
    expect(insertText('hello world', '👋', { start: 6, end: 11 })).toEqual({ text: 'hello 👋', selection: { start: 8, end: 8 } })
    expect(insertText('hi', '😀')).toEqual({ text: 'hi😀', selection: { start: 4, end: 4 } })
    // A stale caret past the end (the text was cleared) lands at the end.
    expect(insertText('', '😀', { start: 9, end: 9 }).text).toBe('😀')
  })

  it('deletes a whole emoji with one backspace', () => {
    const cases = ['😀', '👍🏽', '❤️', '1️⃣', '🇺🇸', '👨‍👩‍👧', '🏃🏻‍♂️', '🏴󠁧󠁢󠁳󠁣󠁴󠁿']
    for (const emoji of cases)
      expect(deleteBackward(`a${emoji}`).text).toBe('a')

    expect(previousCharacterStart('🇺🇸🇩🇪', '🇺🇸🇩🇪'.length)).toBe('🇺🇸'.length)
    expect(deleteBackward('abc', { start: 1, end: 3 })).toEqual({ text: 'a', selection: { start: 1, end: 1 } })
    expect(deleteBackward('', { start: 0, end: 0 }).text).toBe('')
  })
})

describe('emoji data', () => {
  it('has the emoji tabs, in order', () => {
    const categories = getEmojiCategories()
    expect(categories.map(category => category.key)).toEqual([
      'smileys', 'animals', 'food', 'activities', 'travel', 'objects', 'symbols', 'flags',
    ])
    expect(categories[0].emojis[0]).toBe('😀')
    expect(categories.reduce((sum, category) => sum + category.emojis.length, 0)).toBeGreaterThan(1800)
    expect(getEmojiCategories(['flags', 'food']).map(category => category.key)).toEqual(['flags', 'food'])
  })

  it('searches by name and short names', () => {
    expect(searchEmojis('thumbs up')).toContain('👍')
    expect(searchEmojis('cat')).toContain('🐈')
    expect(searchEmojis('   ')).toEqual([])
  })

  it('ranks the emoji named exactly the query first', () => {
    expect(searchEmojis('fire')[0]).toBe('🔥')
    expect(searchEmojis('rocket')[0]).toBe('🚀')
  })

  it('applies and strips skin tones', () => {
    expect(takesSkinTone('👍')).toBe(true)
    expect(takesSkinTone('😀')).toBe(false)
    expect(withSkinTone('👍', 2)).toBe('👍🏽')
    expect(withSkinTone('🏃‍♂️', 0)).toBe('🏃🏻‍♂️')
    expect(withSkinTone('😀', 2)).toBe('😀')
    expect(withoutSkinTone('👍🏽')).toBe('👍')
  })

  it('keeps recents: seeded, counted, sorted only on demand, capped at 48', () => {
    expect(emojiRecents.getRecents()).toEqual(DEFAULT_RECENT_EMOJIS)
    for (let i = 0; i < 100; i += 1)
      emojiRecents.add('🦄')
    // Not reshuffled until the next open.
    expect(emojiRecents.getRecents()[0]).toBe('😂')
    emojiRecents.sort()
    expect(emojiRecents.getRecents()[0]).toBe('🦄')
    const fillers = getEmojiCategories(['food'])[0].emojis.slice(0, 30)
    fillers.forEach(emoji => {
      emojiRecents.add(emoji)
      emojiRecents.sort()
    })
    expect(emojiRecents.getRecents().length).toBeLessThanOrEqual(48)
  })
})

describe('emoji keyboard in Chat', () => {
  const messages: IMessage[] = [{ _id: 1, text: 'hi', createdAt: 0, user: { _id: 2, name: 'Bot' } }]

  it('shows the emoji button by default and inserts without the app controlling text', async () => {
    const utils = await mountChat(<Chat messages={messages} onSend={() => {}} user={ME} />)
    await openEmojiKeyboard(utils)

    expect(utils.getByLabelText('Keyboard')).toBeTruthy()
    await fireEvent.press(utils.getAllByLabelText('😂')[0])
    await fireEvent.press(utils.getAllByLabelText('❤️')[0])
    expect(utils.getByTestId(PLACEHOLDER).props.value).toBe('😂❤️')

    // Backspace takes the whole heart, variation selector and all.
    await fireEvent(utils.getByLabelText('Backspace'), 'pressIn')
    await fireEvent(utils.getByLabelText('Backspace'), 'pressOut')
    expect(utils.getByTestId(PLACEHOLDER).props.value).toBe('😂')
  })

  it('inserts at the caret through onChangeText when the app controls text', async () => {
    const onChangeText = jest.fn()
    const Controlled = () => {
      const [text, setText] = useState('')
      return (
        <Chat
          messages={messages}
          onSend={() => {}}
          user={ME}
          text={text}
          textInputProps={{
            onChangeText: (value: string) => {
              onChangeText(value)
              setText(value)
            },
          }}
        />
      )
    }
    const utils = await mountChat(<Controlled />)
    await fireEvent.changeText(utils.getByTestId(PLACEHOLDER), 'ab')
    await fireEvent(utils.getByTestId(PLACEHOLDER), 'selectionChange', {
      nativeEvent: { selection: { start: 1, end: 1 } },
    })
    await openEmojiKeyboard(utils)
    await fireEvent.press(utils.getAllByLabelText('😂')[0])

    expect(onChangeText).toHaveBeenLastCalledWith('a😂b')
    expect(utils.getByTestId(PLACEHOLDER).props.value).toBe('a😂b')
  })

  it('hides the button with emojiKeyboard={false}, and onPressEmoji still takes over', async () => {
    const hidden = await mountChat(<Chat messages={messages} onSend={() => {}} user={ME} emojiKeyboard={false} />)
    expect(hidden.queryByLabelText('Emoji')).toBeNull()
    await hidden.unmount()

    const onPressEmoji = jest.fn()
    const custom = await mountChat(<Chat messages={messages} onSend={() => {}} user={ME} emojiKeyboard={false} onPressEmoji={onPressEmoji} />)
    await fireEvent.press(custom.getByLabelText('Emoji'))
    expect(onPressEmoji).toHaveBeenCalledTimes(1)
    expect(custom.queryByTestId('emoji-keyboard')).toBeNull()
  })

  it('draws a custom keyboard through renderEmojiKeyboard', async () => {
    const { Text } = jest.requireActual('react-native')
    const utils = await mountChat(
      <Chat
        messages={messages}
        onSend={() => {}}
        user={ME}
        emojiKeyboard={{ renderEmojiKeyboard: ({ onSelect }) => <Text onPress={() => onSelect('🦄')}>{'my keyboard'}</Text> }}
      />
    )
    await fireEvent.press(utils.getByLabelText('Emoji'))
    await fireEvent.press(utils.getByText('my keyboard'))
    expect(utils.getByTestId(PLACEHOLDER).props.value).toBe('🦄')
  })
})

describe('EmojiGrid', () => {
  it('searches and selects, counting the pick in recents', async () => {
    const onSelect = jest.fn()
    const utils = await render(<EmojiGrid variant='reactions' columns={8} onSelect={onSelect} />)
    await fireEvent(utils.getByTestId('emoji-grid'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 300 } },
    })

    await fireEvent.changeText(utils.getByLabelText('Search Emoji'), 'unicorn')
    await fireEvent.press(utils.getByLabelText('🦄'))

    expect(onSelect).toHaveBeenCalledWith('🦄')
    emojiRecents.sort()
    expect(emojiRecents.getRecents()).toContain('🦄')
  })

  it('says so when a search finds nothing', async () => {
    const utils = await render(<EmojiGrid variant='reactions' onSelect={jest.fn()} />)
    await fireEvent(utils.getByTestId('emoji-grid'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 300 } },
    })
    await fireEvent.changeText(utils.getByLabelText('Search Emoji'), 'zzzzqqq')
    expect(utils.getByText('No emoji found')).toBeTruthy()
  })
})
