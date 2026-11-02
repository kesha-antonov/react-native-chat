import React, { useContext, useMemo } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
import { UnreadSeparator } from '../../../components/UnreadSeparator'
import { Day } from '../../../Day'
import { Message, MessageProps } from '../../../Message'
import { IMessage } from '../../../Models'
import { isSameDay } from '../../../utils'
import { MessageRowConfigContext, useRowSettings } from '../../rowConfig'
import { useRowEntry } from '../../rowStore'
import { DAY_HANDOFF_OFFSET, dayPositionScreenTop, findDayPosition } from '../dayLayout'
import { ItemProps } from './types'

export * from './types'

const DayWrapper = <TMessage extends IMessage>(props: MessageProps<TMessage>) => {
  const {
    renderDay: renderDayProp,
    currentMessage,
    previousMessage,
  } = props

  if (!currentMessage?.createdAt || isSameDay(currentMessage, previousMessage))
    return null

  const {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    containerStyle,
    onMessageLayout,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...rest
  } = props

  return (
    <View>
      {
        renderDayProp
          ? renderDayProp({ ...rest, createdAt: currentMessage.createdAt, isAnimated: false })
          : <Day {...rest} createdAt={currentMessage.createdAt} isAnimated={false} />
      }
    </View>
  )
}

const AnimatedDayWrapper = <TMessage extends IMessage>(props: ItemProps<TMessage>) => {
  const {
    scrolledY,
    daysPositions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listHeight: _listHeight,
    floatingRenderedDate,
    floatingDayOpacity,
    ...rest
  } = props

  const createdAt = useMemo(() =>
    new Date(props.currentMessage.createdAt).getTime()
  , [props.currentMessage.createdAt])

  // This day's measured position. Deliberately derived from `daysPositions` alone and
  // NOT from `scrolledY`: the lookup is an O(days) scan that allocates (Object.values),
  // and reading scroll here would re-run it once per mounted row on every frame. Cell
  // layout is the only thing that can change the answer, so that is what it tracks.
  const dayPosition = useDerivedValue(() =>
    findDayPosition(daysPositions.value, createdAt))

  const style = useAnimatedStyle(() => {
    // The inline separator is the in-conversation date marker. It is shown while its
    // day is below the handoff line, and hidden once its day is the one the floating
    // header is actually rendering at the pin - a hard step (no fade) so the date
    // goes floating(1) <-> inline(1) at the same pixel with no dip and no duplicate.
    //
    // Hiding on `floatingRenderedDate` (the header's *rendered* date) rather than on
    // position alone is what kills the 1-frame flash when scrolling into a newer day:
    // the worklet picks the new stuck day instantly but the header's text only
    // updates ~1 frame later on the JS thread; until it does, this inline separator
    // stays up and shows the correct date, so the header never flashes the old one.
    // Only the arithmetic is per-frame; the lookup it needs was resolved at layout.
    // Infinity (treated as below the pin, i.e. visible) until the day is measured.
    const day = dayPosition.value
    const separatorScreenTop = day
      ? dayPositionScreenTop(scrolledY.value, day)
      : Infinity

    const belowHandoff = separatorScreenTop > DAY_HANDOFF_OFFSET
    const headerShowsThisDay = floatingRenderedDate != null && floatingRenderedDate.value === createdAt

    if (belowHandoff || !headerShowsThisDay)
      return { opacity: 1 }

    // Past the line the header stands in for this separator - but only while it is
    // showing. At rest it fades out (the floating date hides when idle), and the
    // separator fades back in where it really is; otherwise a list that settles with a
    // date just under the top - or that a growing row nudges past the line - shows none.
    return {
      opacity: floatingDayOpacity ? 1 - floatingDayOpacity.value : 0,
    }
  })

  return (
    <Animated.View style={style}>
      <DayWrapper<TMessage> {...rest as MessageProps<TMessage>} />
    </Animated.View>
  )
}

const ItemComponent = <TMessage extends IMessage>(props: ItemProps<TMessage>) => {
  const {
    renderMessage: renderMessageProp,
    isDayAnimationEnabled,
    reply,
    isFirstUnread,
    renderUnreadSeparator,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    scrolledY: _scrolledY,
    daysPositions: _daysPositions,
    listHeight: _listHeight,
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

  // A day separator belongs only to the first message of its day. Deciding that here, rather than
  // inside the wrappers, is what keeps `AnimatedDayWrapper` off the other rows: it runs a
  // useDerivedValue and a useAnimatedStyle, so mounting it around every row put two UI-thread
  // worklets on each message on screen - roughly six out of seven of them to render null.
  const isDayBoundary = props.currentMessage?.createdAt != null &&
    !isSameDay(props.currentMessage, props.previousMessage)

  // The unread bar is a row of its own right above the first unread message, under its
  // date if it opens a day.
  const unreadSeparator = isFirstUnread
    ? renderUnreadSeparator === undefined ? <UnreadSeparator /> : renderUnreadSeparator?.()
    : null

  return (
    // do not remove key. it helps to get correct position of the day container
    <View key={props.currentMessage._id.toString()}>
      {isDayBoundary && (isDayAnimationEnabled
        ? <AnimatedDayWrapper<TMessage> {...props} />
        : <DayWrapper<TMessage> {...messageProps as MessageProps<TMessage>} />)}
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
  // Only this row's answer: the bar moving re-renders the two rows it concerns, not all of them.
  const isFirstUnread = useRowSettings(targets =>
    targets.firstUnreadMessageId != null && String(targets.firstUnreadMessageId) === id)
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
      isFirstUnread={isFirstUnread}
    />
  )
}

export const MessageRow = React.memo(MessageRowComponent)
