import React, { useMemo } from 'react'
import { View } from 'react-native'
import isEqual from 'lodash.isequal'
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
import { UnreadSeparator } from '../../../components/UnreadSeparator'
import { Day } from '../../../Day'
import { Message, MessageProps } from '../../../Message'
import { IMessage } from '../../../Models'
import { isSameDay } from '../../../utils'
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
    listHeight,
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
      ? dayPositionScreenTop(listHeight.value + scrolledY.value, day)
      : Infinity

    const belowHandoff = separatorScreenTop > DAY_HANDOFF_OFFSET
    const headerShowsThisDay = floatingRenderedDate != null && floatingRenderedDate.value === createdAt

    if (belowHandoff || !headerShowsThisDay)
      return { opacity: 1 }

    // Past the line the header stands in for this separator - but only while it is
    // showing. At rest it fades out (Telegram hides the floating date when idle), and the
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
    firstUnreadMessageId,
    renderUnreadSeparator,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    scrolledY: _scrolledY,
    daysPositions: _daysPositions,
    listHeight: _listHeight,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...rest
  } = props

  // Transform reply props for Message and Bubble.
  // `rest` is rebuilt by the destructuring above on every render, so memoising on it never hit -
  // the object was recomputed each time *and* paid for a dependency comparison. The row only
  // renders when `arePropsEqual` already decided something changed, so there is nothing to cache.
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

  // Telegram's unread bar is a row of its own right above the first unread message, under its
  // date if it opens a day.
  const isFirstUnread = firstUnreadMessageId != null && props.currentMessage._id === firstUnreadMessageId
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

// Message data is deep-compared (so any content change - text, status, reactions
// - re-renders), and every other prop is compared by reference. So the only time
// a row is skipped is a genuine no-op: identical message data AND all other props
// (render functions, config, styles, shared values) referentially unchanged. Any
// new prop reference, added/removed prop, or content change forces a re-render -
// there's no path where new props leave stale content on screen.
const MESSAGE_KEYS: Array<keyof ItemProps<IMessage>> = ['currentMessage', 'previousMessage', 'nextMessage']

function arePropsEqual (prev: ItemProps<IMessage>, next: ItemProps<IMessage>): boolean {
  for (const key of MESSAGE_KEYS)
    if (!isEqual(prev[key], next[key]))
      return false

  const prevRecord = prev as unknown as Record<string, unknown>
  const nextRecord = next as unknown as Record<string, unknown>
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)

  // Walks the same ground as the union of both key sets, without building it: equal counts plus
  // every prev key present on next means the sets are identical, so comparing prev's keys covers
  // next's too. This runs once per mounted row per commit over ~60 props, and the Set it used to
  // allocate for that (plus the two spreads feeding it) was pure garbage on the scroll path.
  if (prevKeys.length !== nextKeys.length)
    return false

  for (const key of nextKeys)
    if (!Object.prototype.hasOwnProperty.call(prev, key))
      return false

  for (const key of prevKeys) {
    if ((MESSAGE_KEYS as string[]).includes(key))
      continue

    if (!Object.is(prevRecord[key], nextRecord[key]))
      return false
  }

  return true
}

export const Item = React.memo(ItemComponent, arePropsEqual) as typeof ItemComponent
