import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'

import { MessageText } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

it('should render <MessageText /> and compare with snapshot', async () => {
  const { toJSON } = await render(
    <MessageText
      currentMessage={DEFAULT_TEST_MESSAGE}
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

// The text a host element holds, its descendants included.
const textOf = (element: { children: unknown[] }): string => element.children
  .map(child => (typeof child === 'string' ? child : textOf(child as { children: unknown[] })))
  .join('')

describe('the trailing time in markdown', () => {
  const markdownMessage = (text: string) => ({ ...DEFAULT_TEST_MESSAGE, text })
  const TIME = <Text testID='time'>12:00</Text>

  it('flows onto the last line of a closing paragraph, as in plain text', async () => {
    const { getByTestId } = await render(
      <MessageText currentMessage={markdownMessage('# Title\n\nsome **bold** words')} markdown trailing={TIME} />
    )
    // The time is inside the paragraph's own Text, not a line of its own.
    const line = getByTestId('time').parent!
    expect(textOf(line)).toContain('words')
  })

  it('follows a closing list item too', async () => {
    const { getByTestId } = await render(
      <MessageText currentMessage={markdownMessage('- one\n- two')} markdown trailing={TIME} />
    )
    const line = getByTestId('time').parent!
    expect(textOf(line)).toContain('two')
  })

  it('takes a line of its own after a code block', async () => {
    const { getByTestId } = await render(
      <MessageText currentMessage={markdownMessage('```\ncode\n```')} markdown trailing={TIME} />
    )
    const line = getByTestId('time').parent!
    expect(textOf(line)).not.toContain('code')
  })
})
