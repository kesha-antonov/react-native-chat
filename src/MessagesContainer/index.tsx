import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  LayoutChangeEvent,
  ListRenderItemInfo,
  CellRendererProps,
  StyleProp,
  ViewStyle,
  Platform } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import Animated, { runOnJS, ScrollEvent, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Icon } from '../components/Icon'
import { useThemedStyles } from '../hooks/useTheme'
import { LoadEarlierMessages } from '../LoadEarlierMessages'
import { warning } from '../logging'
import { IMessage } from '../Models'
import stylesCommon from '../styles'
import { TypingIndicator } from '../TypingIndicator'
import { isSameDay, useCallbackThrottled } from '../utils'
import { DayAnimated } from './components/DayAnimated'
import { Item } from './components/Item'
import { ItemProps } from './components/Item/types'
import { AnimatedFlashList, isFlashListAvailable } from './FlashList'
import styles, { createThemedStyles } from './styles'
import { MessagesContainerProps, DaysPositions, AnimatedFlatList } from './types'

export * from './types'

// Stable reference for the missing prev/next message at the list edges.
const EMPTY_MESSAGE = Object.freeze({}) as IMessage

/** Props FlashList hands to its `CellRendererComponent`. */
interface FlashListCellProps {
  index: number
  style?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
  children?: React.ReactNode
}

export const MessagesContainer = <TMessage extends IMessage>(props: MessagesContainerProps<TMessage>) => {
  const {
    messages = [],
    user,
    isTyping = false,
    renderChatEmpty: renderChatEmptyProp,
    isInverted = true,
    listProps,
    isScrollToBottomEnabled = false,
    scrollToBottomOffset = 200,
    isAlignedTop = false,
    scrollToBottomStyle,
    scrollToBottomContentStyle,
    loadEarlierMessagesProps,
    renderTypingIndicator: renderTypingIndicatorProp,
    renderFooter: renderFooterProp,
    renderLoadEarlier: renderLoadEarlierProp,
    forwardRef,
    scrollToBottomComponent: scrollToBottomComponentProp,
    renderDay: renderDayProp,
    isDayAnimationEnabled = true,
    isFlashListEnabled = false,
  } = props

  const isFlashList = isFlashListEnabled && isFlashListAvailable

  useEffect(() => {
    if (isFlashListEnabled && !isFlashListAvailable)
      warning(
        'Chat: `isFlashListEnabled` is set but `@shopify/flash-list` is not installed - falling back to FlatList'
      )
  }, [isFlashListEnabled])

  const themedStyles = useThemedStyles(createThemedStyles)

  const listPropsOnScrollProp = listProps?.onScroll

  const scrollToBottomOpacity = useSharedValue(0)
  const isScrollingDown = useSharedValue(false)
  const lastScrolledY = useSharedValue(0)
  const [isScrollToBottomVisible, setIsScrollToBottomVisible] = useState(false)
  const scrollToBottomStyleAnim = useAnimatedStyle(() => ({
    opacity: scrollToBottomOpacity.value,
  }), [scrollToBottomOpacity])

  const daysPositions = useSharedValue<DaysPositions>({})
  const listHeight = useSharedValue(0)
  const contentHeight = useSharedValue(0)
  const scrolledY = useSharedValue(0)
  // The date (createdAt ms) the floating day header is currently rendering. Used to
  // keep the inline separator visible until the header's text has caught up, hiding
  // the 1-frame JS-thread lag of the header on each day change.
  const floatingRenderedDate = useSharedValue<number | undefined>(undefined)
  // true while the user is actively scrolling (finger down dragging or momentum
  // running). Drives the floating day header visibility so it stays opaque for the
  // whole gesture and only fades once scrolling fully stops.
  const isScrollActive = useSharedValue(false)

  const renderTypingIndicator = useCallback(() => {
    if (renderTypingIndicatorProp)
      return renderTypingIndicatorProp()

    return <TypingIndicator isTyping={isTyping} style={props.typingIndicatorStyle} />
  }, [isTyping, renderTypingIndicatorProp, props.typingIndicatorStyle])

  const ListFooterComponent = useMemo(() => {
    if (renderFooterProp)
      return renderFooterProp(props)

    return renderTypingIndicator()
  }, [renderFooterProp, renderTypingIndicator, props])

  const renderLoadEarlier = useCallback(() => {
    if (loadEarlierMessagesProps?.isAvailable) {
      if (renderLoadEarlierProp)
        return renderLoadEarlierProp(loadEarlierMessagesProps)

      return <LoadEarlierMessages {...loadEarlierMessagesProps} />
    }

    return null
  }, [loadEarlierMessagesProps, renderLoadEarlierProp])

  const changeScrollToBottomVisibility: (isVisible: boolean) => void = useCallbackThrottled((isVisible: boolean) => {
    if (isScrollingDown.value && isVisible)
      return

    if (isVisible)
      setIsScrollToBottomVisible(true)

    scrollToBottomOpacity.value = withTiming(isVisible ? 1 : 0, { duration: 250 }, isFinished => {
      if (isFinished && !isVisible)
        runOnJS(setIsScrollToBottomVisible)(false)
    })
  }, [scrollToBottomOpacity, isScrollingDown], 50)

  const scrollTo = useCallback((options: { animated?: boolean, offset: number }) => {
    if (options)
      forwardRef?.current?.scrollToOffset(options)
  }, [forwardRef])

  const doScrollToBottom = useCallback((animated: boolean = true) => {
    isScrollingDown.value = true
    changeScrollToBottomVisibility(false)

    if (isInverted)
      scrollTo({ offset: 0, animated })
    else if (forwardRef?.current)
      forwardRef.current.scrollToEnd({ animated })
  }, [forwardRef, isInverted, scrollTo, isScrollingDown, changeScrollToBottomVisibility])

  const handleOnScroll = useCallback((event: ScrollEvent) => {
    listPropsOnScrollProp?.(event)

    const {
      contentOffset: { y: contentOffsetY },
      contentSize: { height: contentSizeHeight },
      layoutMeasurement: { height: layoutMeasurementHeight },
    } = event

    isScrollingDown.value =
      (isInverted && lastScrolledY.value > contentOffsetY) ||
      (!isInverted && lastScrolledY.value < contentOffsetY)

    lastScrolledY.value = contentOffsetY
    contentHeight.value = contentSizeHeight

    if (isInverted)
      if (contentOffsetY > scrollToBottomOffset!)
        changeScrollToBottomVisibility(true)
      else
        changeScrollToBottomVisibility(false)
    else if (
      contentOffsetY < scrollToBottomOffset! &&
      contentSizeHeight - layoutMeasurementHeight > scrollToBottomOffset!
    )
      changeScrollToBottomVisibility(false)
    else
      changeScrollToBottomVisibility(false)
  }, [isInverted, scrollToBottomOffset, changeScrollToBottomVisibility, isScrollingDown, lastScrolledY, contentHeight, listPropsOnScrollProp])

  // Auto-scroll to the newest message when it arrives in a non-inverted list.
  // Inverted lists keep the newest message visible on their own, but a
  // non-inverted list appends new messages off-screen at the end (#2612).
  // Only scroll when the user is already near the bottom so we don't yank
  // them away while they are reading earlier messages.
  const latestMessageId = !isInverted && messages.length > 0
    ? messages[messages.length - 1]._id
    : undefined
  const previousLatestMessageId = useRef(latestMessageId)
  useEffect(() => {
    if (isInverted) {
      previousLatestMessageId.current = latestMessageId
      return
    }

    if (
      latestMessageId != null &&
      latestMessageId !== previousLatestMessageId.current &&
      // skip the very first render; initial positioning is handled on layout
      previousLatestMessageId.current !== undefined
    ) {
      const isNearBottom =
        contentHeight.value === 0 ||
        lastScrolledY.value + listHeight.value >= contentHeight.value - scrollToBottomOffset!

      if (isNearBottom)
        doScrollToBottom(true)
    }

    previousLatestMessageId.current = latestMessageId
  }, [latestMessageId, isInverted, doScrollToBottom, contentHeight, lastScrolledY, listHeight, scrollToBottomOffset])

  const restProps = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { messages: _, ...rest } = props
    return rest
  }, [props])

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<unknown>): React.ReactElement | null => {
    const messageItem = item as TMessage

    if (!messageItem._id && messageItem._id !== 0)
      warning('Chat: `_id` is missing for message', JSON.stringify(item))

    if (!messageItem.user) {
      if (!messageItem.system)
        warning(
          'Chat: `user` is missing for message',
          JSON.stringify(messageItem)
        )

      messageItem.user = { _id: 0 }
    }

    if (messages) {
      // Use a shared frozen empty message for the edges so missing prev/next
      // keep a stable reference (a fresh `{}` each render would defeat the
      // Item memo's deep-compare fast path).
      const previousMessage =
        (isInverted ? messages[index + 1] : messages[index - 1]) || EMPTY_MESSAGE
      const nextMessage =
        (isInverted ? messages[index - 1] : messages[index + 1]) || EMPTY_MESSAGE

      const messageProps: ItemProps<TMessage> = {
        position: user?._id != null && messageItem.user?._id === user._id ? 'right' : 'left',
        ...restProps,
        currentMessage: messageItem,
        previousMessage,
        nextMessage,
        scrolledY,
        daysPositions,
        listHeight,
        floatingRenderedDate,
        isDayAnimationEnabled,
      }

      return (
        <Item<TMessage> {...messageProps} />
      )
    }

    return null
  }, [messages, restProps, isInverted, scrolledY, daysPositions, listHeight, floatingRenderedDate, isDayAnimationEnabled, user])

  const emptyContent = useMemo(() => {
    if (!renderChatEmptyProp)
      return null

    return renderChatEmptyProp()
  }, [renderChatEmptyProp])

  const renderChatEmpty = useCallback(() => {
    if (renderChatEmptyProp)
      return isInverted
        ? (
          emptyContent
        )
        : (
          <View style={[stylesCommon.fill, styles.emptyChatContainer]}>
            {emptyContent}
          </View>
        )

    return <View style={stylesCommon.fill} />
  }, [isInverted, renderChatEmptyProp, emptyContent])

  const ListHeaderComponent = useMemo(() => {
    const content = renderLoadEarlier()

    if (!content)
      return null

    return (
      <View style={stylesCommon.fill}>{content}</View>
    )
  }, [renderLoadEarlier])

  const renderScrollBottomComponent = useCallback(() => {
    if (scrollToBottomComponentProp)
      return scrollToBottomComponentProp()

    // A downward chevron drawn with borders (no glyph), themed with the accent.
    return (
      <Icon
        name='chevronDown'
        color={themedStyles.chevronColor.color}
        size={16}
        fallback={<View style={themedStyles.scrollChevron} />}
      />
    )
  }, [scrollToBottomComponentProp, themedStyles])

  const handleScrollToBottomPress = useCallback(() => {
    doScrollToBottom()
  }, [doScrollToBottom])

  const scrollToBottomContent = useMemo(() => {
    return (
      <Animated.View
        style={[
          stylesCommon.centerItems,
          styles.scrollToBottomContent,
          themedStyles.scrollSurface,
          scrollToBottomContentStyle,
          scrollToBottomStyleAnim,
        ]}
      >
        {renderScrollBottomComponent()}
      </Animated.View>
    )
  }, [scrollToBottomStyleAnim, scrollToBottomContentStyle, renderScrollBottomComponent, themedStyles])

  const ScrollToBottomWrapper = useCallback(() => {
    if (!isScrollToBottomEnabled)
      return null

    if (!isScrollToBottomVisible)
      return null

    return (
      <Pressable
        style={[styles.scrollToBottom, scrollToBottomStyle]}
        onPress={handleScrollToBottomPress}
      >
        {scrollToBottomContent}
      </Pressable>
    )
  }, [isScrollToBottomEnabled, isScrollToBottomVisible, handleScrollToBottomPress, scrollToBottomContent, scrollToBottomStyle])

  const onLayoutList = useCallback((event: LayoutChangeEvent) => {
    listHeight.value = event.nativeEvent.layout.height

    if (
      !isInverted &&
      messages?.length &&
      isScrollToBottomEnabled
    )
      setTimeout(() => {
        doScrollToBottom(false)
      }, 500)

    // listProps.onLayout may be a SharedValue in Reanimated types, but we only accept functions
    const onLayoutProp = listProps?.onLayout as ((event: LayoutChangeEvent) => void) | undefined
    onLayoutProp?.(event)
  }, [isInverted, messages, doScrollToBottom, listHeight, listProps, isScrollToBottomEnabled])

  const onEndReached = useCallback(() => {
    if (
      loadEarlierMessagesProps &&
      loadEarlierMessagesProps.isAvailable &&
      loadEarlierMessagesProps.isInfiniteScrollEnabled &&
      !loadEarlierMessagesProps.isLoading
    )
      loadEarlierMessagesProps.onPress()
  }, [loadEarlierMessagesProps])

  const keyExtractor = useCallback((item: unknown) => (item as TMessage)._id.toString(), [])

  // Records where each message sits in the content so the floating day header
  // knows which day is currently on screen. Shared by both cell renderers.
  const trackDayPosition = useCallback((message: IMessage | undefined, layout: { y: number, height: number }) => {
    // Only track positions when day animation is enabled
    if (!isDayAnimationEnabled || !message)
      return

    const id = message._id.toString()
    const { y, height } = layout

    const newValue = {
      y,
      height,
      createdAt: new Date(message.createdAt).getTime(),
    }

    daysPositions.modify(value => {
      'worklet'

      const isSameDay = (date1: number, date2: number) => {
        const d1 = new Date(date1)
        const d2 = new Date(date2)

        return (
          d1.getDate() === d2.getDate() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getFullYear() === d2.getFullYear()
        )
      }

      for (const [key, item] of Object.entries(value))
        if (isSameDay(newValue.createdAt, item.createdAt) && (isInverted ? item.y <= newValue.y : item.y >= newValue.y)) {
          delete value[key]
          break
        }

      // @ts-expect-error: https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue#remarks
      value[id] = newValue
      return value
    })
  }, [daysPositions, isInverted, isDayAnimationEnabled])

  const renderCell = useCallback((props: CellRendererProps<unknown>) => {
    const { item, onLayout: onLayoutProp, children } = props

    const handleOnLayout = (event: LayoutChangeEvent) => {
      onLayoutProp?.(event)
      trackDayPosition(item as IMessage, event.nativeEvent.layout)
    }

    return (
      <View
        {...props}
        onLayout={handleOnLayout}
      >
        {children}
      </View>
    )
  }, [trackDayPosition])

  // FlashList recycles cells and hands its CellRendererComponent only an
  // `index` (no `item`), so the message is looked up through a ref to keep the
  // component identity stable - recreating it would remount every row.
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const FlashListCell = useMemo(() => {
    const Cell = React.forwardRef<View, FlashListCellProps>(({ index, onLayout: onLayoutProp, children, ...rest }, ref) => {
      const handleOnLayout = (event: LayoutChangeEvent) => {
        onLayoutProp?.(event)
        trackDayPosition(messagesRef.current[index], event.nativeEvent.layout)
      }

      return (
        <View ref={ref} {...rest} onLayout={handleOnLayout}>
          {children}
        </View>
      )
    })

    Cell.displayName = 'FlashListCell'
    return Cell
  }, [trackDayPosition])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrolledY.value = event.contentOffset.y

      runOnJS(handleOnScroll)(event)
    },
    onBeginDrag: () => {
      isScrollActive.value = true
    },
    onEndDrag: () => {
      // Momentum (if any) re-asserts isScrollActive via onMomentumBegin within the
      // header's fade-out delay, so a flick keeps the header visible.
      isScrollActive.value = false
    },
    onMomentumBegin: () => {
      isScrollActive.value = true
    },
    onMomentumEnd: () => {
      isScrollActive.value = false
    },
  }, [handleOnScroll, isScrollActive])

  // removes unrendered days positions when messages are added/removed
  useEffect(() => {
    // Skip cleanup when day animation is disabled
    if (!isDayAnimationEnabled)
      return

    Object.keys(daysPositions.value).forEach(key => {
      const messageIndex = messages.findIndex(m => m._id.toString() === key)
      let shouldRemove = messageIndex === -1

      if (!shouldRemove) {
        const prevMessage = messages[messageIndex + (isInverted ? 1 : -1)]
        const message = messages[messageIndex]
        shouldRemove = !!prevMessage && isSameDay(message, prevMessage)
      }

      if (shouldRemove)
        daysPositions.modify(value => {
          'worklet'

          delete value[key]
          return value
        })
    })
  }, [messages, daysPositions, isInverted, isDayAnimationEnabled])

  // Props shared by both list engines. FlatList-only virtualization knobs and
  // FlashList-only options are added at the call sites below.
  const commonListProps = {
    ref: forwardRef,
    keyExtractor,
    data: messages,
    renderItem,
    inverted: isInverted,
    style: stylesCommon.fill,
    contentContainerStyle: styles.messagesContainer,
    ListEmptyComponent: renderChatEmpty,
    ListFooterComponent: isInverted ? ListHeaderComponent : <>{ListFooterComponent}</>,
    ListHeaderComponent: isInverted ? <>{ListFooterComponent}</> : ListHeaderComponent,
    scrollEventThrottle: 1,
    onEndReached,
    onEndReachedThreshold: 0.1,
    keyboardDismissMode: 'interactive' as const,
    keyboardShouldPersistTaps: 'handled' as const,
  }

  return (
    <View
      style={[
        styles.contentContainerStyle,
        themedStyles.root,
        isAlignedTop ? styles.containerAlignTop : stylesCommon.fill,
      ]}
    >
      {isFlashList
        ? (
          <AnimatedFlashList
            {...commonListProps}
            // FlashList v2 keeps the viewport pinned to the newest message on
            // its own; a non-inverted chat additionally wants the first render
            // to start at the bottom. Overridable through `listProps`.
            maintainVisibleContentPosition={{
              startRenderingFromBottom: !isInverted,
              autoscrollToBottomThreshold: 0.2,
            }}
            {...listProps}
            onScroll={scrollHandler}
            onLayout={onLayoutList}
            CellRendererComponent={FlashListCell}
          />
        )
        : (
          <AnimatedFlatList
            {...commonListProps}
            automaticallyAdjustContentInsets={false}
            // Virtualization defaults tuned for chat lists. All are overridable via
            // `listProps` below (spread last), so consumers keep full control.
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={9}
            updateCellsBatchingPeriod={50}
            {...listProps}
            onScroll={scrollHandler}
            onLayout={onLayoutList}
            CellRendererComponent={renderCell}
          />
        )}
      <ScrollToBottomWrapper />
      {isDayAnimationEnabled && (
        <DayAnimated
          scrolledY={scrolledY}
          daysPositions={daysPositions}
          listHeight={listHeight}
          isScrollActive={isScrollActive}
          floatingRenderedDate={floatingRenderedDate}
          renderDay={renderDayProp}
          isLoading={loadEarlierMessagesProps?.isLoading ?? false}
          dateFormat={props.dateFormat}
          dateFormatCalendar={props.dateFormatCalendar}
        />
      )}
    </View>
  )
}
