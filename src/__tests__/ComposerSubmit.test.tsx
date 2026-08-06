import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { Composer } from '../Composer'

const PLACEHOLDER = 'Type a message...'

it('sends on the return key when multiline is disabled', () => {
  const onSend = jest.fn()
  const { getByTestId } = render(
    <Composer text='hello' isMultiline={false} onSend={onSend} />
  )

  const input = getByTestId(PLACEHOLDER)
  expect(input.props.multiline).toBe(false)
  expect(input.props.returnKeyType).toBe('send')

  fireEvent(input, 'submitEditing')

  expect(onSend).toHaveBeenCalledWith({ text: 'hello' }, true)
})

it('leaves the return key alone when multiline is enabled (default)', () => {
  const onSend = jest.fn()
  const { getByTestId } = render(<Composer text='hello' onSend={onSend} />)

  const input = getByTestId(PLACEHOLDER)
  expect(input.props.multiline).toBe(true)
  // No submit wiring at all, so return inserts a newline as before.
  expect(input.props.returnKeyType).toBeUndefined()
  expect(input.props.onSubmitEditing).toBeUndefined()
})

it('does not send blank text', () => {
  const onSend = jest.fn()
  const { getByTestId } = render(
    <Composer text='   ' isMultiline={false} onSend={onSend} />
  )

  fireEvent(getByTestId(PLACEHOLDER), 'submitEditing')

  expect(onSend).not.toHaveBeenCalled()
})

it('sends blank text when isTextOptional is set', () => {
  const onSend = jest.fn()
  const { getByTestId } = render(
    <Composer text='' isMultiline={false} isTextOptional onSend={onSend} />
  )

  fireEvent(getByTestId(PLACEHOLDER), 'submitEditing')

  expect(onSend).toHaveBeenCalledWith({ text: '' }, true)
})
