import React from 'react'
import { Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { ContextMenu, ContextMenuProps } from '../components/ContextMenu'
import { ReactionPicker } from '../Reactions'
import { DEFAULT_TEST_MESSAGE } from './data'

const renderMenu = (props: Partial<ContextMenuProps> = {}) =>
  render(
    <ContextMenu
      visible
      items={[]}
      onDismiss={jest.fn()}
      pageX={20}
      pageY={300}
      bubbleWidth={200}
      bubbleHeight={60}
      {...props}
    />
  )

describe('ContextMenu', () => {
  it('renders nothing while hidden', async () => {
    const { toJSON } = await renderMenu({ visible: false, items: [{ label: 'Copy', onPress: jest.fn() }] })
    expect(toJSON()).toBeNull()
  })

  it('runs an action only after the menu has closed, then dismisses', async () => {
    const calls: string[] = []
    const onDismiss = jest.fn(() => calls.push('dismiss'))
    const { getByText } = await renderMenu({
      onDismiss,
      items: [{ label: 'Copy', onPress: () => calls.push('copy') }],
    })

    await fireEvent.press(getByText('Copy'))

    expect(calls).toEqual(['copy', 'dismiss'])
  })

  it('dismisses on a backdrop tap', async () => {
    const onDismiss = jest.fn()
    const { getByLabelText } = await renderMenu({ onDismiss, items: [{ label: 'Copy', onPress: jest.fn() }] })

    await fireEvent.press(getByLabelText('dismiss'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores a second tap while it is closing', async () => {
    const onPress = jest.fn()
    const onDismiss = jest.fn()
    // A parent that keeps `visible` true leaves the closed menu unmounted, so
    // a stray second press has nothing to land on.
    const { getByText, queryByText } = await renderMenu({ onDismiss, items: [{ label: 'Copy', onPress }] })

    await fireEvent.press(getByText('Copy'))

    expect(queryByText('Copy')).toBeNull()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('selects a reaction once its flight has landed, then dismisses', async () => {
    const calls: string[] = []
    const { getByLabelText } = await renderMenu({
      onDismiss: () => calls.push('dismiss'),
      reactions: { emojis: ['👍', '❤️'], onSelect: emoji => calls.push(emoji) },
    })

    await fireEvent.press(getByLabelText('❤️'))

    expect(calls).toEqual(['❤️', 'dismiss'])
  })

  it('draws the lifted message preview, the bar accessory and extra children', async () => {
    const { getByText } = await renderMenu({
      messagePreview: <Text>{'lifted copy'}</Text>,
      reactions: { emojis: ['👍'], onSelect: jest.fn(), renderAccessory: () => <Text>{'more'}</Text> },
      children: <Text>{'sheet'}</Text>,
    })

    expect(getByText('lifted copy')).toBeTruthy()
    expect(getByText('more')).toBeTruthy()
    expect(getByText('sheet')).toBeTruthy()
  })
})

describe('ContextMenu (Telegram details)', () => {
  it('grows the bar into the expanded panel and selects from it', async () => {
    const calls: string[] = []
    const { getByLabelText, getByText, queryByText } = await renderMenu({
      onDismiss: () => calls.push('dismiss'),
      reactions: {
        emojis: ['👍'],
        onSelect: emoji => calls.push(emoji),
        renderExpandedPicker: ({ onSelect }) => (
          <Text onPress={() => onSelect('🦄')}>{'full grid'}</Text>
        ),
      },
    })

    expect(queryByText('full grid')).toBeNull()
    await fireEvent.press(getByLabelText('more reactions'))
    await fireEvent.press(getByText('full grid'))

    expect(calls).toEqual(['🦄', 'dismiss'])
  })

  it('has no expand button without an expanded picker', async () => {
    const { queryByLabelText } = await renderMenu({ reactions: { emojis: ['👍'], onSelect: jest.fn() } })
    expect(queryByLabelText('more reactions')).toBeNull()
  })

  it('draws an icon per action, in red for a destructive one', async () => {
    const icon = jest.fn(({ color }: { color: string }) => <Text>{`icon ${color}`}</Text>)
    const { getByText } = await renderMenu({
      items: [
        { label: 'Copy', icon, onPress: jest.fn() },
        { label: 'Delete', icon, destructive: true, onPress: jest.fn() },
      ],
    })

    expect(getByText('icon #000000')).toBeTruthy()
    expect(getByText('icon #E74C3C')).toBeTruthy()
    expect(icon).toHaveBeenCalledWith({ color: '#E74C3C', size: 24 })
  })
})

describe('ReactionPicker', () => {
  it('is the context menu without actions', async () => {
    const onSelect = jest.fn()
    const onDismiss = jest.fn()
    const { getByLabelText, queryByRole } = await render(
      <ReactionPicker
        visible
        message={DEFAULT_TEST_MESSAGE}
        emojis={['👍', '😂']}
        onSelect={onSelect}
        onDismiss={onDismiss}
        position='right'
        messagePreview={<Text>{'preview'}</Text>}
      />
    )

    expect(queryByRole('button', { name: 'Copy' })).toBeNull()
    await fireEvent.press(getByLabelText('😂'))

    expect(onSelect).toHaveBeenCalledWith('😂')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
