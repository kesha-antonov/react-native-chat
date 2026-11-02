import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useIsRTL } from '../../hooks/useIsRTL'
import { useTheme, useThemedStyles } from '../../hooks/useTheme'
import { useWindowInsets } from '../windowInsets'
import {
  BAR_HEIGHT,
  CLOSE_SCALE,
  DECELERATE,
  FOLLOW_MS,
  MAX_QUICK_REACTIONS,
  MENU_MIN_WIDTH,
  timing,
} from './constants'
import { MenuCard } from './MenuCard'
import { MenuAnchor, cellCenter, getBarWidth, placeMenu } from './placement'
import { ReactionFlight } from './ReactionFlight'
import { ReactionsBar } from './ReactionsBar'
import { createStyles } from './styles'
import { ContextMenuProps, Flight } from './types'
import { useExpandPanel } from './useExpandPanel'
import { useMenuPresence } from './useMenuPresence'

export type { ContextMenuProps, ContextMenuReactions } from './types'

/*
 * The long-press menu: a popup card of action rows with the reactions bar above it, over a
 * black 0.2 scrim.
 */

const useCloseStyle = (closing: SharedValue<number>) => useAnimatedStyle(() => ({
  opacity: 1 - closing.value,
  transform: [{ scale: 1 - (1 - CLOSE_SCALE) * closing.value }],
}))

/**
 * The long-press menu. The chat dims under a black scrim while the pressed
 * message stays lit in place; the reactions bar pops out above the actions, which unroll from
 * the top beside the finger. A picked reaction grows and flies into the message's reaction
 * pill; the expand button grows the bar into a full emoji panel. Every way out plays the exit
 * before calling back. All motion runs on Reanimated and honours Reduce Motion.
 */
export const ContextMenu = ({
  visible,
  items,
  onDismiss,
  pageX = 0,
  pageY = 0,
  bubbleWidth = 0,
  bubbleHeight = 0,
  touchX,
  touchY,
  reactions,
  messagePreview,
  children,
}: ContextMenuProps) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const isRTL = useIsRTL()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useWindowInsets()

  const rowCount = items.length
  const revealMs = 150 + 16 * rowCount

  // While a picked reaction is flying, the overlay stays up until it has landed.
  const isFlyingRef = useRef(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const isFlying = useCallback(() => isFlyingRef.current, [])
  const {
    scrim,
    reveal,
    barIn,
    closing,
    expand,
    menuFade,
    onFlightEnd,
    isMounted,
    close,
  } = useMenuPresence(visible, revealMs, isFlying)
  const [isExpanded, setIsExpanded] = useState(false)
  const { handleExpand, handleCollapse } = useExpandPanel(expand, menuFade, setIsExpanded)

  // Placement is worked out once, when the overlay opens. Presenting the Modal can still move
  // the list underneath (it dismisses the keyboard); the lit copy follows the message, and the
  // bar and card follow the copy by the same distance (see `followY`), so they never end up
  // over a message they are not for.
  const anchor: MenuAnchor = {
    pageX,
    pageY,
    bubbleWidth,
    bubbleHeight,
    touchX: touchX ?? pageX + bubbleWidth / 2,
    touchY: touchY ?? pageY + bubbleHeight / 2,
  }
  const [openedAt, setOpenedAt] = useState<MenuAnchor | null>(null)
  const openAnchor = openedAt ?? anchor

  if (!isMounted) {
    if (openedAt)
      setOpenedAt(null)
    if (flight)
      setFlight(null)
    if (isExpanded)
      setIsExpanded(false)
  } else if (!openedAt) {
    setOpenedAt(anchor)
  }
  // A flight cut short by the overlay unmounting must not hold up the next close.
  useLayoutEffect(() => {
    if (!isMounted)
      isFlyingRef.current = false
  }, [isMounted])

  const handleDismiss = useCallback(() => close(onDismiss), [close, onDismiss])

  const handlePress = useCallback((onPress: () => void) => {
    close(() => {
      onPress()
      onDismiss()
    })
  }, [close, onDismiss])

  const hasExpand = !!reactions?.renderExpandedPicker
  const quickEmojis = (reactions?.emojis ?? []).slice(0, hasExpand ? MAX_QUICK_REACTIONS : undefined)
  const hasReactions = !!reactions && (quickEmojis.length > 0 || !!reactions.renderAccessory || hasExpand)

  // The bar is sized from its cells; an accessory can widen it, so correct once it has drawn.
  const [accessoryWidth, setAccessoryWidth] = useState(0)
  const onAccessoryLayout = useCallback((event: LayoutChangeEvent) => {
    setAccessoryWidth(event.nativeEvent.layout.width)
  }, [])
  const barSlots = quickEmojis.length + (hasExpand ? 1 : 0)
  const barWidth = getBarWidth(barSlots, accessoryWidth, screenWidth)

  // The card sizes to its longest label, at least 200 wide.
  const [menuWidth, setMenuWidth] = useState(MENU_MIN_WIDTH)
  const onMenuLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setMenuWidth(previous => (Math.abs(previous - width) < 0.5 ? previous : width))
  }, [])

  const {
    hasMenu,
    containerLeft,
    containerWidth,
    containerTop,
    followDy,
    barLeft,
    pillTop,
    menuLeft,
    menuTop,
    panelWidth,
    panelHeight,
    panelLeft,
    panelTop,
    flightTarget,
  } = placeMenu({
    openAnchor,
    pageX,
    pageY,
    bubbleWidth,
    bubbleHeight,
    screenWidth,
    screenHeight,
    insets,
    isRTL,
    hasReactions,
    barWidth,
    rowCount,
    menuWidth,
  })

  const followY = useSharedValue(0)
  useEffect(() => {
    followY.set(withTiming(followDy, timing(FOLLOW_MS, DECELERATE)))
  }, [followDy, followY])
  const followStyle = useAnimatedStyle(() => ({ transform: [{ translateY: followY.value }] }))

  const handleReaction = useCallback((emoji: string, index: number) => {
    if (isFlyingRef.current)
      return

    isFlyingRef.current = true
    setFlight({ emoji, fromX: cellCenter(index, barLeft, barWidth, isRTL), fromY: pillTop + BAR_HEIGHT / 2 })
    reactions?.onSelect(emoji)
    close(onDismiss)
  }, [close, reactions, onDismiss, barLeft, barWidth, pillTop, isRTL])

  // A pick from the expanded panel has no bar slot to fly from, so the overlay simply closes.
  const handleExpandedSelect = useCallback((emoji: string) => {
    const onSelect = reactions?.onSelect
    close(() => {
      onSelect?.(emoji)
      onDismiss()
    })
  }, [close, reactions?.onSelect, onDismiss])

  const handleOutsidePress = isExpanded ? handleCollapse : handleDismiss

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))
  const closeStyle = useCloseStyle(closing)

  if (!isMounted)
    return null

  return (
    <Modal transparent visible animationType='none' onRequestClose={handleOutsidePress} statusBarTranslucent>
      {/* The lit copy can carry gesture-driven content (a waveform's scrubber); a Modal is its
          own native root, so it needs its own. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents='none' />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleOutsidePress} accessibilityLabel='dismiss' />

        {messagePreview != null && (
          <View
            style={[styles.preview, { top: pageY, left: pageX, width: bubbleWidth }]}
            pointerEvents='none'
          >
            {messagePreview}
          </View>
        )}

        <Animated.View style={[StyleSheet.absoluteFill, followStyle]} pointerEvents='box-none'>
          <Animated.View style={[StyleSheet.absoluteFill, closeStyle, { transformOrigin: `${isRTL ? containerLeft : containerLeft + containerWidth}px ${containerTop}px` }]} pointerEvents='box-none'>
            {hasMenu && (
              <MenuCard
                items={items}
                revealMs={revealMs}
                top={menuTop}
                left={menuLeft}
                isExpanded={isExpanded}
                reveal={reveal}
                menuFade={menuFade}
                onLayout={onMenuLayout}
                onPress={handlePress}
                styles={styles}
                theme={theme}
              />
            )}

            {hasReactions && (
              <ReactionsBar
                reactions={reactions}
                quickEmojis={quickEmojis}
                flyingEmoji={flight?.emoji}
                hasExpand={hasExpand}
                isExpanded={isExpanded}
                isRTL={isRTL}
                barLeft={barLeft}
                barWidth={barWidth}
                pillTop={pillTop}
                panelLeft={panelLeft}
                panelTop={panelTop}
                panelWidth={panelWidth}
                panelHeight={panelHeight}
                barIn={barIn}
                expand={expand}
                onReaction={handleReaction}
                onExpand={handleExpand}
                onExpandedSelect={handleExpandedSelect}
                onAccessoryLayout={onAccessoryLayout}
                styles={styles}
                theme={theme}
              />
            )}
          </Animated.View>
        </Animated.View>

        {flight && (
          <ReactionFlight
            flight={flight}
            target={flightTarget}
            onEnd={onFlightEnd}
            emojiStyle={reactions?.emojiStyle}
            styles={styles}
          />
        )}

        {children}
      </GestureHandlerRootView>
    </Modal>
  )
}
