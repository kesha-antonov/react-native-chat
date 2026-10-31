import React from 'react'
import { StyleSheet } from 'react-native'
import { act } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

import { Bubble, ReactionPickerProps } from '..'
import { DEFAULT_TEST_MESSAGE } from './data'
import { render } from './renderWithGestureRoot'

const mockImpactAsync = jest.fn()
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}), { virtual: true })

const longPress = () => act(() => {
  fireGestureHandler(getByGestureTestId('message-long-press'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ])
})

describe('bubble long-press', () => {
  it('opens the picker with a haptic and hands it a lifted copy of the bubble', async () => {
    const pickerProps: ReactionPickerProps<typeof DEFAULT_TEST_MESSAGE>[] = []
    const renderReactionPicker = (props: ReactionPickerProps<typeof DEFAULT_TEST_MESSAGE>) => {
      pickerProps.push(props)
      return props.visible ? props.messagePreview : null
    }

    const { getAllByText } = await render(
      <Bubble
        user={{ _id: 1 }}
        currentMessage={DEFAULT_TEST_MESSAGE}
        position='left'
        reactions={{ isEnabled: true, onReactionPress: jest.fn(), renderReactionPicker }}
      />
    )

    expect(pickerProps.at(-1)!.visible).toBe(false)
    expect(pickerProps.at(-1)!.messagePreview).toBeUndefined()

    await longPress()

    expect(mockImpactAsync).toHaveBeenCalledWith('medium')
    expect(pickerProps.at(-1)!.visible).toBe(true)
    // The picker drew the copy, so the text is on screen twice.
    const [original] = getAllByText(DEFAULT_TEST_MESSAGE.text)
    expect(getAllByText(DEFAULT_TEST_MESSAGE.text)).toHaveLength(2)

    // A couple of frames later the original is hidden under the copy.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    const hiddenAncestor = (() => {
      let node = original!.parent
      while (node) {
        if (StyleSheet.flatten(node.props.style)?.opacity === 0)
          return node
        node = node.parent
      }
      return null
    })()
    expect(hiddenAncestor).not.toBeNull()
  })
})
