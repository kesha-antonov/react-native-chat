import React, { useContext, useMemo } from 'react'
import { View } from 'react-native'
import { AnimatedLegendList } from '@legendapp/list/reanimated'
import { useSharedValue } from 'react-native-reanimated'
import { BubbleGradientContext, BubbleGradientStore } from '../components/BubbleBackground'
import { useIsKeyboardVisible } from '../hooks/useIsKeyboardVisible'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage } from '../Models'
import stylesCommon from '../styles'
import { TypingIndicatorListAnimationContext } from '../TypingIndicator'
import { DayAnimated } from './components/DayAnimated'
import { ScrollToBottomButton } from './components/ScrollToBottomButton'
import { useListState } from './listState'
import { listCellTransition } from './listTransitions'
import { PageDownReturnContext } from './pageDownReturn'
import { MessageRowConfigContext, RowTargetsContext } from './rowConfig'
import { MessageRowStore, MessageRowStoreContext } from './rowStore'
import styles, { createThemedStyles } from './styles'
import { MessagesContainerProps, DaysPositions } from './types'
import { useCellLayouts } from './useCellLayouts'
import { useChained } from './useChained'
import { useDaysPositions } from './useDaysPositions'
import { useListChrome } from './useListChrome'
import { useListMetrics, useRowsHeight } from './useListMetrics'
import { useMessageRows } from './useMessageRows'
import { usePageDownUnread } from './usePageDownUnread'
import { useScrollActivity } from './useScrollActivity'
import { useScrollToBottom } from './useScrollToBottom'
import { useTapToClosePanels } from './useTapToClosePanels'
import { useViewabilityPairs } from './viewability'


export * from './types'

export const MessagesContainer = <TMessage extends IMessage>(props: MessagesContainerProps<TMessage>) => {
  const {
    messages = [],
    user,
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
    forwardRef,
    scrollToBottomComponent: scrollToBottomComponentProp,
    renderDay: renderDayProp,
    isDayAnimationEnabled = true,
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

  const {
    isListLaidOut,
    isLayoutAnimated,
    listHeight,
    contentHeight,
    scrollOffset,
    sharedValues,
    rowsHeight,
    scrolledY,
    onLayoutList,
    onContentSizeChange,
    onMetricsChange,
    maintainScrollAtEnd,
  } = useListMetrics(listProps)
  const listState = useListState(forwardRef)
  const { cellLayout, onItemSizeChanged } = useCellLayouts(listState, isListLaidOut)

  const daysPositions = useSharedValue<DaysPositions>({})
  // The date (createdAt ms) the floating day header is currently rendering. Used to
  // keep the inline separator visible until the header's text has caught up, hiding
  // the 1-frame JS-thread lag of the header on each day change.
  const floatingRenderedDate = useSharedValue<number | undefined>(undefined)
  const {
    isScrollActive,
    floatingDayOpacity,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  } = useScrollActivity()

  const isScreenGradient = !!theme.bubble.outgoingGradient && theme.bubble.outgoingGradient.length > 1 &&
    theme.bubble.outgoingGradientMode === 'screen'
  const gradientStore = useMemo((): BubbleGradientStore | null => isScreenGradient
    ? { scrolledY, listHeight, cellLayout, isInverted: false }
    : null
  , [isScreenGradient, scrolledY, listHeight, cellLayout])

  const { ListHeaderComponent, ListFooterComponent, renderChatEmpty, onStartReached } = useListChrome(props)

  const pageDownReturn = useContext(PageDownReturnContext)
  const {
    scrollToBottomOpacity,
    isScrollToBottomVisible,
    isScrollToBottomShown,
    isShownByScroll,
    distanceFromNewestSV,
    handleScrollToBottomPress,
  } = useScrollToBottom({
    forwardRef,
    scrollOffset,
    contentHeight,
    listHeight,
    scrollToBottomOffset,
    pageDownReturn,
  })

  const { rowStore, orderedData, initialScroll, rowConfig, rowTargets, renderItem, keyExtractor } = useMessageRows(props, {
    scrolledY,
    daysPositions,
    listHeight,
    floatingRenderedDate,
    floatingDayOpacity,
  })

  const { unreadCount, markRowsSeen } = usePageDownUnread({
    messages,
    isInverted,
    userId: user?._id,
    isScrollToBottomEnabled,
    isScrollToBottomBadgeEnabled,
    isScrollToBottomVisible,
    distanceFromNewestSV,
    isShownByScroll,
    isScrollToBottomShown,
    listState,
    pageDownReturn,
  })

  const viewabilityPairs = useViewabilityPairs(listProps, markRowsSeen)

  useDaysPositions({
    messages,
    isInverted,
    isListLaidOut,
    isDayAnimationEnabled,
    listState,
    daysPositions,
    rowStore,
  })

  useRowsHeight(isListLaidOut, listState, rowsHeight, orderedData)

  const { onListTouchStart, onListTouchEnd } = useTapToClosePanels()

  // The list's own handlers run first, then the app's from `listProps` (they used to be dropped).
  const handleScrollBeginDrag = useChained(onScrollBeginDrag, listProps?.onScrollBeginDrag)
  const handleScrollEndDrag = useChained(onScrollEndDrag, listProps?.onScrollEndDrag)
  const handleMomentumScrollBegin = useChained(onMomentumScrollBegin, listProps?.onMomentumScrollBegin)
  const handleMomentumScrollEnd = useChained(onMomentumScrollEnd, listProps?.onMomentumScrollEnd)
  const handleContentSizeChange = useChained(onContentSizeChange, listProps?.onContentSizeChange)
  const handleItemSizeChanged = useChained(onItemSizeChanged, listProps?.onItemSizeChanged)
  const handleMetricsChange = useChained(onMetricsChange, listProps?.onMetricsChange)
  // The app's padding goes on top of the list's own, rather than in its place.
  const listContentStyle = listProps?.contentContainerStyle
  const contentContainerStyle = useMemo(
    () => (listContentStyle ? [styles.messagesContainer, listContentStyle] : styles.messagesContainer),
    [listContentStyle]
  )

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
      itemLayoutAnimation={isLayoutAnimated ? listCellTransition : undefined}
      sharedValues={sharedValues}
      style={stylesCommon.fill}
      ListEmptyComponent={renderChatEmpty}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      onStartReached={onStartReached}
      onStartReachedThreshold={0.1}
      keyboardDismissMode='interactive'
      keyboardShouldPersistTaps='handled'
      {...listProps}
      contentContainerStyle={contentContainerStyle}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onContentSizeChange={handleContentSizeChange}
      onItemSizeChanged={handleItemSizeChanged}
      onMetricsChange={handleMetricsChange}
      onViewableItemsChanged={undefined}
      viewabilityConfig={undefined}
      viewabilityConfigCallbackPairs={viewabilityPairs}
      onLayout={onLayoutList}
    />
  ), [forwardRef, keyExtractor, orderedData, renderItem, alignItemsAtEnd, isLayoutAnimated, initialScroll, maintainScrollAtEnd, sharedValues, renderChatEmpty, ListHeaderComponent, ListFooterComponent, onStartReached, listProps, contentContainerStyle, handleScrollBeginDrag, handleScrollEndDrag, handleMomentumScrollBegin, handleMomentumScrollEnd, handleContentSizeChange, handleItemSizeChanged, handleMetricsChange, viewabilityPairs, onLayoutList])

  const list = (
    <View
      style={[styles.contentContainerStyle, themedStyles.root, stylesCommon.fill]}
      onTouchStart={onListTouchStart}
      onTouchEnd={onListTouchEnd}
    >
      {listEngine}
      <ScrollToBottomButton
        isEnabled={isScrollToBottomEnabled}
        isVisible={isScrollToBottomVisible}
        opacity={scrollToBottomOpacity}
        unreadCount={unreadCount}
        onPress={handleScrollToBottomPress}
        style={scrollToBottomStyle}
        contentStyle={scrollToBottomContentStyle}
        scrollToBottomComponent={scrollToBottomComponentProp}
      />
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
          <RowTargetsContext.Provider value={rowTargets}>
            {animatedList}
          </RowTargetsContext.Provider>
        </MessageRowConfigContext.Provider>
      </MessageRowStoreContext.Provider>
    </BubbleGradientContext.Provider>
  )
}
