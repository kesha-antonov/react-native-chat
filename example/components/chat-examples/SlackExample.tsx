import React, { useCallback, useState } from 'react'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import messagesData from '../../example-expo/data/messages'
import SlackMessage from '../../example-slack-message/src/SlackMessage'

const USER = { _id: 1, name: 'Developer' }
const SLACK_THEME = { colors: { background: '#FFFFFF' } }
const SLACK_DARK_THEME = { colors: { background: '#1A1D21' } }

// `renderMessage` replaces the whole row, and `renderWallpaper={null}` swaps the wallpaper for
// Slack's plain background. The Slack bubble opens its own action sheet
// on long-press, hence the provider.
export default function SlackExample () {
  const [messages, setMessages] = useState<IMessage[]>(messagesData)

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  return (
    <ActionSheetProvider>
      <Chat
        messages={messages}
        onSend={onSend}
        user={USER}
        renderMessage={props => <SlackMessage {...props} />}
        renderWallpaper={null}
        theme={SLACK_THEME}
        darkTheme={SLACK_DARK_THEME}
      />
    </ActionSheetProvider>
  )
}
