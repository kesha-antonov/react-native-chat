import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { AttachmentSheet } from '../components/AttachmentSheet'
import { getPlaybackRate, setPlaybackRate } from '../components/mediaPlayback'
import { PlaybackSpeedPill } from '../components/PlaybackSpeedPill'

describe('AttachmentSheet (Modal fallback)', () => {
  it('runs the action once the sheet has slid away, then closes', async () => {
    const calls: string[] = []
    const { getByText } = await render(
      <AttachmentSheet
        visible
        actions={[{ title: 'Gallery', action: () => calls.push('gallery') }]}
        onClose={() => calls.push('close')}
      />
    )

    await fireEvent.press(getByText('Gallery'))

    expect(calls).toEqual(['gallery', 'close'])
  })

  it('closes on a backdrop tap and renders nothing while hidden', async () => {
    const onClose = jest.fn()
    const actions = [{ title: 'Gallery', action: jest.fn() }]
    const { getByLabelText, queryByText, rerender } = await render(
      <AttachmentSheet visible actions={actions} onClose={onClose} />
    )

    await fireEvent.press(getByLabelText('dismiss'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(actions[0]!.action).not.toHaveBeenCalled()

    await rerender(<AttachmentSheet visible={false} actions={actions} onClose={onClose} />)
    expect(queryByText('Gallery')).toBeNull()
  })
})

describe('PlaybackSpeedPill', () => {
  afterEach(() => setPlaybackRate(1))

  it('opens the presets on a long press and closes after a pick', async () => {
    const { getByLabelText, getByText, queryByText } = await render(<PlaybackSpeedPill rate={1} />)
    const pill = getByLabelText('playback speed 1x')
    // measureInWindow is a no-op mock under Jest; report a spot near the top.
    const nativeMethods = jest.requireActual('@react-native/jest-preset/jest/MockNativeMethods').default
    nativeMethods.measureInWindow.mockImplementation((callback: (...args: number[]) => void) => callback(100, 100, 20, 14))

    await fireEvent(pill, 'longPress')
    await fireEvent.press(getByText('1.5x'))

    expect(getPlaybackRate()).toBe(1.5)
    expect(queryByText('1.7x')).toBeNull()
  })
})
