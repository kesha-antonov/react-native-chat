import React from 'react'
import { Text, View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { Chat, IMessage } from '..'
import { waitForRows } from './waitForRows'

const ME = { _id: 1, name: 'Me' }
const ALICE = { _id: 2, name: 'Alice' }

// Newest first, as an inverted chat keeps them.
const MESSAGES: IMessage[] = Array.from({ length: 30 }, (_, i) => ({
  _id: 30 - i,
  text: `message ${30 - i}`,
  user: ALICE,
  createdAt: new Date(2024, 0, 1, 12, 30 - i).getTime(),
}))

const mountChat = async (ui: React.ReactElement) => {
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
  const utils = await render(ui)
  await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  })
  await waitForRows()
  return utils
}

describe('unread messages bar', () => {
  it('draws the unread bar above the first unread message only', async () => {
    const { getAllByTestId, getByText } = await mountChat(
      <Chat messages={MESSAGES} onSend={() => {}} user={ME} firstUnreadMessageId={26} />
    )
    expect(getAllByTestId('unread-separator')).toHaveLength(1)
    expect(getByText('Unread Messages')).toBeTruthy()
  })

  it('is absent without an unread message', async () => {
    const { queryByTestId } = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} />)
    expect(queryByTestId('unread-separator')).toBeNull()
  })

  it('is translated and replaceable', async () => {
    const ru = await mountChat(<Chat messages={MESSAGES} onSend={() => {}} user={ME} firstUnreadMessageId={26} locale='ru' />)
    expect(ru.getByText('Непрочитанные сообщения')).toBeTruthy()
    await ru.unmount()

    const custom = await mountChat(
      <Chat
        messages={MESSAGES}
        onSend={() => {}}
        user={ME}
        firstUnreadMessageId={26}
        renderUnreadSeparator={() => <Text>New</Text>}
      />
    )
    expect(custom.getByText('New')).toBeTruthy()
    expect(custom.queryByTestId('unread-separator')).toBeNull()
  })

  it('opens scrolled so the bar is at the top', async () => {
    const { getByTestId } = await mountChat(
      <Chat
        messages={MESSAGES}
        onSend={() => {}}
        user={ME}
        firstUnreadMessageId={26}
        listProps={{ testID: 'message-list' }}
      />
    )
    await waitForRows()

    // The list renders oldest first, so message 26 is at index 25; viewPosition 0 is the top.
    expect(getByTestId('message-list').props.initialScrollIndex).toEqual({ index: 25, viewPosition: 0 })
    expect(getByTestId('message-list').props.initialScrollAtEnd).toBeUndefined()
  })

  it('opens at the newest message without an unread one', async () => {
    const { getByTestId } = await mountChat(
      <Chat messages={MESSAGES} onSend={() => {}} user={ME} listProps={{ testID: 'message-list' }} />
    )
    await waitForRows()

    expect(getByTestId('message-list').props.initialScrollAtEnd).toBe(true)
  })
})
