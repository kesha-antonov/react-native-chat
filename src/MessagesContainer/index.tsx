import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  FlatListProps,
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  Platform } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import Animated, { Easing, runOnJS, ScrollEvent, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { BubbleGradientContext, BubbleGradientStore } from '../components/BubbleBackground'
import { useComposerPanels } from '../components/composerPanels'
import { GlassSurface } from '../components/GlassSurface'
import { Icon } from '../components/Icon'
import { MediaPlaybackContext } from '../components/mediaPlayback'
import { useIsKeyboardVisible } from '../hooks/useIsKeyboardVisible'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { LoadEarlierMessages } from '../LoadEarlierMessages'
import { IMessage } from '../Models'
import stylesCommon from '../styles'
import { TypingIndicator, TypingIndicatorListAnimationContext } from '../TypingIndicator'
import { isSameDay } from '../utils'
import { DayAnimated } from './components/DayAnimated'
import { useScrollGatedOpacity } from './components/DayAnimated/useScrollGatedOpacity'
import { MessageRow } from './components/Item'
import { PageDownCounter } from './components/PageDownCounter'
import { isArrivingMessage, listCellTransition, newestCellEntering } from './listTransitions'
import { PageDownReturnContext } from './pageDownReturn'
import { MessageRowConfigContext, useStableRowConfig } from './rowConfig'
import { MessageRowStore, MessageRowStoreContext, sameOrder } from './rowStore'
import styles, { createThemedStyles } from './styles'
import { MessagesContainerProps, DaysPositions, AnimatedFlatList } from './types'

// React Native 0.88's strict TypeScript API no longer exports `ViewToken`,
// `ViewabilityConfigCallbackPair` or `CellRendererProps`, and older versions do
// not have its `ListViewToken` replacement - so derive them from `FlatListProps`,
// which both generations of the typings ship.
type ViewabilityConfigCallbackPair = NonNullable<FlatListProps<unknown>['viewabilityConfigCallbackPairs']>[number]
type ViewToken = Parameters<ViewabilityConfigCallbackPair['onViewableItemsChanged']>[0]['viewableItems'][number]
type CellRendererProps = React.ComponentProps<NonNullable<FlatListProps<unknown>['CellRendererComponent']>>


export * from './types'

// Any pixel of a row on screen counts: the playing round note floats only once
// its row has left the list entirely.
const ROW_ON_SCREEN_CONFIG = { itemVisiblePercentThreshold: 0 }

/** The list counts as at the newest message within 5pt. */
const NEWEST_SLOP = 5

// The pagedown button comes up from 80 below at 0.7 scale and fades in, over 280ms on a
// decelerate curve.
const SCROLL_BUTTON_SHOW = { duration: 280, easing: Easing.out(Easing.quad) }
const SCROLL_BUTTON_RISE = 80
// 13% smaller in 80ms while pressed, back
// over 350ms on an overshoot with tension 2.
const SCROLL_BUTTON_PRESSED = 0.87
const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const x = t - 1
  return x * x * ((tension + 1) * x + tension) + 1
}
const SCROLL_BUTTON_PRESS_IN = { duration: 80 }
const SCROLL_BUTTON_PRESS_OUT = { duration: 350, easing: overshoot(2) }

export const MessagesContainer = <TMessage extends IMessage>(props: MessagesContainerProps<TMessage>) => {
  const {
    messages = [],
    user,
    isTyping = false,
    renderChatEmpty: renderChatEmptyProp,
    isInverted = true,
    listProps,
    isScrollToBottomEnabled = true,
    isScrollToBottomBadgeEnabled = true,
    // How far to scroll before the scroll-to-bottom button comes up.
    scrollToBottomOffset = 100,
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
    firstUnreadMessageId,
  } = props

  const themedStyles = useThemedStyles(createThemedStyles)
  const theme = useTheme()

  // `'auto'` is the only mode that cares about the keyboard, so the other two never
  // subscribe - and never re-render the whole list when the keyboard moves.
  const isKeyboardVisible = useIsKeyboardVisible(isAlignedTop === 'auto')

  const isTopAligned = isAlignedTop === 'auto'
    ? !isKeyboardVisible
    : isAlignedTop === true

  // Alignment lives on the list's content container rather than on the wrapper: with
  // `flexGrow` the content is at least a viewport tall, so `justifyContent` places a
  // short conversation and is a no-op once the messages outgrow the list - which keeps
  // long chats scrollable instead of letting the list size itself to its content.
  // An inverted list is flipped, so its content-container start is the visual bottom.
  const alignmentStyle = useMemo(() => {
    if (!isAlignedTop)
      return undefined

    return {
      flexGrow: 1,
      justifyContent: isTopAligned === isInverted ? 'flex-end' : 'flex-start',
    } as const
  }, [isAlignedTop, isTopAligned, isInverted])

  const listPropsOnScrollProp = listProps?.onScroll

  // Which rows are on screen, for the floating round note. The list reads viewability
  // callbacks once, at mount, and FlatList refuses
  // `onViewableItemsChanged` alongside `viewabilityConfigCallbackPairs`, so a
  // consumer's own handler is folded into the pairs here, read through a ref.
  const mediaController = useContext(MediaPlaybackContext)
  const mediaControllerRef = useRef(mediaController)
  mediaControllerRef.current = mediaController
  const markRowsSeenRef = useRef<(ids: (string | number)[]) => void>(() => {})
  const consumerViewableRef = useRef(listProps?.onViewableItemsChanged)
  consumerViewableRef.current = listProps?.onViewableItemsChanged
  const [viewabilityPairs] = useState(() => {
    const pairs: ViewabilityConfigCallbackPair[] = [{
      viewabilityConfig: ROW_ON_SCREEN_CONFIG,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const ids: (string | number)[] = []
        for (const token of viewableItems) {
          const id = (token.item as IMessage | undefined)?._id
          if (id != null)
            ids.push(id)
        }
        mediaControllerRef.current?.setViewableMessages(ids)
        markRowsSeenRef.current(ids)
      },
    }]
    if (listProps?.viewabilityConfigCallbackPairs)
      pairs.push(...listProps.viewabilityConfigCallbackPairs)
    else if (listProps?.onViewableItemsChanged)
      pairs.push({
        // FlatList's own default when a handler comes without a config.
        viewabilityConfig: listProps.viewabilityConfig ?? { viewAreaCoveragePercentThreshold: 0 },
        onViewableItemsChanged: info => consumerViewableRef.current?.(info),
      })
    return pairs
  })

  const scrollToBottomOpacity = useSharedValue(0)
  const isScrollingDown = useSharedValue(false)
  // Scroll-to-bottom button logic: scroll travelled
  // since the last change, whether the button came up from scrolling, and how far the viewport
  // is from the newest message.
  const scrollTravel = useSharedValue(0)
  const isShownByScroll = useSharedValue(false)
  const distanceFromNewestSV = useSharedValue(0)
  const lastScrolledY = useSharedValue(0)
  const [isScrollToBottomVisible, setIsScrollToBottomVisible] = useState(false)
  const [isListLaidOut, setIsListLaidOut] = useState(false)
  const scrollToBottomPressScale = useSharedValue(1)
  // The pressed state is the icon color at 15% over the circle.
  const scrollToBottomPressed = useSharedValue(0)
  const scrollToBottomPressedStyle = useAnimatedStyle(() => ({ opacity: scrollToBottomPressed.value }))
  const scrollToBottomStyleAnim = useAnimatedStyle(() => ({
    opacity: scrollToBottomOpacity.value,
    transform: [
      { translateY: (1 - scrollToBottomOpacity.value) * SCROLL_BUTTON_RISE },
      { scale: (0.7 + 0.3 * scrollToBottomOpacity.value) * scrollToBottomPressScale.value },
    ],
  }))

  const daysPositions = useSharedValue<DaysPositions>({})
  const listHeight = useSharedValue(0)
  const contentHeight = useSharedValue(0)
  const scrolledY = useSharedValue(0)
  // The date (createdAt ms) the floating day header is currently rendering. Used to
  // keep the inline separator visible until the header's text has caught up, hiding
  // the 1-frame JS-thread lag of the header on each day change.
  const floatingRenderedDate = useSharedValue<number | undefined>(undefined)
  // Every row's cell, for the bubbles that show their slice of a screen-fixed gradient.
  const cellLayouts = useSharedValue<Record<string, { y: number, height: number }>>({})
  const isScreenGradient = !!theme.bubble.outgoingGradient && theme.bubble.outgoingGradient.length > 1 &&
    theme.bubble.outgoingGradientMode === 'screen'
  const gradientStore = useMemo((): BubbleGradientStore | null => isScreenGradient
    ? { scrolledY, listHeight, cellLayouts, isInverted }
    : null
  , [isScreenGradient, scrolledY, listHeight, cellLayouts, isInverted])
  // true while the user is actively scrolling (finger down dragging or momentum
  // running). Drives the floating day header visibility so it stays opaque for the
  // whole gesture and only fades once scrolling fully stops.
  const isScrollActive = useSharedValue(false)
  // The floating day header's fade, shared with the inline separators it stands in for.
  const floatingDayOpacity = useScrollGatedOpacity(isScrollActive)

  // The incoming bubbles start past the avatar column: the row's 8, then the avatar
  // (pulled 2 towards the edge) and the 11 the tail curls into (see `Avatar`).
  const typingIndicatorAvatarInset = useMemo(() => ({ marginLeft: 8 - 2 + theme.avatar.size + 11 }), [theme.avatar.size])

  const renderTypingIndicator = useCallback(() => {
    if (renderTypingIndicatorProp)
      return renderTypingIndicatorProp()

    return <TypingIndicator isTyping={isTyping} style={[props.isAvatarVisible && typingIndicatorAvatarInset, props.typingIndicatorStyle]} />
  }, [isTyping, renderTypingIndicatorProp, props.isAvatarVisible, typingIndicatorAvatarInset, props.typingIndicatorStyle])

  // Only a custom footer is handed the props, so only then does it depend on them - the
  // typing indicator would otherwise be rebuilt, and the list with it, on every render.
  const footerProps = renderFooterProp ? props : undefined
  const ListFooterComponent = useMemo(() => {
    if (renderFooterProp)
      return renderFooterProp(footerProps!)

    return renderTypingIndicator()
  }, [renderFooterProp, renderTypingIndicator, footerProps])

  const renderLoadEarlier = useCallback(() => {
    if (loadEarlierMessagesProps?.isAvailable) {
      if (renderLoadEarlierProp)
        return renderLoadEarlierProp(loadEarlierMessagesProps)

      return <LoadEarlierMessages {...loadEarlierMessagesProps} />
    }

    return null
  }, [loadEarlierMessagesProps, renderLoadEarlierProp])

  // Whether the scroll-to-bottom button should be showing. Written from the scroll
  // worklet (UI thread) and from `doScrollToBottom` (JS); the reaction below is the
  // single place that reacts to it changing, so the JS thread is only involved on a
  // genuine transition rather than on every scroll frame.
  const isScrollToBottomShown = useSharedValue(false)

  useAnimatedReaction(
    () => isScrollToBottomShown.value,
    (isVisible, previous) => {
      if (isVisible === previous)
        return

      // Mount the button before fading it in; unmount only once it has faded out.
      if (isVisible)
        runOnJS(setIsScrollToBottomVisible)(true)

      scrollToBottomOpacity.value = withTiming(isVisible ? 1 : 0, SCROLL_BUTTON_SHOW, isFinished => {
        if (isFinished && !isVisible)
          runOnJS(setIsScrollToBottomVisible)(false)
      })
    })

  const scrollTo = useCallback((options: { animated?: boolean, offset: number }) => {
    if (options)
      forwardRef?.current?.scrollToOffset(options)
  }, [forwardRef])

  const pageDownReturn = useContext(PageDownReturnContext)
  const returnToMessageId = pageDownReturn?.messageId ?? null
  // A jump to a quoted message brings the button up, whatever the scroll did.
  useEffect(() => {
    if (returnToMessageId == null)
      return

    isShownByScroll.value = false
    isScrollToBottomShown.value = true
  }, [returnToMessageId, isShownByScroll, isScrollToBottomShown])

  const doScrollToBottom = useCallback((animated: boolean = true) => {
    isScrollingDown.value = true
    isScrollToBottomShown.value = false
    isShownByScroll.value = false
    scrollTravel.value = 0

    if (isInverted)
      scrollTo({ offset: 0, animated })
    else if (forwardRef?.current)
      forwardRef.current.scrollToEnd({ animated })
  }, [forwardRef, isInverted, scrollTo, isScrollingDown, isScrollToBottomShown, isShownByScroll, scrollTravel])

  // The only part of scroll handling that genuinely needs the JS thread: handing the
  // event to a consumer's own `onScroll`. Everything else is shared-value arithmetic
  // and stays in the worklet below.
  const notifyConsumerScroll = useCallback((event: ScrollEvent) => {
    listPropsOnScrollProp?.(event)
  }, [listPropsOnScrollProp])

  const hasConsumerOnScroll = !!listPropsOnScrollProp

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

  // The messages by id, for the rows to subscribe to (see rowStore). Synced while rendering so
  // rows mounting now read the new messages; rows already on screen hear about it on commit.
  const [rowStore] = useState(() => new MessageRowStore<TMessage>())
  rowStore.sync(messages, isInverted)
  useLayoutEffect(() => {
    rowStore.flush()
  })

  // The list's data keeps its identity while the ids and their order do: a status change,
  // a reaction or a streamed token then leaves the list and its cells alone.
  const listDataRef = useRef<TMessage[] | undefined>(undefined)
  const listData = sameOrder(listDataRef.current, messages)
  listDataRef.current = listData
  // For the callbacks that need the messages but should not change with them.
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // What every row shares, kept stable across renders that change nothing a row can see.
  const {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    messages: _messages,
    forwardRef: _forwardRef,
    listProps: _listProps,
    // The list's own chrome; no row draws any of it.
    isTyping: _isTyping,
    renderChatEmpty: _renderChatEmpty,
    renderFooter: _renderFooter,
    renderLoadEarlier: _renderLoadEarlier,
    loadEarlierMessagesProps: _loadEarlierMessagesProps,
    renderTypingIndicator: _renderTypingIndicator,
    typingIndicatorStyle: _typingIndicatorStyle,
    scrollToBottomComponent: _scrollToBottomComponent,
    scrollToBottomStyle: _scrollToBottomStyle,
    scrollToBottomContentStyle: _scrollToBottomContentStyle,
    scrollToBottomOffset: _scrollToBottomOffset,
    isScrollToBottomEnabled: _isScrollToBottomEnabled,
    isScrollToBottomBadgeEnabled: _isScrollToBottomBadgeEnabled,
    isAlignedTop: _isAlignedTop,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...sharedRowProps
  } = props
  const rowConfig = useStableRowConfig({
    ...sharedRowProps,
    isInverted,
    isDayAnimationEnabled,
    scrolledY,
    daysPositions,
    listHeight,
    floatingRenderedDate,
    floatingDayOpacity,
  })

  const renderItem = useCallback(({ item }: ListRenderItemInfo<unknown>): React.ReactElement =>
    <MessageRow id={String((item as TMessage)._id)} />
  , [])

  const emptyContent = useMemo(() => {
    if (!renderChatEmptyProp)
      return null

    return renderChatEmptyProp()
  }, [renderChatEmptyProp])

  // An inverted list flips its empty component along with its rows, so it is flipped back here.
  const renderChatEmpty = useCallback(() => {
    if (renderChatEmptyProp)
      return isInverted
        ? (
          <View style={[stylesCommon.fill, styles.emptyChatContainer]}>
            {emptyContent}
          </View>
        )
        : (
          <View style={stylesCommon.fill}>
            {emptyContent}
          </View>
        )

    return <View style={stylesCommon.fill} />
  }, [isInverted, renderChatEmptyProp, emptyContent])

  const ListHeaderComponent = useMemo(() => {
    const content = renderLoadEarlier()

    if (!content)
      return undefined

    return (
      <View style={stylesCommon.fill}>{content}</View>
    )
  }, [renderLoadEarlier])

  // The counter on the scroll-to-bottom button: messages that
  // arrive while away from the newest one count up and bring the button up; each counts down
  // as it scrolls into view (read), and the count clears when the button goes.
  const unreadIdsRef = useRef(new Set<string | number>())
  const [unreadCount, setUnreadCount] = useState(0)
  const newestMessageId = messages.length > 0
    ? (isInverted ? messages[0] : messages[messages.length - 1])?._id
    : undefined
  const previousNewestIdRef = useRef(newestMessageId)
  const userId = user?._id
  useEffect(() => {
    const previousNewestId = previousNewestIdRef.current
    previousNewestIdRef.current = newestMessageId

    if (!isScrollToBottomEnabled || previousNewestId == null || newestMessageId === previousNewestId)
      return

    const previousIndex = messages.findIndex(message => message._id === previousNewestId)
    if (previousIndex < 0)
      return

    const arrived = isInverted ? messages.slice(0, previousIndex) : messages.slice(previousIndex + 1)
    // At the newest message (within 5dp), or after sending one yourself, there is nothing to
    // count: the list follows the new message.
    const isFromMe = arrived.some(message => message.user?._id === userId)
    if (isFromMe || distanceFromNewestSV.value <= NEWEST_SLOP) {
      unreadIdsRef.current.clear()
      setUnreadCount(0)
      return
    }

    const incoming = arrived.filter(message => !message.system)
    if (incoming.length === 0)
      return

    if (isScrollToBottomBadgeEnabled) {
      incoming.forEach(message => unreadIdsRef.current.add(message._id))
      setUnreadCount(unreadIdsRef.current.size)
    }
    isShownByScroll.value = false
    isScrollToBottomShown.value = true
  }, [newestMessageId, messages, isInverted, userId, isScrollToBottomEnabled, isScrollToBottomBadgeEnabled, distanceFromNewestSV, isShownByScroll, isScrollToBottomShown])

  // Read as they come into view.
  markRowsSeenRef.current = (ids: (string | number)[]) => {
    if (unreadIdsRef.current.size === 0)
      return

    let changed = false
    for (const id of ids)
      changed = unreadIdsRef.current.delete(id) || changed

    if (changed)
      setUnreadCount(unreadIdsRef.current.size)
  }

  // Through a ref: the callback changes with every new message, and re-running this then would
  // clear a count just set by a message that arrived before the button had come up.
  const clearPageDownReturnRef = useRef(pageDownReturn?.clear)
  clearPageDownReturnRef.current = pageDownReturn?.clear
  useEffect(() => {
    if (!isScrollToBottomVisible) {
      unreadIdsRef.current.clear()
      setUnreadCount(0)
      clearPageDownReturnRef.current?.()
    }
  }, [isScrollToBottomVisible])

  const renderScrollBottomComponent = useCallback(() => {
    if (scrollToBottomComponentProp)
      return scrollToBottomComponentProp()

    // A down chevron in the glass icon color.
    return (
      <Icon
        name='chevronDown'
        color={themedStyles.chevronColor.color}
        size={26}
        fallback={<View style={themedStyles.scrollChevron} />}
      />
    )
  }, [scrollToBottomComponentProp, themedStyles])

  const goBackFromQuote = pageDownReturn?.goBack
  const handleScrollToBottomPress = useCallback(() => {
    if (returnToMessageId != null && goBackFromQuote) {
      goBackFromQuote()
      return
    }

    doScrollToBottom()
  }, [doScrollToBottom, returnToMessageId, goBackFromQuote])

  const handleScrollToBottomPressIn = useCallback(() => {
    scrollToBottomPressScale.value = withTiming(SCROLL_BUTTON_PRESSED, SCROLL_BUTTON_PRESS_IN)
    scrollToBottomPressed.value = 1
  }, [scrollToBottomPressScale, scrollToBottomPressed])

  const handleScrollToBottomPressOut = useCallback(() => {
    scrollToBottomPressScale.value = withTiming(1, SCROLL_BUTTON_PRESS_OUT)
    scrollToBottomPressed.value = withTiming(0, { duration: 150 })
  }, [scrollToBottomPressScale, scrollToBottomPressed])

  const scrollToBottomContent = useMemo(() => {
    return (
      <Animated.View
        style={[
          stylesCommon.centerItems,
          styles.scrollToBottomContent,
          scrollToBottomContentStyle,
          scrollToBottomStyleAnim,
        ]}
      >
        <GlassSurface
          color={theme.colors.scrollToBottomBackground}
          borderColor={theme.colors.inputFieldBorder}
          style={styles.scrollToBottomSurface}
        />
        <Animated.View
          pointerEvents='none'
          style={[styles.scrollToBottomPressed, themedStyles.scrollToBottomPressed, scrollToBottomPressedStyle]}
        />
        {renderScrollBottomComponent()}
        <PageDownCounter
          count={unreadCount}
          style={[styles.scrollToBottomBadge, themedStyles.scrollToBottomBadge]}
          textStyle={themedStyles.scrollToBottomBadgeText}
        />
      </Animated.View>
    )
  }, [scrollToBottomStyleAnim, scrollToBottomContentStyle, renderScrollBottomComponent, themedStyles, unreadCount, theme, scrollToBottomPressedStyle])

  const ScrollToBottomWrapper = useCallback(() => {
    if (!isScrollToBottomEnabled)
      return null

    if (!isScrollToBottomVisible)
      return null

    return (
      <Pressable
        style={[styles.scrollToBottom, scrollToBottomStyle]}
        onPress={handleScrollToBottomPress}
        onPressIn={handleScrollToBottomPressIn}
        onPressOut={handleScrollToBottomPressOut}
        accessibilityRole='button'
        hitSlop={6}
      >
        {scrollToBottomContent}
      </Pressable>
    )
  }, [isScrollToBottomEnabled, isScrollToBottomVisible, handleScrollToBottomPress, handleScrollToBottomPressIn, handleScrollToBottomPressOut, scrollToBottomContent, scrollToBottomStyle])

  const onLayoutList = useCallback((event: LayoutChangeEvent) => {
    listHeight.value = event.nativeEvent.layout.height
    setIsListLaidOut(true)

    // Tied to an explicit `isScrollToBottomEnabled`, as it was before the button became a
    // default, so a non-inverted chat that never asked for it is not scrolled on every layout.
    if (
      !isInverted &&
      messagesRef.current.length &&
      props.isScrollToBottomEnabled === true
    ) {
      // Layout fires repeatedly (keyboard, rotation, content growth), so this is
      // re-armed rather than stacked, and cancelled on unmount - otherwise every
      // layout left a 500ms timer holding this closure.
      clearTimeout(initialScrollTimeout.current)
      initialScrollTimeout.current = setTimeout(() => {
        doScrollToBottom(false)
      }, 500)
    }

    // listProps.onLayout may be a SharedValue in Reanimated types, but we only accept functions
    const onLayoutProp = listProps?.onLayout as ((event: LayoutChangeEvent) => void) | undefined
    onLayoutProp?.(event)
  }, [isInverted, doScrollToBottom, listHeight, listProps, props.isScrollToBottomEnabled])

  const onEndReached = useCallback(() => {
    if (
      loadEarlierMessagesProps &&
      loadEarlierMessagesProps.isAvailable &&
      loadEarlierMessagesProps.isInfiniteScrollEnabled &&
      !loadEarlierMessagesProps.isLoading
    )
      loadEarlierMessagesProps.onPress()
  }, [loadEarlierMessagesProps])

  // `scrollToIndex` to a row that is not laid out yet (a quoted message far up the history)
  // fails; jump to its estimated offset, then retry once the rows there have rendered, with the
  // placement the request asked for.
  const scrollRequestRef = useRef({ viewPosition: 0.5, animated: true })
  const scrollRetriesRef = useRef(0)
  const scrollRetryTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(scrollRetryTimeout.current), [])
  const onScrollToIndexFailed = useCallback((info: { index: number, averageItemLength: number }) => {
    if (scrollRetriesRef.current >= 5) {
      scrollRetriesRef.current = 0
      return
    }
    scrollRetriesRef.current += 1
    forwardRef?.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: scrollRequestRef.current.animated })
    clearTimeout(scrollRetryTimeout.current)
    scrollRetryTimeout.current = setTimeout(() => {
      try {
        forwardRef?.current?.scrollToIndex({ index: info.index, ...scrollRequestRef.current })
        scrollRetriesRef.current = 0
      } catch {
        // gave up; the list stays at the estimate
      }
    }, 250)
  }, [forwardRef])

  // A chat with unread messages opens on its "Unread Messages" bar, scrolled to the top
  // of the screen. The row has to be
  // rendered to be scrolled to, so the first render reaches it.
  const unreadIndex = firstUnreadMessageId != null
    ? messages.findIndex(message => message._id === firstUnreadMessageId)
    : -1
  const scrolledToUnreadRef = useRef<string | number | null>(null)
  const unreadScrollTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrollRequestResetTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => {
    clearTimeout(unreadScrollTimeout.current)
    clearTimeout(scrollRequestResetTimeout.current)
  }, [])
  useEffect(() => {
    if (!isListLaidOut || unreadIndex < 0 || firstUnreadMessageId == null || scrolledToUnreadRef.current === firstUnreadMessageId)
      return

    scrolledToUnreadRef.current = firstUnreadMessageId
    // The newest message already is the first unread one: the list starts there anyway.
    if (unreadIndex === (isInverted ? 0 : messages.length - 1))
      return

    clearTimeout(unreadScrollTimeout.current)
    // After the first rows have measured themselves.
    unreadScrollTimeout.current = setTimeout(() => {
      const request = { viewPosition: isInverted ? 1 : 0, animated: false }
      scrollRequestRef.current = request
      try {
        forwardRef?.current?.scrollToIndex({ index: unreadIndex, ...request })
      } catch {
        // Not measured yet; `onScrollToIndexFailed` retries.
      }
      // Later jumps (to a quoted message) go back to the middle, animated.
      scrollRequestResetTimeout.current = setTimeout(() => {
        scrollRequestRef.current = { viewPosition: 0.5, animated: true }
      }, 1500)
    }, 50)
  }, [isListLaidOut, unreadIndex, firstUnreadMessageId, isInverted, messages.length, forwardRef])

  const keyExtractor = useCallback((item: unknown) => (item as TMessage)._id.toString(), [])

  const initialScrollTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => {
    clearTimeout(initialScrollTimeout.current)
  }, [])

  // Records where each message sits in the content so the floating day header
  // knows which day is currently on screen. Shared by both cell renderers.
  const trackDayPosition = useCallback((message: IMessage | undefined, layout: { y: number, height: number }) => {
    // Recorded whatever the theme: a cell is only measured when it lays out, so a switch
    // into the screen-gradient theme (dark mode) would otherwise find no rows to paint.
    if (message) {
      const cell = { y: layout.y, height: layout.height }
      const key = message._id.toString()
      cellLayouts.modify(value => {
        'worklet'

        value[key] = cell
        return value
      })
    }

    // Only track positions when day animation is enabled
    if (!isDayAnimationEnabled || !message)
      return

    const id = message._id.toString()
    const { y, height } = layout

    // Both the timestamp and the calendar-day key are resolved here, on the JS thread,
    // so the worklet below never has to build a Date to decide whether two entries fall
    // on the same day - it runs on every cell layout, which is constant during a
    // recycling scroll.
    const date = new Date(message.createdAt)
    const newValue = {
      y,
      height,
      createdAt: date.getTime(),
      dayKey: date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate(),
    }

    daysPositions.modify(value => {
      'worklet'

      // A plain for-in avoids the array `Object.entries` would allocate per layout.
      for (const key in value) {
        const item = value[key]
        if (item.dayKey === newValue.dayKey && (isInverted ? item.y <= newValue.y : item.y >= newValue.y)) {
          delete value[key]
          break
        }
      }

      // @ts-expect-error: https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue#remarks
      value[id] = newValue
      return value
    })
  }, [daysPositions, isInverted, isDayAnimationEnabled, cellLayouts])

  // The ids on screen as of the last commit, to tell a message that has just arrived from a
  // row the list mounts late (windowing, or scrolling back down).
  const knownIdsRef = useRef<ReadonlySet<string | number>>(new Set(messages.map(message => message._id)))
  useEffect(() => {
    knownIdsRef.current = new Set(messages.map(message => message._id))
  }, [messages])

  // Rows slide to their new place when one arrives or changes height, and the newest
  // message rises in from below. Only inverted: a non-inverted chat scrolls to a new
  // message instead.
  const areCellsAnimated = isInverted

  const renderCell = useCallback((props: CellRendererProps) => {
    const { item, index, onLayout: onLayoutProp, children } = props

    const handleOnLayout = (event: LayoutChangeEvent) => {
      onLayoutProp?.(event)
      // The list's own item can be an older copy of the message (its data keeps its identity
      // while the order does); the store has the current one.
      trackDayPosition(rowStore.getMessage((item as IMessage)._id) ?? item as IMessage, event.nativeEvent.layout)
    }

    if (!areCellsAnimated)
      return (
        <View
          {...props}
          onLayout={handleOnLayout}
        >
          {children}
        </View>
      )

    const isArriving = isArrivingMessage((item as IMessage)._id, index, knownIdsRef.current)

    return (
      <Animated.View
        {...props}
        layout={listCellTransition}
        entering={isArriving ? newestCellEntering : undefined}
        onLayout={handleOnLayout}
      >
        {children}
      </Animated.View>
    )
  }, [trackDayPosition, areCellsAnimated, rowStore])

  // No dependency array: on native Reanimated logs a warning for one on every render,
  // and it compares the handlers' worklet closures itself to pick up changes.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      const y = event.contentOffset.y
      const contentSizeHeight = event.contentSize.height
      const layoutHeight = event.layoutMeasurement.height

      scrolledY.value = y

      isScrollingDown.value = isInverted
        ? lastScrolledY.value > y
        : lastScrolledY.value < y

      lastScrolledY.value = y
      contentHeight.value = contentSizeHeight

      // How far the viewport sits from the newest message. An inverted list counts
      // that straight from the offset (0 is the bottom); a normal list measures the
      // gap left below the viewport.
      const distanceFromNewest = isInverted
        ? y
        : contentSizeHeight - layoutHeight - y

      const delta = distanceFromNewest - distanceFromNewestSV.value
      distanceFromNewestSV.value = distanceFromNewest

      // The button hides once the newest message is reached; it comes up after scrolling
      // back towards the newest by `scrollToBottomOffset`, and goes again after scrolling
      // away by as much if scrolling is what brought it up.
      if (distanceFromNewest <= NEWEST_SLOP) {
        if (delta <= 0) {
          isScrollToBottomShown.value = false
          isShownByScroll.value = false
          scrollTravel.value = 0
        }
      } else if (delta < 0) {
        if (!isScrollToBottomShown.value) {
          scrollTravel.value += -delta
          if (scrollTravel.value > scrollToBottomOffset!) {
            scrollTravel.value = 0
            isScrollToBottomShown.value = true
            isShownByScroll.value = true
          }
        }
      } else if (delta > 0 && isShownByScroll.value && isScrollToBottomShown.value) {
        scrollTravel.value -= delta
        if (scrollTravel.value < -scrollToBottomOffset!) {
          scrollTravel.value = 0
          isScrollToBottomShown.value = false
          isShownByScroll.value = false
        }
      }

      if (hasConsumerOnScroll)
        runOnJS(notifyConsumerScroll)(event)
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
  })

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

  // A tap on the chat (not a scroll) closes the emoji keyboard.
  const composerPanels = useComposerPanels()
  const touchStartRef = useRef<{ x: number, y: number } | null>(null)
  const onListTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
  }, [])
  const onListTouchEnd = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || !composerPanels)
      return
    const moved = Math.abs(event.nativeEvent.pageX - start.x) + Math.abs(event.nativeEvent.pageY - start.y)
    if (moved < 10)
      composerPanels.close()
  }, [composerPanels])

  const contentContainerStyle = useMemo(() => [styles.messagesContainer, alignmentStyle], [alignmentStyle])
  const listFooter = useMemo(() => isInverted ? ListHeaderComponent : <>{ListFooterComponent}</>, [isInverted, ListHeaderComponent, ListFooterComponent])
  const listHeader = useMemo(() => isInverted ? <>{ListFooterComponent}</> : ListHeaderComponent, [isInverted, ListHeaderComponent, ListFooterComponent])
  const initialNumToRender = Math.max(12, unreadIndex + 4)

  // Memoized, so a render of the container that leaves the list's inputs alone - a status
  // change or a reaction, which keep the data's identity - does not walk the list's cells.
  const listEngine = useMemo(() => {
    return (
      <AnimatedFlatList
        ref={forwardRef}
        keyExtractor={keyExtractor}
        data={listData}
        renderItem={renderItem}
        inverted={isInverted}
        style={stylesCommon.fill}
        contentContainerStyle={contentContainerStyle}
        ListEmptyComponent={renderChatEmpty}
        ListFooterComponent={listFooter}
        ListHeaderComponent={listHeader}
        scrollEventThrottle={1}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.1}
        keyboardDismissMode='interactive'
        keyboardShouldPersistTaps='handled'
        onScrollToIndexFailed={onScrollToIndexFailed}
        automaticallyAdjustContentInsets={false}
        // Virtualization defaults tuned for chat lists. All are overridable via
        // `listProps` below (spread last), so consumers keep full control.
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={initialNumToRender}
        maxToRenderPerBatch={10}
        windowSize={9}
        updateCellsBatchingPeriod={50}
        {...listProps}
        onScroll={scrollHandler}
        onViewableItemsChanged={undefined}
        viewabilityConfig={undefined}
        viewabilityConfigCallbackPairs={viewabilityPairs}
        onLayout={onLayoutList}
        CellRendererComponent={renderCell}
      />
    )
  }, [forwardRef, keyExtractor, listData, renderItem, isInverted, contentContainerStyle, renderChatEmpty, listFooter, listHeader, onEndReached, onScrollToIndexFailed, listProps, scrollHandler, viewabilityPairs, onLayoutList, renderCell, initialNumToRender])

  const list = (
    <View
      style={[styles.contentContainerStyle, themedStyles.root, stylesCommon.fill]}
      onTouchStart={onListTouchStart}
      onTouchEnd={onListTouchEnd}
    >
      {listEngine}
      <ScrollToBottomWrapper />
      {isDayAnimationEnabled && (
        <DayAnimated
          scrolledY={scrolledY}
          daysPositions={daysPositions}
          listHeight={listHeight}
          isScrollActive={isScrollActive}
          floatingRenderedDate={floatingRenderedDate}
          opacity={floatingDayOpacity}
          renderDay={renderDayProp}
          isLoading={loadEarlierMessagesProps?.isLoading ?? false}
          dateFormat={props.dateFormat}
          dateFormatCalendar={props.dateFormatCalendar}
        />
      )}
    </View>
  )

  const animatedList = (
    <TypingIndicatorListAnimationContext.Provider value={areCellsAnimated}>
      {list}
    </TypingIndicatorListAnimationContext.Provider>
  )

  // Always mounted, with `null` outside the screen-gradient theme: wrapping the list only in
  // that theme moved it in the tree whenever the color scheme flipped, and React remounted
  // the whole list - back at the newest message, wherever the user had scrolled.
  return (
    <BubbleGradientContext.Provider value={gradientStore}>
      <MessageRowStoreContext.Provider value={rowStore as unknown as MessageRowStore}>
        <MessageRowConfigContext.Provider value={rowConfig}>
          {animatedList}
        </MessageRowConfigContext.Provider>
      </MessageRowStoreContext.Provider>
    </BubbleGradientContext.Provider>
  )
}
