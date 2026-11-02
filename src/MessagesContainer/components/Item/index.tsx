import React, { useContext } from 'react'
import { View } from 'react-native'
import { UnreadSeparator } from '../../../components/UnreadSeparator'
import { Message, MessageProps } from '../../../Message'
import { IMessage } from '../../../Models'
import { MessageRowConfigContext } from '../../rowConfig'
import { useRowEntry } from '../../rowStore'
import { ItemProps } from './types'

export * from './types'

const ItemComponent = <TMessage extends IMessage>(props: ItemProps<TMessage>) => {
  const {
    renderMessage: renderMessageProp,
    reply,
    firstUnreadMessageId,
    renderUnreadSeparator,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    // The list's own values, for the day rows: no message reads them.
    isDayAnimationEnabled: _isDayAnimationEnabled,
    scrolledY: _scrolledY,
    listHeight: _listHeight,
    floatingDayOpacity: _floatingDayOpacity,
    activeStickyIndex: _activeStickyIndex,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...rest
  } = props

  // Transform reply props for Message and Bubble. Not memoised: the row only renders when its
  // entry or the shared row config changed (see MessageRow), so there is nothing to cache.
  const messageProps = {
    ...rest,
    // Swipe to reply for Message component
    swipeToReply: reply?.swipe,
    // Message reply styling for Bubble component
    messageReply: reply ? {
      renderMessageReply: reply.renderMessageReply,
      onPress: reply.onPress,
      ...reply.messageStyle,
    } : undefined,
  }

  // The unread bar sits right above the first unread message, under its day's date (a row of
  // the list of its own, see `withDayItems`).
  const isFirstUnread = firstUnreadMessageId != null && props.currentMessage._id === firstUnreadMessageId
  const unreadSeparator = isFirstUnread
    ? renderUnreadSeparator === undefined ? <UnreadSeparator /> : renderUnreadSeparator?.()
    : null

  return (
    <View>
      {unreadSeparator}
      {
        renderMessageProp
          ? renderMessageProp(messageProps as MessageProps<TMessage>)
          : <Message<TMessage> {...messageProps as MessageProps<TMessage>} />
      }
    </View>
  )
}

/**
 * One row of the list. Its only prop is the message id: the message and its neighbours come
 * from the row store, and everything else from the shared row config, so the row re-renders
 * when its own message (or its grouping) changes or when the config does - never because the
 * list around it did.
 */
const MessageRowComponent = ({ id }: { id: string }) => {
  const entry = useRowEntry(id)
  const config = useContext(MessageRowConfigContext) as unknown as Omit<ItemProps<IMessage>, 'currentMessage' | 'position'>

  if (!entry)
    return null

  const userId = config.user?._id
  const position = userId != null && entry.message.user?._id === userId ? 'right' : 'left'

  return (
    <ItemComponent
      {...config}
      currentMessage={entry.message}
      previousMessage={entry.previousMessage}
      nextMessage={entry.nextMessage}
      position={position}
    />
  )
}

export const MessageRow = React.memo(MessageRowComponent)
