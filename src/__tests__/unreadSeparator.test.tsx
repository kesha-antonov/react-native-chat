import React, { createRef } from 'react'
import { Text, View } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import { Chat, IMessage } from '..'
import type { AnimatedList } from '../MessagesContainer'

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
  return utils
}

describe('unread messages bar', () => {
  it('draws Telegram\'s bar above the first unread message only', async () => {
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
    const ref = createRef<AnimatedList<IMessage>>()
    const { getByTestId } = await mountChat(
      <Chat
        messages={MESSAGES}
        onSend={() => {}}
        user={ME}
        firstUnreadMessageId={26}
        messagesContainerRef={ref as React.RefObject<AnimatedList<IMessage>>}
        listProps={{ testID: 'message-list' }}
      />
    )
    const scrollToIndex = jest.spyOn(ref.current!, 'scrollToIndex').mockImplementation(() => {})

    await fireEvent(getByTestId('message-list'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Index 4 in the newest-first list; viewPosition 1 is the top of an inverted list.
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 4, viewPosition: 1, animated: false })
  })
})
