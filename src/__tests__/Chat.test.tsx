import React from 'react'
import { render } from '@testing-library/react-native'

import { Chat } from '..'

const messages = [
  {
    _id: 1,
    text: 'Hello developer',
    createdAt: new Date(),
    user: {
      _id: 2,
      name: 'John Doe',
    },
  },
]

it('should render <Chat/> and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

it('should render <Chat/> with light colorScheme and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='light'
    />
  )

  expect(toJSON()).toMatchSnapshot()
})

it('should render <Chat/> with dark colorScheme and compare with snapshot', () => {
  const { toJSON } = render(
    <Chat
      messages={messages}
      onSend={() => {}}
      user={{
        _id: 1,
      }}
      colorScheme='dark'
    />
  )

  expect(toJSON()).toMatchSnapshot()
})
