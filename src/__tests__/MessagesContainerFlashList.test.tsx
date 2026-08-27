import React from 'react'
import { render } from '@testing-library/react-native'

import { MessagesContainer } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'

const mockFlashListProps: Record<string, any>[] = []

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')

  return {
    FlashList: ReactActual.forwardRef((props: Record<string, any>, ref: unknown) => {
      mockFlashListProps.push(props)
      return ReactActual.createElement(View, { testID: 'flash-list', ref })
    }),
  }
})

const MESSAGES = [
  { ...DEFAULT_TEST_MESSAGE, _id: 'test1' },
  { ...DEFAULT_TEST_MESSAGE, _id: 'test2' },
]

beforeEach(() => {
  mockFlashListProps.length = 0
})

it('renders FlatList by default', async () => {
  const { queryByTestId } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} />
  )

  expect(queryByTestId('flash-list')).toBeNull()
})

it('renders FlashList when isFlashListEnabled is set', async () => {
  const { queryByTestId } = await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isFlashListEnabled />
  )

  expect(queryByTestId('flash-list')).not.toBeNull()
  expect(mockFlashListProps[0]!.data).toEqual(MESSAGES)
  expect(mockFlashListProps[0]!.inverted).toBe(true)
})

it('starts rendering from the bottom only for non-inverted lists', async () => {
  await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isFlashListEnabled />
  )
  expect(mockFlashListProps[0]!.maintainVisibleContentPosition.startRenderingFromBottom).toBe(false)

  mockFlashListProps.length = 0

  await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isFlashListEnabled isInverted={false} />
  )
  expect(mockFlashListProps[0]!.maintainVisibleContentPosition.startRenderingFromBottom).toBe(true)
})

it('lets listProps override the FlashList defaults', async () => {
  await render(
    <MessagesContainer
      messages={MESSAGES}
      user={{ _id: 1 }}
      isFlashListEnabled
      listProps={{ maintainVisibleContentPosition: { disabled: true } } as any}
    />
  )

  expect(mockFlashListProps[0]!.maintainVisibleContentPosition).toEqual({ disabled: true })
})

it('does not pass FlatList-only virtualization props to FlashList', async () => {
  await render(
    <MessagesContainer messages={MESSAGES} user={{ _id: 1 }} isFlashListEnabled />
  )

  expect(mockFlashListProps[0]).not.toHaveProperty('windowSize')
  expect(mockFlashListProps[0]).not.toHaveProperty('maxToRenderPerBatch')
  expect(mockFlashListProps[0]).not.toHaveProperty('updateCellsBatchingPeriod')
})
