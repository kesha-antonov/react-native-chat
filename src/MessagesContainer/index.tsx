import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  GestureResponderEvent,
  LayoutChangeEvent } from 'react-native'
import type { ViewabilityConfigCallbackPair, ViewToken } from '@legendapp/list/react-native'
import { AnimatedLegendList } from '@legendapp/list/reanimated'
import { Pressable } from 'react-native-gesture-handler'
import Animated, { Easing, makeMutable, runOnJS, SharedValue, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'
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
import { listCellTransition } from './listTransitions'
import { PageDownReturnContext } from './pageDownReturn'
import { MessageRowConfigContext, useStableRowConfig } from './rowConfig'
import { MessageRowStore, MessageRowStoreContext, sameOrder } from './rowStore'
import styles, { createThemedStyles } from './styles'
import { MessagesContainerProps, DaysPositions } from './types'


/** The parts of Legend List's state the container reads. */
interface ListState {
  positionByKey: (key: string) => number | undefined
  listenToPosition: (key: string, callback: (position: number) => void) => () => void
  sizes: Map<string, number>
}


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
  // The list renders oldest first, top to bottom, and a conversation shorter than the list sits
  // at its bottom - unless `isAlignedTop` says otherwise.
  const alignItemsAtEnd = !isTopAligned


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
  // The list's scroll offset, from the top, kept on the UI thread by the list itself.
  const scrollOffset = useSharedValue(0)
  const sharedValues = useMemo(() => ({ scrollOffset }), [scrollOffset])
  // Rows' positions count from the first row, below the list's header ("Load earlier"); the
  // scroll offset counts from the very top. The day header, the inline separators and the
  // gradient bubbles read the offset in the rows' terms.
  const headerSize = useSharedValue(0)
  const scrolledY = useDerivedValue(() => scrollOffset.value - headerSize.value)
  // The date (createdAt ms) the floating day header is currently rendering. Used to
  // keep the inline separator visible until the header's text has caught up, hiding
  // the 1-frame JS-thread lag of the header on each day change.
  const floatingRenderedDate = useSharedValue<number | undefined>(undefined)
  // Where each screen-gradient bubble's row sits: one shared value per message, created when its
  // bubble asks, and fed by the list's own position listener for that row - so a row moving
  // re-runs its bubble's worklets and no other's.
  const cellValuesRef = useRef(new Map<string, { value: SharedValue<{ y: number, height: number } | undefined>, unsubscribe?: () => void }>())
  const listState = useCallback((): ListState | undefined =>
    (forwardRef?.current as unknown as { getState?: () => ListState } | null)?.getState?.()
  , [forwardRef])
  const subscribeCell = useCallback((id: string) => {
    const entry = cellValuesRef.current.get(id)
    const state = listState()
    if (!entry || entry.unsubscribe || !state)
      return
    const update = (y: number) => {
      entry.value.value = { y, height: state.sizes.get(id) ?? 0 }
    }
    const y = state.positionByKey(id)
    if (y != null)
      update(y)
    entry.unsubscribe = state.listenToPosition(id, update)
  }, [listState])
  const cellLayout = useCallback((id: string) => {
    let entry = cellValuesRef.current.get(id)
    if (!entry) {
      entry = { value: makeMutable<{ y: number, height: number } | undefined>(undefined) }
      cellValuesRef.current.set(id, entry)
      subscribeCell(id)
    }
    return entry.value
  }, [subscribeCell])
  useEffect(() => () => {
    cellValuesRef.current.forEach(entry => entry.unsubscribe?.())
    cellValuesRef.current.clear()
  }, [])
  const isScreenGradient = !!theme.bubble.outgoingGradient && theme.bubble.outgoingGradient.length > 1 &&
    theme.bubble.outgoingGradientMode === 'screen'
  const gradientStore = useMemo((): BubbleGradientStore | null => isScreenGradient
    ? { scrolledY, listHeight, cellLayout, isInverted: false }
    : null
  , [isScreenGradient, scrolledY, listHeight, cellLayout])
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
  const ListFooterComponent = useMemo(() => (
    <>
      {renderFooterProp ? renderFooterProp(footerProps!) : renderTypingIndicator()}
    </>
  ), [renderFooterProp, renderTypingIndicator, footerProps])

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

    forwardRef?.current?.scrollToEnd({ animated })
  }, [forwardRef, isScrollingDown, isScrollToBottomShown, isShownByScroll, scrollTravel])


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
  // The list renders oldest first; `messages` comes newest first unless `isInverted` is off.
  const orderedData = useMemo(() => isInverted ? [...listData].reverse() : listData, [listData, isInverted])

  // A chat with unread messages opens on its "Unread Messages" bar, at the top of the screen,
  // and one without them at the newest message. Decided once, when the list first renders.
  const [initialScroll] = useState(() => {
    const index = firstUnreadMessageId != null
      ? orderedData.findIndex(message => message._id === firstUnreadMessageId)
      : -1
    // The newest message already is the first unread one: the list starts there anyway.
    return index >= 0 && index < orderedData.length - 1
      ? { initialScrollIndex: { index, viewPosition: 0 } }
      : { initialScrollAtEnd: true }
  })

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

  const renderItem = useCallback(({ item }: { item: unknown }): React.ReactElement =>
    <MessageRow id={String((item as TMessage)._id)} />
  , [])

  const emptyContent = useMemo(() => {
    if (!renderChatEmptyProp)
      return null

    return renderChatEmptyProp()
  }, [renderChatEmptyProp])

  const renderChatEmpty = useMemo(() => (
    <View style={stylesCommon.fill}>
      {renderChatEmptyProp ? emptyContent : null}
    </View>
  ), [renderChatEmptyProp, emptyContent])

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

    const onLayoutProp = listProps?.onLayout as ((event: LayoutChangeEvent) => void) | undefined
    onLayoutProp?.(event)
  }, [listHeight, listProps])

  // The oldest messages are at the top, so infinite scroll loads earlier ones on reaching it.
  const onStartReached = useCallback(() => {
    if (
      loadEarlierMessagesProps &&
      loadEarlierMessagesProps.isAvailable &&
      loadEarlierMessagesProps.isInfiniteScrollEnabled &&
      !loadEarlierMessagesProps.isLoading
    )
      loadEarlierMessagesProps.onPress()
  }, [loadEarlierMessagesProps])



  const keyExtractor = useCallback((item: unknown) => (item as TMessage)._id.toString(), [])

  // Where each day's opening message sits, for the floating day header: the list reports a
  // row's position whenever it changes, so only the rows that open a day are followed, and
  // their moves reach the UI thread once a frame.
  const dayStartIds = useMemo(() => {
    const ids: string[] = []
    for (let i = 0; i < messages.length; i++) {
      const previous = isInverted ? messages[i + 1] : messages[i - 1]
      if (!previous || !isSameDay(messages[i], previous))
        ids.push(messages[i]._id.toString())
    }
    return ids
  }, [messages, isInverted])

  useEffect(() => {
    const state = isListLaidOut && isDayAnimationEnabled ? listState() : undefined
    if (!state)
      return

    let pending: Record<string, DaysPositions[string]> | null = null
    let frame: number | null = null
    const flush = () => {
      frame = null
      const batch = pending
      pending = null
      if (batch)
        daysPositions.modify(value => {
          'worklet'

          for (const key in batch)
            value[key] = batch[key]
          return value
        })
    }

    const initial: DaysPositions = {}
    const unsubscribes = dayStartIds.map(id => {
      const message = rowStore.getMessage(id)
      const date = new Date(message?.createdAt ?? 0)
      const entry = (y: number): DaysPositions[string] => ({
        x: 0,
        width: 0,
        y,
        height: state.sizes.get(id) ?? 0,
        createdAt: date.getTime(),
        dayKey: date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate(),
      })
      const y = state.positionByKey(id)
      if (y != null)
        initial[id] = entry(y)
      return state.listenToPosition(id, position => {
        (pending ??= {})[id] = entry(position)
        frame ??= requestAnimationFrame(flush)
      })
    })
    // The days this list shows now, replacing any that went with a deleted or earlier message.
    daysPositions.value = initial

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
      if (frame != null)
        cancelAnimationFrame(frame)
    }
  }, [dayStartIds, isListLaidOut, isDayAnimationEnabled, listState, daysPositions, rowStore])

  // Gradient bubbles that asked for their row before the list could report positions.
  useEffect(() => {
    if (isListLaidOut)
      cellValuesRef.current.forEach((_, id) => subscribeCell(id))
  }, [isListLaidOut, subscribeCell])

  // A row that changes height (a reaction, a reply loaded) keeps its place but moves its
  // bottom edge, which the gradient bubbles paint from.
  const onItemSizeChanged = useCallback(({ itemKey, size }: { itemKey: string, size: number }) => {
    const entry = cellValuesRef.current.get(itemKey)
    const current = entry?.value.value
    if (entry && current)
      entry.value.value = { y: current.y, height: size }
  }, [])

  // Scroll state, on the UI thread from the list's scroll offset: how far the viewport is from
  // the newest message decides the scroll-to-bottom button.
  useAnimatedReaction(
    () => scrollOffset.value,
    y => {
      isScrollingDown.value = lastScrolledY.value < y
      lastScrolledY.value = y

      const distanceFromNewest = Math.max(0, contentHeight.value - listHeight.value - y)
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
    })

  // The floating day header shows while a finger or momentum moves the list.
  const onScrollBeginDrag = useCallback(() => {
    isScrollActive.value = true
  }, [isScrollActive])
  // Momentum (if any) re-asserts it within the header's fade-out delay, so a flick keeps the
  // header up.
  const dragEndedAtRef = useRef(0)
  const onScrollEndDrag = useCallback(() => {
    dragEndedAtRef.current = Date.now()
    isScrollActive.value = false
  }, [isScrollActive])
  const onMomentumScrollEnd = useCallback(() => {
    isScrollActive.value = false
  }, [isScrollActive])
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.value = height
  }, [contentHeight])
  const onMetricsChange = useCallback((metrics: { headerSize: number }) => {
    headerSize.value = metrics.headerSize
  }, [headerSize])

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

  // Only a fling's momentum counts: the list's own scrolls (opening at the newest message,
  // following a new one) start momentum on Android without ever ending it, which left the
  // header up for good.
  const onMomentumScrollBegin = useCallback(() => {
    if (Date.now() - dragEndedAtRef.current < 300)
      isScrollActive.value = true
  }, [isScrollActive])

  // New messages keep the list at the newest one while it is there (or near), and the
  // newest message comes up from below with the scroll, as the rows above it make room.
  const maintainScrollAtEnd = useMemo(() => ({ animated: true }), [])

  // Memoized, so a render of the container that leaves the list's inputs alone - a status
  // change or a reaction, which keep the data's identity - does not walk the list's rows.
  const listEngine = useMemo(() => (
    <AnimatedLegendList
      ref={forwardRef}
      keyExtractor={keyExtractor}
      data={orderedData}
      renderItem={renderItem}
      estimatedItemSize={64}
      // Oldest first, top to bottom: no inverted list, no flipped rows.
      alignItemsAtEnd={alignItemsAtEnd}
      {...initialScroll}
      maintainScrollAtEnd={maintainScrollAtEnd}
      maintainVisibleContentPosition
      // Rows that move (a message arriving, a row growing a reaction, the typing bubble
      // coming or going) slide to their new place instead of jumping there.
      itemLayoutAnimation={listCellTransition}
      sharedValues={sharedValues}
      style={stylesCommon.fill}
      contentContainerStyle={styles.messagesContainer}
      ListEmptyComponent={renderChatEmpty}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      onStartReached={onStartReached}
      onStartReachedThreshold={0.1}
      keyboardDismissMode='interactive'
      keyboardShouldPersistTaps='handled'
      {...listProps}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollBegin={onMomentumScrollBegin}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onContentSizeChange={onContentSizeChange}
      onItemSizeChanged={onItemSizeChanged}
      onMetricsChange={onMetricsChange}
      onViewableItemsChanged={undefined}
      viewabilityConfig={undefined}
      viewabilityConfigCallbackPairs={viewabilityPairs}
      onLayout={onLayoutList}
    />
  ), [forwardRef, keyExtractor, orderedData, renderItem, alignItemsAtEnd, initialScroll, maintainScrollAtEnd, sharedValues, renderChatEmpty, ListHeaderComponent, ListFooterComponent, onStartReached, listProps, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd, onContentSizeChange, onItemSizeChanged, onMetricsChange, viewabilityPairs, onLayoutList])

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
    <TypingIndicatorListAnimationContext.Provider value>
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
