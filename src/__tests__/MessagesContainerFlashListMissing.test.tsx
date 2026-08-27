import React from 'react'
import { render } from '@testing-library/react-native'

import { MessagesContainer } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

// Simulate a consumer that opted into FlashList without installing it.
jest.mock('@shopify/flash-list', () => {
  throw new Error('Cannot find module @shopify/flash-list')
})

it('falls back to FlatList and warns when @shopify/flash-list is missing', async () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

  await expect(render(
    <MessagesContainer
      messages={[DEFAULT_TEST_MESSAGE]}
      user={{ _id: 1 }}
      isFlashListEnabled
    />
  )).resolves.toBeDefined()

  expect(logSpy.mock.calls.some(call => call.join(' ').includes('@shopify/flash-list'))).toBe(true)

  logSpy.mockRestore()
})
