import React from 'react'
import { render } from '@testing-library/react-native'

// react-native-streamdown 0.3 exports `StreamdownText`, which takes the text as a `markdown`
// prop and its look as a `markdownStyle` object.
jest.mock('react-native-streamdown', () => {
  const { Text: MockText } = require('react-native')
  return {
    StreamdownText: (props: { markdown: string, markdownStyle?: unknown }) => (
      <MockText testID='streamdown' accessibilityHint={JSON.stringify(props.markdownStyle)}>{props.markdown}</MockText>
    ),
  }
}, { virtual: true })

// eslint-disable-next-line import/first
import { MessageText } from '..'
// eslint-disable-next-line import/first
import { buildMarkdownStyle } from '../components/MarkdownMessageText'
// eslint-disable-next-line import/first
import { DEFAULT_TEST_MESSAGE } from './data'

const message = { ...DEFAULT_TEST_MESSAGE, text: 'some **bold** words' }
const setBundleMode = (value: boolean | undefined) => {
  (globalThis as { _WORKLETS_BUNDLE_MODE_ENABLED?: boolean })._WORKLETS_BUNDLE_MODE_ENABLED = value
}

describe('react-native-streamdown 0.3', () => {
  afterEach(() => setBundleMode(undefined))

  it('renders through StreamdownText under worklets Bundle Mode', async () => {
    setBundleMode(true)
    const { getByTestId } = await render(<MessageText currentMessage={message} markdown />)
    const node = getByTestId('streamdown')
    expect(node.children.join('')).toBe('some **bold** words')
    // The bubble's text color reaches the native renderer.
    expect(JSON.parse(node.props.accessibilityHint).paragraph.color).toBeTruthy()
  })

  it('keeps the built-in renderer without Bundle Mode, where StreamdownText would throw', async () => {
    setBundleMode(false)
    const { queryByTestId, getByText } = await render(<MessageText currentMessage={message} markdown />)
    expect(queryByTestId('streamdown')).toBeNull()
    expect(getByText('bold')).toBeTruthy()
  })

  it('maps the text and link styles onto markdownStyle, with overrides merged per element', () => {
    const style = buildMarkdownStyle(
      { color: '#111111', fontSize: 16, lineHeight: 21 },
      { color: '#2481cc', textDecorationLine: 'underline' },
      { paragraph: { marginBottom: 0 }, codeBlock: { backgroundColor: '#000000' } }
    )
    expect(style.paragraph).toMatchObject({ color: '#111111', fontSize: 16, lineHeight: 21, marginBottom: 0 })
    expect(style.link).toEqual({ color: '#2481cc', underline: true })
    expect(style.h1.fontSize).toBe(20)
    expect(style.codeBlock.backgroundColor).toBe('#000000')
  })
})
