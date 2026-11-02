import React from 'react'
import { Text, View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { Chat, IMessage } from '..'
import { waitForRows } from './waitForRows'

const ME = { _id: 1, name: 'Me' }

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

describe('empty chat', () => {
  it('shows the greeting card when there are no messages', async () => {
    const { getByText } = await mountChat(<Chat messages={[]} onSend={() => {}} user={ME} />)
    expect(getByText('No messages here yet...')).toBeTruthy()
    expect(getByText('Send a message or tap the greeting below.')).toBeTruthy()
    expect(getByText('👋')).toBeTruthy()
  })

  it('sends the greeting as a message when it is tapped', async () => {
    const onSend = jest.fn()
    const { getByText } = await mountChat(<Chat messages={[]} onSend={onSend} user={ME} />)

    await fireEvent.press(getByText('👋'))
    expect(onSend).toHaveBeenCalledTimes(1)
    const [sent] = onSend.mock.calls[0][0] as IMessage[]
    expect(sent.text).toBe('👋')
    expect(sent.user).toEqual(ME)
    expect(sent._id).toBeTruthy()
  })

  it('takes a custom greeting, or none', async () => {
    const custom = await mountChat(<Chat messages={[]} onSend={() => {}} user={ME} emptyChatGreeting='🎉' />)
    expect(custom.getByText('🎉')).toBeTruthy()
    await custom.unmount()

    const none = await mountChat(<Chat messages={[]} onSend={() => {}} user={ME} emptyChatGreeting={null} />)
    expect(none.getByText('No messages here yet...')).toBeTruthy()
    expect(none.queryByText('Send a message or tap the greeting below.')).toBeNull()
    expect(none.queryByText('👋')).toBeNull()
  })

  it('is translated', async () => {
    const { getByText } = await mountChat(<Chat messages={[]} onSend={() => {}} user={ME} locale='ru' />)
    expect(getByText('Здесь пока нет сообщений...')).toBeTruthy()
  })

  it('gives way to renderChatEmpty, and to null', async () => {
    const custom = await mountChat(
      <Chat messages={[]} onSend={() => {}} user={ME} renderChatEmpty={() => <Text>Say hi</Text>} />
    )
    expect(custom.getByText('Say hi')).toBeTruthy()
    expect(custom.queryByText('No messages here yet...')).toBeNull()
    await custom.unmount()

    const none = await mountChat(<Chat messages={[]} onSend={() => {}} user={ME} renderChatEmpty={null} />)
    expect(none.queryByText('No messages here yet...')).toBeNull()
  })

  it('goes away once there is a message', async () => {
    const message = { _id: 1, text: 'hi', createdAt: Date.now(), user: { _id: 2 } }
    const { queryByText } = await mountChat(<Chat messages={[message]} onSend={() => {}} user={ME} />)
    expect(queryByText('No messages here yet...')).toBeNull()
  })
})
