import React from 'react'
import { render } from '@testing-library/react-native'

import { MessagesContainer } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

it('should render <MessagesContainer /> without crashing', async () => {
  // Just verify it renders without throwing
  await expect(render(
    <MessagesContainer
      messages={[DEFAULT_TEST_MESSAGE]}
      user={{ _id: 1 }}
    />
  )).resolves.toBeDefined()
})

it('should render <MessagesContainer /> with multiple messages', async () => {
  const messages = [
    { ...DEFAULT_TEST_MESSAGE, _id: 'test1' },
    { ...DEFAULT_TEST_MESSAGE, _id: 'test2' },
  ]

  await expect(render(
    <MessagesContainer
      messages={messages}
      user={{ _id: 1 }}
    />
  )).resolves.toBeDefined()
})

it('should render <MessagesContainer /> with empty messages', async () => {
  await expect(render(
    <MessagesContainer
      messages={[]}
      user={{ _id: 1 }}
    />
  )).resolves.toBeDefined()
})
