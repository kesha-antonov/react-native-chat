import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  EasingFunction,
  EasingFunctionFactory,
  ReduceMotion,
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useIsRTL } from '../hooks/useIsRTL'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { MessageMenuItem } from '../Models'
import { ChatTheme } from '../Theme'
import { selectionHaptic } from './haptics'
import { Icon } from './Icon'
import { useWindowInsets } from './windowInsets'

/*
 * Telegram Android's long-press menu (DrKLO/Telegram 13.1.1): `ActionBarPopupWindow` with
 * `ActionBarMenuSubItem` rows, the `ReactionsContainerLayout` bar above them, both in a
 * `ChatScrimPopupContainerLayout`, over a black 0.2 scrim. Paths: CA = ui/ChatActivity.java,
 * APW = ui/ActionBar/ActionBarPopupWindow.java, AMSI = ui/ActionBar/ActionBarMenuSubItem.java,
 * RCL = ui/Components/ReactionsContainerLayout.java, CERW = ui/Components/Reactions/
 * CustomEmojiReactionsWindow.java, REO = ui/Components/Reactions/ReactionsEffectOverlay.java.
 */

const REDUCE_MOTION = ReduceMotion.System
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
const DEFAULT_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1)
const DECELERATE = Easing.out(Easing.quad)
const timing = (duration: number, easing: EasingFunction | EasingFunctionFactory = Easing.linear) =>
  ({ duration, easing, reduceMotion: REDUCE_MOTION })

// `OvershootInterpolator(tension)`.
const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const s = t - 1
  return s * s * ((tension + 1) * s + tension) + 1
}

// The scrim: black at 0.2 (`theme.contextMenu.scrim`), in and out over 320ms on
// EASE_OUT_QUINT, with the pressed message redrawn above it in place (`CA:10749-10898`).
const SCRIM_MS = 320

// The menu card (APW, AMSI): rows 48 tall, 18 side padding, a 24 icon with the title 43 after
// it, 16sp text, 12 corners, at least 200 wide (`CA:31357`).
const ROW_HEIGHT = 48
const ROW_PADDING = 18
const ICON_SIZE = 24
const TITLE_GAP = 43
const MENU_RADIUS = 12
const MENU_MIN_WIDTH = 200
// It unrolls from the top over 150 + 16 x rows ms, each row fading in and dropping 6 into place
// over 180ms as the card passes it (`APW:325-397, 916-966`); it leaves by shrinking to 0.8 and
// fading over 220ms (`CA` sets `setDismissAnimationDuration(220)`).
const ROW_IN_MS = 180
const ROW_SHIFT = 6
const CLOSE_MS = 220
/** The bar and card glide after a message the list moved under them (the keyboard leaving). */
const FOLLOW_MS = 250
const CLOSE_SCALE = 0.8

// Placement (`CA:32667-32701`): the popup's right edge 28 left of the finger (20 with the card's
// shadow inset), 6 from the screen sides; its top at the finger, at least 24 below the top and
// clear of the bottom by its height + 48 + 8, and moved up past 240 tall.
const FINGER_GAP = 20
const SIDE_INSET = 6
const TOP_INSET = 24
const BOTTOM_CLEARANCE = 48 + 8
const TALL_POPUP = 240
/** Space kept between the lit message and a card moved off it. */
const MESSAGE_GAP = 8

// The reactions bar (RCL; `CA:32424-32460`): 50 above it in the popup, 4 + 48 + 22 for its
// padding, the pill and the tail; the menu starts 20 into that bottom padding. The pill is 48
// tall with 24 corners, holding 36-wide cells with an 8 inset at each end, at most 7 emojis
// before the expand button. Its "thought bubble" tail: an 8 circle on the pill's bottom edge 32
// in from its end, and a 4 one below it.
const BAR_OFFSET = 50
const BAR_PAD_TOP = 4
const BAR_HEIGHT = 48
const BAR_PAD_BOTTOM = 22
const BAR_TO_MENU = BAR_PAD_TOP + BAR_HEIGHT + BAR_PAD_BOTTOM - 20
const BAR_CELL = 36
const BAR_INSET = 8
const BAR_EMOJI = 26
const BAR_EMOJI_BOX = 34
const MAX_QUICK_REACTIONS = 7
const TAIL_BIG = 8
const TAIL_SMALL = 4
const TAIL_OFFSET = 32
// Appears over 250ms on Overshoot(0.5), growing from 87.5% across and clipped from the far side
// down to a quarter (`RCL:1490-1501, 690-706`); each emoji pops in over 150ms, later the farther
// it is from 80% across (`RCL:773-821`). A reaction you already chose sits at 0.76 in a circle.
const BAR_IN = { duration: 250, easing: overshoot(0.5), reduceMotion: REDUCE_MOTION }
const BAR_CLIP = 0.25
const BAR_PIVOT = 0.875
const ITEM_IN_MS = 150
const ITEM_DELAY_SPREAD = 200
const SELECTED_SCALE = 0.76
// The expand button grows the bar into the full picker over 350ms (`CERW:493-501`), its corners
// going from the bar's 24 to 12.
const EXPAND = { duration: 350, easing: DEFAULT_CURVE, reduceMotion: REDUCE_MOTION }
const PANEL_RADIUS = 12
const PANEL_MAX_HEIGHT = 340
const PANEL_COLUMNS = 8

// A picked reaction grows where it is, then flies to the message's reaction pill over 220ms,
// EASE_OUT_QUINT across and DEFAULT down, shrinking to the pill's size (`REO:254-471`).
const FLIGHT_GROW_MS = 150
const FLIGHT_GROW_SCALE = 1.6
const FLIGHT_MS = 220
const PILL_EMOJI = 16
// Where a new pill's emoji lands: the first pill, inside the bubble at its bottom-left (the
// bubble's 9 inset + the pill's 8 padding + half its 20 emoji; 7 + half of 26 up).
const PILL_X = 9 + 8 + 10
const PILL_Y = 7 + 13

export interface ContextMenuReactions {
  emojis: string[]
  onSelect: (emoji: string) => void
  /** Reactions the current user has already picked; Telegram draws them smaller, in a circle. */
  selected?: string[]
  /** Style for the reactions bar. */
  containerStyle?: StyleProp<ViewStyle>
  /** Style for each emoji in the bar. */
  emojiStyle?: StyleProp<TextStyle>
  /** Extra content at the end of the bar. */
  renderAccessory?: () => React.ReactNode
  /**
   * Telegram's expand button: when set, the bar ends in a chevron that grows the bar into a
   * panel holding what this returns (a full emoji grid, say). Call `onSelect` with the pick.
   */
  renderExpandedPicker?: (props: { onSelect: (emoji: string) => void }) => React.ReactNode
}

export interface ContextMenuProps {
  visible: boolean
  items: MessageMenuItem[]
  /**
   * Called once the menu has closed itself (backdrop tap, a picked action or reaction) and its
   * exit animation has finished.
   */
  onDismiss: () => void
  position?: 'left' | 'right'
  pageX?: number
  pageY?: number
  bubbleWidth?: number
  bubbleHeight?: number
  /**
   * Where the finger was, in window coordinates. Telegram opens the menu beside it; without it
   * the menu opens beside the bubble's middle.
   */
  touchX?: number
  touchY?: number
  /** Optional reactions bar rendered above the menu. */
  reactions?: ContextMenuReactions
  /**
   * A copy of the pressed message, drawn above the scrim exactly where the message is (`pageX` /
   * `pageY`, `bubbleWidth` wide), so it stays lit while the chat dims - Telegram's scrim view.
   * It follows the anchor if the message moves underneath.
   */
  messagePreview?: React.ReactNode
  /** Drawn above everything else in the overlay, e.g. a full emoji sheet. */
  children?: React.ReactNode
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))

type Styles = ReturnType<typeof createStyles>

const MenuRow = ({
  item,
  index,
  revealMs,
  rowCount,
  hasIcons,
  onPress,
  styles,
  theme,
}: {
  item: MessageMenuItem
  index: number
  revealMs: number
  rowCount: number
  hasIcons: boolean
  onPress: (onPress: () => void) => void
  styles: Styles
  theme: ChatTheme
}) => {
  // Each row comes in as the unrolling card reaches it.
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.value = withDelay(revealMs * index / Math.max(1, rowCount), withTiming(1, timing(ROW_IN_MS, DECELERATE)), REDUCE_MOTION)
  }, [appear, revealMs, index, rowCount])
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: -ROW_SHIFT * (1 - appear.value) }],
  }))
  const color = item.destructive ? theme.contextMenu.destructive : theme.contextMenu.icon
  const textColor = item.destructive ? theme.contextMenu.destructive : theme.contextMenu.text

  return (
    <Animated.View style={appearStyle}>
      <Pressable
        onPress={() => onPress(item.onPress)}
        accessibilityRole='button'
        accessibilityLabel={item.label}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {item.icon && (
          <View style={styles.iconSlot} pointerEvents='none'>
            {item.icon({ color, size: ICON_SIZE })}
          </View>
        )}
        <Text
          style={[styles.rowLabel, hasIcons && styles.rowLabelWithIcon, { color: textColor }]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const ReactionButton = ({
  emoji,
  index,
  delay,
  isSelected,
  isHidden,
  onPress,
  emojiStyle,
  styles,
}: {
  emoji: string
  index: number
  delay: number
  isSelected: boolean
  /** Flying to the message, so its spot in the bar is left empty. */
  isHidden: boolean
  onPress: (emoji: string, index: number) => void
  emojiStyle?: StyleProp<TextStyle>
  styles: Styles
}) => {
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.value = withDelay(delay, withTiming(1, timing(ITEM_IN_MS, EASE_OUT_QUINT)), REDUCE_MOTION)
  }, [appear, delay])
  const appearStyle = useAnimatedStyle(() => ({
    transform: [{ scale: appear.value }],
  }))

  return (
    <Pressable
      onPress={() => onPress(emoji, index)}
      accessibilityRole='button'
      accessibilityLabel={emoji}
      accessibilityState={{ selected: isSelected }}
      style={styles.reactionCell}
    >
      <Animated.View style={[styles.reactionBox, isSelected && styles.reactionBoxSelected, isHidden && styles.hidden, appearStyle]}>
        <Text style={[styles.reactionEmoji, isSelected && styles.reactionEmojiSelected, emojiStyle]} allowFontScaling={false}>
          {emoji}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

interface Flight {
  emoji: string
  fromX: number
  fromY: number
}

interface FlightTarget {
  toX: number
  toY: number
}

/** The picked reaction growing in the bar, then flying into the message's reaction pill. */
const ReactionFlight = ({
  flight,
  target,
  onEnd,
  emojiStyle,
  styles,
}: {
  flight: Flight
  /** Live: it follows the message if the list moves it mid-flight. */
  target: FlightTarget
  onEnd: () => void
  emojiStyle?: StyleProp<TextStyle>
  styles: Styles
}) => {
  const grow = useSharedValue(0)
  const flyX = useSharedValue(0)
  const flyY = useSharedValue(0)
  useEffect(() => {
    grow.value = withTiming(1, timing(FLIGHT_GROW_MS, DECELERATE))
    flyX.value = withDelay(FLIGHT_GROW_MS, withTiming(1, timing(FLIGHT_MS, EASE_OUT_QUINT)), REDUCE_MOTION)
    flyY.value = withDelay(FLIGHT_GROW_MS, withTiming(1, timing(FLIGHT_MS, DEFAULT_CURVE), finished => {
      if (finished)
        runOnJS(onEnd)()
    }), REDUCE_MOTION)
  }, [grow, flyX, flyY, onEnd])

  const dx = target.toX - flight.fromX
  const dy = target.toY - flight.fromY
  const flightStyle = useAnimatedStyle(() => {
    const grown = 1 + (FLIGHT_GROW_SCALE - 1) * grow.value
    const landed = PILL_EMOJI / BAR_EMOJI
    return {
      transform: [
        { translateX: dx * flyX.value },
        { translateY: dy * flyY.value },
        { scale: grown + (landed - grown) * flyY.value },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents='none'
      style={[
        styles.flight,
        { left: flight.fromX - BAR_EMOJI_BOX / 2, top: flight.fromY - BAR_EMOJI_BOX / 2 },
        flightStyle,
      ]}
    >
      <Text style={[styles.reactionEmoji, emojiStyle]} allowFontScaling={false}>{flight.emoji}</Text>
    </Animated.View>
  )
}

/** A drawn chevron for when react-native-svg (and so the built-in icon) is missing. */
const ChevronFallback = ({ color }: { color: string }) => (
  <View style={[chevronStyles.chevron, { borderColor: color }]} />
)

const chevronStyles = StyleSheet.create({
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    marginTop: -4,
    transform: [{ rotate: '45deg' }],
  },
})

const useCloseStyle = (closing: SharedValue<number>) => useAnimatedStyle(() => ({
  opacity: 1 - closing.value,
  transform: [{ scale: 1 - (1 - CLOSE_SCALE) * closing.value }],
}))

/**
 * Telegram Android's long-press menu. The chat dims under a black scrim while the pressed
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

  const scrim = useSharedValue(0)
  const reveal = useSharedValue(0)
  const barIn = useSharedValue(0)
  const closing = useSharedValue(0)
  const expand = useSharedValue(0)
  const menuFade = useSharedValue(1)

  // Placement is worked out once, when the overlay opens. Presenting the Modal can still move
  // the list underneath (it dismisses the keyboard); the lit copy follows the message, and the
  // bar and card follow the copy by the same distance (see `followY`), so they never end up
  // over a message they are not for.
  const anchor = {
    pageX,
    pageY,
    bubbleWidth,
    bubbleHeight,
    touchX: touchX ?? pageX + bubbleWidth / 2,
    touchY: touchY ?? pageY + bubbleHeight / 2,
  }
  const openAnchorRef = useRef<typeof anchor | null>(null)
  const openAnchor = openAnchorRef.current ?? anchor

  // While a picked reaction is flying, the overlay stays up until it has landed.
  const isFlyingRef = useRef(false)
  const pendingRef = useRef(0)
  const exitDoneRef = useRef<(() => void) | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const settle = useCallback(() => {
    pendingRef.current -= 1
    if (pendingRef.current > 0)
      return

    const done = exitDoneRef.current
    exitDoneRef.current = null
    done?.()
  }, [])

  const onFlightEnd = useCallback(() => {
    selectionHaptic()
    settle()
  }, [settle])

  const rowCount = items.length
  const revealMs = 150 + 16 * rowCount

  const animateIn = useCallback(() => {
    // The same overlay opens again for the next long-press, so every open starts from rest;
    // a panel left expanded would reopen empty.
    expand.value = 0
    closing.value = 0
    menuFade.value = 1
    barIn.value = 0
    reveal.value = 0
    scrim.value = withTiming(1, timing(SCRIM_MS, EASE_OUT_QUINT))
    reveal.value = withTiming(1, timing(revealMs))
    barIn.value = withTiming(1, BAR_IN)
  }, [scrim, reveal, barIn, closing, expand, menuFade, revealMs])

  const animateOut = useCallback((onDone: () => void) => {
    exitDoneRef.current = onDone
    // The flight (if any) and the scrim both have to finish.
    pendingRef.current = isFlyingRef.current ? 2 : 1

    closing.value = withTiming(1, timing(CLOSE_MS, DECELERATE))
    scrim.value = withTiming(0, timing(SCRIM_MS, EASE_OUT_QUINT), finished => {
      if (finished)
        runOnJS(settle)()
    })
  }, [scrim, closing, settle])

  const { isMounted, close } = useAnimatedPresence(visible, animateIn, animateOut)

  if (!isMounted) {
    openAnchorRef.current = null
    isFlyingRef.current = false
    if (flight)
      setFlight(null)
    if (isExpanded)
      setIsExpanded(false)
  } else if (!openAnchorRef.current) {
    openAnchorRef.current = anchor
  }

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
  const selected = reactions?.selected

  // The bar is sized from its cells; an accessory can widen it, so correct once it has drawn.
  const [accessoryWidth, setAccessoryWidth] = useState(0)
  const onAccessoryLayout = useCallback((event: LayoutChangeEvent) => {
    setAccessoryWidth(event.nativeEvent.layout.width)
  }, [])
  const barSlots = quickEmojis.length + (hasExpand ? 1 : 0)
  const barWidth = Math.min(BAR_INSET * 2 + barSlots * BAR_CELL + accessoryWidth, screenWidth - SIDE_INSET * 2)

  // The card sizes to its longest label, at least 200 wide.
  const [menuWidth, setMenuWidth] = useState(MENU_MIN_WIDTH)
  const onMenuLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setMenuWidth(previous => (Math.abs(previous - width) < 0.5 ? previous : width))
  }, [])
  const hasMenu = rowCount > 0
  const menuHeight = rowCount * ROW_HEIGHT

  const containerWidth = Math.max(hasReactions ? barWidth : 0, hasMenu ? menuWidth : 0)
  const barBlockHeight = BAR_OFFSET + BAR_PAD_TOP + BAR_HEIGHT + BAR_PAD_BOTTOM
  const containerHeight = hasReactions
    ? (hasMenu ? BAR_OFFSET + BAR_TO_MENU + menuHeight : barBlockHeight)
    : menuHeight

  // Beside the finger, on the side away from the reading direction.
  const containerLeft = isRTL
    ? clamp(openAnchor.touchX + FINGER_GAP, SIDE_INSET, screenWidth - SIDE_INSET - containerWidth)
    : clamp(openAnchor.touchX - FINGER_GAP - containerWidth, SIDE_INSET, screenWidth - SIDE_INSET - containerWidth)

  const minY = insets.top + TOP_INSET
  const maxY = screenHeight - insets.bottom - containerHeight - BOTTOM_CLEARANCE

  // Telegram anchors the popup at the finger, which near the bottom of the list (or beside a
  // short bubble at the right edge) clamps it straight over the message it is for. When the
  // card (or its reactions pill) would cover the lit message's text and it fits fully below or
  // above that message, it moves there instead, keeping Telegram's horizontal placement.
  const placeTop = (touchAt: number, messageTop: number, messageHeight: number) => {
    let top = touchAt
    if (containerHeight > TALL_POPUP)
      top += TALL_POPUP - containerHeight
    top = clamp(top, minY, maxY)

    const messageBottom = messageTop + messageHeight
    const cardTop = hasReactions ? top + BAR_OFFSET : top
    const cardBottom = top + containerHeight
    const coversBubble = messageHeight > 0 &&
      cardTop < messageBottom && cardBottom > messageTop &&
      containerLeft < openAnchor.pageX + openAnchor.bubbleWidth && containerLeft + containerWidth > openAnchor.pageX
    if (coversBubble) {
      // Below: the reactions bar's tail reaches up to the bubble, as it does from the finger.
      const below = messageBottom + MESSAGE_GAP - (hasReactions ? BAR_OFFSET : 0)
      // Above: the card ends just over the bubble.
      const above = messageTop - MESSAGE_GAP - containerHeight
      if (below >= minY && below <= maxY)
        top = below
      else if (above >= minY && above <= maxY)
        top = above
    }
    return top
  }
  const containerTop = placeTop(openAnchor.touchY, openAnchor.pageY, openAnchor.bubbleHeight)

  // How far the message has moved since the overlay opened, kept on screen.
  const movedBy = pageY - openAnchor.pageY
  const followDy = movedBy === 0 ? 0 : placeTop(openAnchor.touchY + movedBy, pageY, bubbleHeight) - containerTop
  const followY = useSharedValue(0)
  useEffect(() => {
    followY.value = withTiming(followDy, timing(FOLLOW_MS, DECELERATE))
  }, [followDy, followY])
  const followStyle = useAnimatedStyle(() => ({ transform: [{ translateY: followY.value }] }))

  // The bar keeps to the container's far side, the card to its near side.
  const barLeft = isRTL ? containerLeft : containerLeft + containerWidth - barWidth
  const pillTop = containerTop + BAR_OFFSET + BAR_PAD_TOP
  const menuLeft = isRTL ? containerLeft + containerWidth - menuWidth : containerLeft
  const menuTop = hasReactions ? containerTop + BAR_OFFSET + BAR_TO_MENU : containerTop

  // The expanded panel keeps the bar's top and far side, moving up if it would not fit.
  const panelWidth = Math.min(Math.max(barWidth, PANEL_COLUMNS * 40 + BAR_INSET * 2), screenWidth - SIDE_INSET * 2)
  const panelHeight = Math.min(PANEL_MAX_HEIGHT, screenHeight - insets.top - insets.bottom - TOP_INSET * 2)
  const panelLeft = clamp(isRTL ? barLeft : barLeft + barWidth - panelWidth, SIDE_INSET, screenWidth - SIDE_INSET - panelWidth)
  const panelTop = clamp(pillTop, minY, screenHeight - insets.bottom - panelHeight - TOP_INSET)

  // As in Telegram, the reaction is applied first and the emoji flies to its pill under the
  // message at its live position: a first reaction grows the bubble, so the target follows it.
  const flightTarget: FlightTarget = {
    toX: isRTL ? pageX + bubbleWidth - PILL_X : pageX + PILL_X,
    toY: pageY + bubbleHeight - PILL_Y,
  }

  const cellCenter = (index: number) => isRTL
    ? barLeft + barWidth - BAR_INSET - index * BAR_CELL - BAR_CELL / 2
    : barLeft + BAR_INSET + index * BAR_CELL + BAR_CELL / 2

  const handleReaction = useCallback((emoji: string, index: number) => {
    if (isFlyingRef.current)
      return

    isFlyingRef.current = true
    setFlight({ emoji, fromX: cellCenter(index), fromY: pillTop + BAR_HEIGHT / 2 })
    reactions?.onSelect(emoji)
    close(onDismiss)
    // cellCenter reads only the values listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, reactions, onDismiss, barLeft, barWidth, pillTop, isRTL])

  // A pick from the expanded panel has no bar slot to fly from, so the overlay simply closes.
  const handleExpandedSelect = useCallback((emoji: string) => {
    const onSelect = reactions?.onSelect
    close(() => {
      onSelect?.(emoji)
      onDismiss()
    })
  }, [close, reactions?.onSelect, onDismiss])

  const handleExpand = useCallback(() => {
    selectionHaptic()
    setIsExpanded(true)
    expand.value = withTiming(1, EXPAND)
    // The actions make way for the panel.
    menuFade.value = withTiming(0, timing(150))
  }, [expand, menuFade])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))
  const closeStyle = useCloseStyle(closing)
  const menuBackgroundStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.0001, reveal.value) }],
    opacity: Math.min(1, reveal.value * 2),
  }))
  const menuFadeStyle = useAnimatedStyle(() => ({ opacity: menuFade.value }))

  // The bar grows from 87.5% across (12.5% in RTL) and is clipped from the far side.
  const barStyle = useAnimatedStyle(() => {
    const t = expand.value
    return {
      left: barLeft + (panelLeft - barLeft) * t,
      top: pillTop + (panelTop - pillTop) * t,
      width: barWidth + (panelWidth - barWidth) * t,
      height: BAR_HEIGHT + (panelHeight - BAR_HEIGHT) * t,
      transform: [{ scale: barIn.value }],
    }
  })
  const barClipStyle = useAnimatedStyle(() => {
    const visible = Math.min(1, Math.max(BAR_CLIP, barIn.value))
    return { width: `${100 * (visible + (1 - visible) * expand.value)}%` }
  })
  const barBackgroundStyle = useAnimatedStyle(() => ({
    borderRadius: BAR_HEIGHT / 2 + (PANEL_RADIUS - BAR_HEIGHT / 2) * expand.value,
  }))
  const barItemsStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, expand.value * 2) }))
  const tailStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, barIn.value) * (1 - expand.value) }))
  const panelContentStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (expand.value - 0.25) / 0.75),
  }))

  if (!isMounted)
    return null

  const hasIcons = items.some(item => !!item.icon)
  const barOrigin = `${100 * (isRTL ? 1 - BAR_PIVOT : BAR_PIVOT)}% 50%`
  const tailX = isRTL ? barLeft + TAIL_OFFSET : barLeft + barWidth - TAIL_OFFSET
  const smallTailX = isRTL ? tailX - TAIL_BIG : tailX + TAIL_BIG

  return (
    <Modal transparent visible animationType='none' onRequestClose={handleDismiss} statusBarTranslucent>
      {/* The lit copy can carry gesture-driven content (a waveform's scrubber); a Modal is its
          own native root, so it needs its own. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents='none' />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} accessibilityLabel='dismiss' />

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
              <Animated.View
                style={[styles.menu, { top: menuTop, left: menuLeft }, menuFadeStyle]}
                pointerEvents={isExpanded ? 'none' : 'box-none'}
              >
                <Animated.View style={[styles.menuBackground, { transformOrigin: 'center top' }, menuBackgroundStyle]} />
                <View style={styles.menuClip} onLayout={onMenuLayout}>
                  {items.map((item, index) => (
                    <MenuRow
                      key={`${item.key ?? item.label}-${index}`}
                      item={item}
                      index={index}
                      revealMs={revealMs}
                      rowCount={rowCount}
                      hasIcons={hasIcons}
                      onPress={handlePress}
                      styles={styles}
                      theme={theme}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {hasReactions && (
              <>
                <Animated.View style={[styles.tail, tailStyle]} pointerEvents='none'>
                  <View style={[styles.tailBig, { left: tailX - TAIL_BIG, top: pillTop + BAR_HEIGHT - TAIL_BIG }]} />
                  <View style={[styles.tailSmall, { left: smallTailX - TAIL_SMALL, top: pillTop + BAR_HEIGHT + 15 - TAIL_SMALL }]} />
                </Animated.View>
                <Animated.View style={[styles.bar, { transformOrigin: barOrigin }, barStyle]}>
                  <Animated.View style={[styles.barClip, isRTL ? styles.alignStart : styles.alignEnd, barClipStyle]}>
                    <Animated.View style={[styles.barBackground, reactions?.containerStyle, barBackgroundStyle]} />
                    <Animated.View
                      style={[styles.barItems, isRTL ? styles.barItemsRTL : styles.barItemsLTR, { width: barWidth }, barItemsStyle]}
                      pointerEvents={isExpanded ? 'none' : 'box-none'}
                    >
                      {quickEmojis.map((emoji, index) => {
                        const center = cellCenter(index) - barLeft
                        return (
                          <ReactionButton
                            key={emoji}
                            emoji={emoji}
                            index={index}
                            delay={ITEM_DELAY_SPREAD * Math.abs(center / Math.max(1, barWidth) - (isRTL ? 0.2 : 0.8)) + 30 * index}
                            isSelected={!!selected?.includes(emoji)}
                            isHidden={flight?.emoji === emoji}
                            onPress={handleReaction}
                            emojiStyle={reactions?.emojiStyle}
                            styles={styles}
                          />
                        )
                      })}
                      {reactions?.renderAccessory && (
                        <View onLayout={onAccessoryLayout}>{reactions.renderAccessory()}</View>
                      )}
                      {hasExpand && (
                        <Pressable
                          onPress={handleExpand}
                          accessibilityRole='button'
                          accessibilityLabel='more reactions'
                          hitSlop={4}
                          style={styles.reactionCell}
                        >
                          <Icon
                            name='chevronDown'
                            color={theme.contextMenu.icon}
                            size={22}
                            fallback={<ChevronFallback color={theme.contextMenu.icon} />}
                          />
                        </Pressable>
                      )}
                    </Animated.View>
                    {/* Mounted from the start: a view that attaches to an animated style after its
                      animation has finished keeps the style's first value, here invisible. */}
                    {hasExpand && (
                      <Animated.View style={[styles.panelContent, panelContentStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
                        {/* Laid out once at the panel's final size and revealed by the growing,
                          clipped panel - Telegram's mask. Filling the panel instead resized the
                          content on every frame of the expand, so a grid re-laid out its cells
                          each frame. */}
                        <View style={[styles.panelContentInner, isRTL ? styles.panelInnerStart : styles.panelInnerEnd, { width: panelWidth, height: panelHeight }]}>
                          {isExpanded && reactions?.renderExpandedPicker?.({ onSelect: handleExpandedSelect })}
                        </View>
                      </Animated.View>
                    )}
                  </Animated.View>
                </Animated.View>
              </>
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

const createStyles = (theme: ChatTheme) => {
  const colors = theme.contextMenu
  // The 9-patch's soft shadow, and the glass variant's (`BlurredBackgroundProviderImpl:97-110`).
  const shadow: ViewStyle = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  }
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scrim: {
      backgroundColor: colors.scrim,
    },
    preview: {
      position: 'absolute',
    },
    hidden: {
      opacity: 0,
    },
    menu: {
      position: 'absolute',
      minWidth: MENU_MIN_WIDTH,
    },
    menuBackground: {
      ...StyleSheet.absoluteFill,
      borderRadius: MENU_RADIUS,
      backgroundColor: colors.background,
      ...shadow,
    },
    menuClip: {
      borderRadius: MENU_RADIUS,
      overflow: 'hidden',
    },
    row: {
      height: ROW_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: ROW_PADDING,
    },
    rowPressed: {
      backgroundColor: colors.pressed,
    },
    iconSlot: {
      position: 'absolute',
      left: ROW_PADDING,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text,
    },
    rowLabelWithIcon: {
      paddingLeft: TITLE_GAP,
    },
    tail: {
      ...StyleSheet.absoluteFill,
    },
    tailBig: {
      position: 'absolute',
      width: TAIL_BIG * 2,
      height: TAIL_BIG * 2,
      borderRadius: TAIL_BIG,
      backgroundColor: colors.background,
      ...shadow,
    },
    tailSmall: {
      position: 'absolute',
      width: TAIL_SMALL * 2,
      height: TAIL_SMALL * 2,
      borderRadius: TAIL_SMALL,
      backgroundColor: colors.background,
      ...shadow,
    },
    bar: {
      position: 'absolute',
    },
    barClip: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    alignEnd: {
      right: 0,
    },
    alignStart: {
      left: 0,
    },
    barBackground: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.background,
      ...shadow,
    },
    barItems: {
      position: 'absolute',
      top: 0,
      height: BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: BAR_INSET,
    },
    barItemsLTR: {
      right: 0,
    },
    barItemsRTL: {
      left: 0,
      flexDirection: 'row-reverse',
    },
    reactionCell: {
      width: BAR_CELL,
      height: BAR_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionBox: {
      width: BAR_EMOJI_BOX,
      height: BAR_EMOJI_BOX,
      borderRadius: BAR_EMOJI_BOX / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionBoxSelected: {
      backgroundColor: colors.reactionSelected,
    },
    reactionEmoji: {
      fontSize: BAR_EMOJI,
      lineHeight: BAR_EMOJI_BOX,
      textAlign: 'center',
      color: '#000',
    },
    reactionEmojiSelected: {
      transform: [{ scale: SELECTED_SCALE }],
    },
    panelContent: {
      ...StyleSheet.absoluteFill,
      borderRadius: PANEL_RADIUS,
      overflow: 'hidden',
    },
    panelContentInner: {
      position: 'absolute',
      top: 0,
    },
    panelInnerEnd: {
      right: 0,
    },
    panelInnerStart: {
      left: 0,
    },
    flight: {
      position: 'absolute',
      width: BAR_EMOJI_BOX,
      height: BAR_EMOJI_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
