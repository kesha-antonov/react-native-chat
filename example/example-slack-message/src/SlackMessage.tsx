import React, { useCallback, useMemo } from 'react'
import {
  View,
  StyleSheet,
} from 'react-native'

import { Avatar, utils } from '@kesha-antonov/react-native-chat'
import type { IMessage, MessageProps } from '@kesha-antonov/react-native-chat'
import Bubble from './SlackBubble'

const { isSameUser, isSameDay } = utils

type Props = MessageProps<IMessage>

const Message = (props: Props) => {
  const {
    currentMessage,
    nextMessage,
    previousMessage,
    containerStyle,
    user,
  } = props

  // Slack-style messages always sit on the left. Only the fields every child actually
  // declares are passed along - spreading the whole message blob into `Bubble` and
  // `Avatar` alike collides on the props they each shape differently.
  //
  // No day separator is rendered here: the list already renders one per day change
  // around whatever `renderMessage` returns, so doing it again would print a pill
  // above every single message.
  const innerProps = useMemo(() => ({
    position: 'left' as const,
    currentMessage,
    nextMessage,
    previousMessage,
    user,
  }), [currentMessage, nextMessage, previousMessage, user])

  const renderBubble = useCallback(() => {
    const bubbleProps = {
      ...innerProps,
      containerStyle: { left: containerStyle?.left },
    }

    if (props.renderBubble)
      return props.renderBubble(bubbleProps)

    return <Bubble {...bubbleProps} />
  }, [innerProps, containerStyle, props])

  const renderAvatar = useCallback(() => {
    let extraStyle
    if (
      isSameUser(currentMessage, previousMessage) &&
      isSameDay(currentMessage, previousMessage)
    )
      // Set the invisible avatar height to 0, but keep the width, padding, etc.
      extraStyle = { height: 0 }

    const avatarProps = {
      ...innerProps,
      imageStyle: { left: [styles.slackAvatar, extraStyle] },
    }

    if (props.renderAvatar)
      return props.renderAvatar(avatarProps)

    return <Avatar {...avatarProps} />
  }, [currentMessage, previousMessage, innerProps, props])

  const marginBottom = useMemo(() =>
    isSameUser(
      currentMessage,
      nextMessage
    )
      ? 2
      : 10
  , [currentMessage, nextMessage])

  return (
    <View
      style={[
        styles.container,
        { marginBottom },
        containerStyle?.left,
      ]}
    >
      {renderAvatar()}
      {renderBubble()}
    </View>
  )
}

export default Message

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginLeft: 8,
    marginRight: 0,
  },
  slackAvatar: {
    // The bottom should roughly line up with the first line of message text.
    height: 40,
    width: 40,
    borderRadius: 3,
  },
})
