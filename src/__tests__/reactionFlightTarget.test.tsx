import React from 'react'
import { act } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import * as Reanimated from 'react-native-reanimated'

import { Bubble, IMessage, ReactionPickerProps } from '..'
import { PILL_X, PILL_Y } from '../components/ContextMenu/constants'
import { placeMenu } from '../components/ContextMenu/placement'
import { DEFAULT_TEST_MESSAGE } from './data'
import { render } from './renderWithGestureRoot'

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}), { virtual: true })

const longPress = () => act(() => {
  fireGestureHandler(getByGestureTestId('message-long-press'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ])
})

// Past the two frames a pick waits and the frames it looks for a new pill.
const waitFrames = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 300))
})

const placement = {
  openAnchor: { pageX: 40, pageY: 300, bubbleWidth: 200, bubbleHeight: 80, touchX: 100, touchY: 340 },
  pageX: 40,
  pageY: 300,
  bubbleWidth: 200,
  bubbleHeight: 80,
  screenWidth: 400,
  screenHeight: 800,
  insets: { top: 0, bottom: 0 },
  isRTL: false,
  hasReactions: true,
  barWidth: 300,
  rowCount: 2,
  menuWidth: 200,
}

describe('a picked reaction\'s landing', () => {
  it('aims at its pill relative to the live bubble, and at the first pill until that is known', () => {
    expect(placeMenu(placement).flightTarget).toEqual({ toX: 40 + PILL_X, toY: 300 + 80 - PILL_Y })
    expect(placeMenu({ ...placement, reactionTarget: { x: 120, y: 66 } }).flightTarget).toEqual({ toX: 160, toY: 366 })
    // The list moved the message: the target goes with it.
    expect(placeMenu({ ...placement, pageY: 250, reactionTarget: { x: 120, y: 66 } }).flightTarget).toEqual({ toX: 160, toY: 316 })
  })

  const renderWithPicker = async (reactions: IMessage['reactions']) => {
    // Every view measures at the same spot, 20 square, so a pill's center is 10, 10 into the bubble.
    jest.spyOn(Reanimated, 'measure').mockReturnValue({ x: 0, y: 0, width: 20, height: 20, pageX: 100, pageY: 200 })
    const pickers: ReactionPickerProps<IMessage>[] = []
    await render(
      <Bubble
        user={{ _id: 1 }}
        position='left'
        currentMessage={{ ...DEFAULT_TEST_MESSAGE, reactions }}
        reactions={{
          isEnabled: true,
          onReactionPress: jest.fn(),
          renderReactionPicker: props => {
            pickers.push(props)
            return null
          },
        }}
      />
    )
    await longPress()
    return pickers
  }

  it('measures the pill of the pick and hands it to the picker', async () => {
    const pickers = await renderWithPicker([{ emoji: '🔥', userIds: [2] }, { emoji: '👍', userIds: [2] }])
    expect(pickers.at(-1)!.reactionTarget).toBeUndefined()

    await act(() => pickers.at(-1)!.onSelect('👍'))
    await waitFrames()

    expect(pickers.at(-1)!.reactionTarget).toEqual({ x: 10, y: 10 })
  })

  it('leaves the target unset when the pick has no pill to land on', async () => {
    const pickers = await renderWithPicker([{ emoji: '🔥', userIds: [2] }])

    await act(() => pickers.at(-1)!.onSelect('👍'))
    await waitFrames()

    expect(pickers.at(-1)!.reactionTarget).toBeUndefined()
  })
})
