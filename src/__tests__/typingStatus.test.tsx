import React from 'react'
import { render } from '@testing-library/react-native'

import { defaultLabels, getTypingText, TypingStatus } from '..'

const ANNA = { _id: 1, name: 'Anna Petrova' }
const MAX = { _id: 2, name: 'Max Ivanov' }
const SOFIA = { _id: 3, name: 'Sofia Garcia' }

describe('typing status', () => {
  it('reads like a messenger: plain in a private chat, with names in a group', () => {
    expect(getTypingText([ANNA], defaultLabels)).toBe('typing')
    expect(getTypingText([ANNA], defaultLabels, 'typing', true)).toBe('Anna is typing')
    expect(getTypingText([ANNA, MAX], defaultLabels, 'typing', true)).toBe('Anna and Max are typing')
    expect(getTypingText([ANNA, MAX, SOFIA], defaultLabels, 'typing', true)).toBe('Anna and 2 people are typing')
  })

  it('names the action', () => {
    expect(getTypingText([ANNA], defaultLabels, 'recordingVoice')).toBe('recording a voice message')
    expect(getTypingText([ANNA], defaultLabels, 'sendingPhoto', true)).toBe('Anna is sending a photo')
    expect(getTypingText([], defaultLabels)).toBe('')
  })

  it('draws nothing when no one is typing', async () => {
    const empty = await render(<TypingStatus users={[]} color='#000' />)
    expect(empty.toJSON()).toBeNull()
    await empty.unmount()
    const { getByText } = await render(<TypingStatus users={[ANNA]} isGroup color='#000' />)
    expect(getByText('Anna is typing')).toBeTruthy()
  })
})
