import React from 'react'
import { View } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { Bubble, ContextMenu, IMessage, MessageReactionsDisplayProps, ReactionIconProps, ReactionPickerProps } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'
import { render } from './renderWithGestureRoot'

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}), { virtual: true })

const ME = { _id: 1, name: 'Me' }

// Icons for the app's own keys; anything else keeps its emoji.
const ICON_KEYS = ['like', 'question']
const makeRenderer = (calls: ReactionIconProps[]) => (props: ReactionIconProps) => {
  calls.push(props)
  return ICON_KEYS.includes(props.emoji)
    ? <View testID={`icon-${props.place}-${props.emoji}-${props.isChosen ? 'fill' : 'line'}`} />
    : null
}

// The icon is hidden from screen readers: the pill or button around it names the reaction.
const HIDDEN = { includeHiddenElements: true }

const longPress = () => act(() => {
  fireGestureHandler(getByGestureTestId('message-long-press'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ])
})

describe('reactions.renderReactionIcon', () => {
  it('draws the pills with it, filled for your own, and keeps the emoji where it returns nothing', async () => {
    const calls: ReactionIconProps[] = []
    const { getByTestId, getByText, queryByText } = await render(
      <Bubble
        user={ME}
        position='left'
        currentMessage={{
          ...DEFAULT_TEST_MESSAGE,
          reactions: [
            { emoji: 'like', userIds: [1, 2] },
            { emoji: 'question', userIds: [2] },
            { emoji: '🔥', userIds: [2] },
          ],
        }}
        reactions={{ isEnabled: true, onReactionPress: jest.fn(), renderReactionIcon: makeRenderer(calls) }}
      />
    )

    expect(getByTestId('icon-pill-like-fill', HIDDEN)).toBeTruthy()
    expect(getByTestId('icon-pill-question-line', HIDDEN)).toBeTruthy()
    expect(queryByText('like')).toBeNull()
    expect(getByText('🔥')).toBeTruthy()
    const like = calls.find(call => call.emoji === 'like')!
    expect(like).toMatchObject({ place: 'pill', size: 16, isChosen: true })
    expect(typeof like.color).toBe('string')
  })

  it('is passed to a custom reactions display', async () => {
    const displays: MessageReactionsDisplayProps<IMessage>[] = []
    const renderReactionIcon = jest.fn(() => null)
    await render(
      <Bubble
        user={ME}
        position='left'
        currentMessage={{ ...DEFAULT_TEST_MESSAGE, reactions: [{ emoji: 'like', userIds: [2] }] }}
        reactions={{
          isEnabled: true,
          onReactionPress: jest.fn(),
          renderReactionIcon,
          renderReactions: props => {
            displays.push(props)
            return null
          },
        }}
      />
    )

    expect(displays.at(-1)!.renderReactionIcon).toBe(renderReactionIcon)
  })

  it('draws the reactions bar above the long-press menu', async () => {
    const calls: ReactionIconProps[] = []
    const { getByTestId } = await render(
      <Bubble
        user={ME}
        position='left'
        currentMessage={{ ...DEFAULT_TEST_MESSAGE, reactions: [{ emoji: 'question', userIds: [1] }] }}
        messageActions={[{ label: 'Copy', onPress: jest.fn() }]}
        reactions={{ isEnabled: true, onReactionPress: jest.fn(), emojis: ['like', 'question'], renderReactionIcon: makeRenderer(calls) }}
      />
    )

    await longPress()

    expect(getByTestId('icon-picker-like-line', HIDDEN)).toBeTruthy()
    // You reacted with it already.
    expect(getByTestId('icon-picker-question-fill', HIDDEN)).toBeTruthy()
    expect(calls.find(call => call.place === 'picker')).toMatchObject({ size: 26 })
  })

  it('is passed to a custom reaction picker', async () => {
    const pickers: ReactionPickerProps<IMessage>[] = []
    const renderReactionIcon = jest.fn(() => null)
    await render(
      <Bubble
        user={ME}
        position='left'
        currentMessage={DEFAULT_TEST_MESSAGE}
        reactions={{
          isEnabled: true,
          onReactionPress: jest.fn(),
          renderReactionIcon,
          renderReactionPicker: props => {
            pickers.push(props)
            return null
          },
        }}
      />
    )

    expect(pickers.at(-1)!.renderReactionIcon).toBe(renderReactionIcon)
  })

  it('draws the pick flying to the message in the bar\'s state, and the emoji where it returns nothing', async () => {
    const calls: ReactionIconProps[] = []
    const { getByLabelText, getAllByText } = await render(
      <ContextMenu
        visible
        items={[]}
        onDismiss={jest.fn()}
        pageX={20}
        pageY={300}
        bubbleWidth={200}
        bubbleHeight={60}
        reactions={{ emojis: ['like', '👍'], selected: ['like'], onSelect: jest.fn(), renderReactionIcon: makeRenderer(calls) }}
      />
    )

    expect(getAllByText('👍')).toHaveLength(1)
    await fireEvent.press(getByLabelText('like'))

    expect(calls.find(call => call.place === 'flight')).toMatchObject({ size: 26, isChosen: true })
  })
})
