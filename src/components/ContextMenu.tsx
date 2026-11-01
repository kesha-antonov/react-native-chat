import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Modal,
  Platform,
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
  Extrapolation,
  ReduceMotion,
  SharedValue,
  interpolate,
  reanimatedVersion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as SafeArea from 'react-native-safe-area-context'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useColorScheme } from '../hooks/useColorScheme'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { MessageMenuItem } from '../Models'
import { getExpoBlur } from '../optional'
import { ChatTheme } from '../Theme'
import { selectionHaptic } from './haptics'
import { Icon } from './Icon'

/*
 * Every number below comes from Telegram's iOS client (TelegramMessenger/
 * Telegram-iOS, commit 279f89e4), unless its comment says otherwise. Paths:
 *   CCI = submodules/TelegramUI/Components/ContextControllerImpl/Sources/
 *   RSN = submodules/ReactionSelectionNode/Sources/
 *   DSP = submodules/Display/Source/
 */

// Optional blur behind the menu; without it a plain dim stands in, the same
// fallback the round video recorder uses.
const BlurView = getExpoBlur()?.BlurView ?? null

const REDUCE_MOTION = ReduceMotion.System

/**
 * Telegram's springs (`layer.animateSpring`, DSP CAAnimationUtils.swift:338)
 * squeeze a CASpringAnimation's whole settle into the duration they are given,
 * keeping its damping ratio. Reanimated 4 runs a duration-based spring for 1.5x
 * its `duration` (its "perceptual" duration); Reanimated 3 for exactly it.
 */
const SPRING_DURATION_SCALE = parseInt(String(reanimatedVersion ?? '4'), 10) >= 4 ? 1 / 1.5 : 1
const telegramSpring = (settleMs: number, dampingRatio: number) => ({
  duration: settleMs * SPRING_DURATION_SCALE,
  dampingRatio,
  reduceMotion: REDUCE_MOTION,
})
// CA's easeInEaseOut, Telegram's default for plain alpha / scale / position.
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
const timing = (duration: number, easing = EASE_IN_OUT) => ({ duration, easing, reduceMotion: REDUCE_MOTION })

/**
 * The press-down shrink: 15pt off the bubble's width, never below 0.7
 * (DSP ContextControllerSourceNode.swift:98).
 */
export const pressedScale = (bubbleWidth: number) =>
  bubbleWidth > 0 ? Math.max(0.7, (bubbleWidth - 15) / bubbleWidth) : 1

// Backdrop: a blur with `theme.contextMenu.dimColor` over it, faded over 0.2s
// both ways (CCI ContextSourceContainer.swift:510, 531). Day 0x000a26 @ 0.2,
// night 0x000000 @ 0.6 (TelegramPresentationData DefaultDay/DarkPresentationTheme).
const DIM_COLOR = { light: 'rgba(0, 10, 38, 0.2)', dark: 'rgba(0, 0, 0, 0.6)' }
// Not Telegram's: with no blur under it, the dim alone has to separate the menu.
const DIM_COLOR_NO_BLUR = { light: 'rgba(0, 10, 38, 0.4)', dark: 'rgba(0, 0, 0, 0.7)' }
// Telegram uses the system `.light` blur with its tint layers stripped; that
// can't be reproduced through expo-blur, so this is a close look, not a port.
const BLUR_INTENSITY = 40
const BACKDROP_MS = 200

// The lifted message moves on a 0.42s spring at damping 104 (ratio ~0.78)
// (CCI ContextControllerExtractedPresentationNode.swift:1605-1625); the menu
// scales 0.01 -> 1 on the same spring and fades in over 0.05s (:1673-1683).
const LIFT_SPRING = telegramSpring(420, 0.78)
const MENU_FROM_SCALE = 0.01
const MENU_FADE_IN_MS = 50

// Reactions bar (RSN ReactionContextNode.swift, ReactionContextBackgroundNode.swift):
// fades in over 0.15s; scales 0.01 -> 1 on a 0.3s spring at damping 88 (~0.66);
// starts as a 46pt circle at the anchor and grows to full width on a 0.5s
// spring (damping 104) after 0.11s; items spring 0.01 -> 1 over 0.4s, each
// delayed 0.01s + 0.3s x its distance from the anchor / the bar's width.
const BAR_FADE_IN_MS = 150
const BAR_SCALE_SPRING = telegramSpring(300, 0.66)
const BAR_GROW_SPRING = telegramSpring(500, 0.78)
const BAR_GROW_DELAY = 110
const BAR_FROM_SCALE = 0.01
const ITEM_SPRING = telegramSpring(400, 0.66)
const ITEM_DELAY_BASE = 10
const ITEM_DELAY_SPREAD = 300

// Expanding the bar into the emoji panel: `.animated(duration: 0.4, curve:
// .spring)`, which at 0.4s is a bezier (0.38, 0.7, 0.125, 1) (RSN :3086-3138,
// DSP CAAnimationUtils.swift:119-200); the expand button scales out over 0.2s.
const EXPAND = { duration: 400, easing: Easing.bezier(0.38, 0.7, 0.125, 1), reduceMotion: REDUCE_MOTION }

// Way out: everything over 0.2s ease-in-out - 0.25s while a reaction flies
// (CCI :1796-1798, 2142-2172).
const CLOSE_MS = 200
const CLOSE_FLYING_MS = 250

// The picked reaction flies to the message's reaction slot along a parabola
// 30pt high, over 0.2s linear (RSN :2758, 2870, 4143), and a selection tick
// fires as it lands (:2871).
const FLIGHT = { duration: 200, easing: Easing.linear, reduceMotion: REDUCE_MOTION }
const FLIGHT_ARC = 30

// Bar geometry: 46pt tall, 23pt corners, 36pt items 8pt apart, 6pt side
// padding (RSN :409, :1280-1282; ReactionContextBackgroundNode.swift:215);
// the expand button is a 30pt circle 9pt from the end (:1222-1231).
const BAR_HEIGHT = 46
const BAR_ITEM = 36
const BAR_SPACING = 8
const BAR_PADDING = 6
const EXPAND_SIZE = 30
const EXPAND_INSET = 9
// The expanded emoji panel is at most 300pt tall (RSN :3124), and at most 8
// items wide (:1294).
const PANEL_HEIGHT = 300
const PANEL_WIDTH = BAR_PADDING * 2 + BAR_ITEM * 8 + BAR_SPACING * 7

// Layout (CCI ContextControllerExtractedPresentationNode.swift): the top inset
// is the status bar + 8 (:741), the bottom 10 + the home indicator (:742);
// 7pt between the message and the menu (:738); 12pt from the screen sides
// (:759, :1097). 18pt are reserved above the message for the bar (:926),
// which is drawn 7pt up within them (RSN :875-886), leaving an 11pt gap.
const TOP_INSET = 8
const BOTTOM_INSET = 10
const MENU_GAP = 7
const BAR_GAP = 18 - 7
const SIDE_INSET = 12

// Menu (CCI ContextControllerActionsStackNode.swift): 220-240pt wide
// (:2036-2048); rows are 11pt + a 17pt line + 11pt (:214, :571); 10pt above
// and below the list (:993); a 32pt icon slot at x 20 and the title at x 60,
// or 18pt in without an icon (:213-217); corners min(30, h / 2) (:1576); the
// press highlight is a pill inset 10pt, black / white at 0.1, faded over 0.2s
// (:1114-1134, :1192).
const MENU_MIN_WIDTH = 220
const MENU_MAX_WIDTH = 240
const ROW_HEIGHT = 44
const MENU_PADDING_V = 10
const ICON_X = 20
const ICON_SLOT = 32
const TITLE_X_WITH_ICON = 60
const TEXT_PADDING = 18
const ICON_SIZE = 24
const HIGHLIGHT_INSET = 10
const HIGHLIGHT_MS = 200

// Where the first reaction pill's emoji sits relative to the bubble: not
// Telegram's, but this library's MessageReactions (3pt gap, 4pt inset, 1pt
// border, 8 x 4pt padding, 20pt line), where the reaction then shows.
const PILL_EMOJI_INSET_X = 4 + 1 + 8 + 8
const PILL_EMOJI_OFFSET_Y = 3 + 1 + 4 + 10
const BAR_EMOJI_SIZE = 26
const PILL_EMOJI_SIZE = 15

// Without a provider (or before it measured) keep clear of the notch and the
// home indicator anyway.
const FALLBACK_INSETS = Platform.OS === 'ios'
  ? { top: 47, bottom: 34 }
  : { top: 24, bottom: 0 }

/**
 * The overlay covers the whole window, so it needs the window's insets. The
 * nearest provider's are often smaller: a navigator hands its screens what the
 * header and tab bar left over (a stack screen reads a bottom inset of 0), so
 * keep whichever is larger of those and the window's at launch.
 */
const useWindowInsets = () => {
  const context = useContext(SafeArea.SafeAreaInsetsContext)
  const initial = SafeArea.initialWindowMetrics?.insets
  if (!context && !initial)
    return FALLBACK_INSETS

  return {
    top: Math.max(context?.top ?? 0, initial?.top ?? 0),
    bottom: Math.max(context?.bottom ?? 0, initial?.bottom ?? 0),
  }
}

export interface ContextMenuReactions {
  emojis: string[]
  onSelect: (emoji: string) => void
  /** Style for the reactions bar. */
  containerStyle?: StyleProp<ViewStyle>
  /** Style for each emoji in the bar. */
  emojiStyle?: StyleProp<TextStyle>
  /** Extra content at the end of the bar. */
  renderAccessory?: () => React.ReactNode
  /**
   * Telegram's expand button: when set, the bar ends in a chevron that grows
   * the bar into a panel holding what this returns (a full emoji grid, say).
   * Call `onSelect` with the chosen emoji.
   */
  renderExpandedPicker?: (props: { onSelect: (emoji: string) => void }) => React.ReactNode
}

export interface ContextMenuProps {
  visible: boolean
  items: MessageMenuItem[]
  /**
   * Called once the menu has closed itself (backdrop tap, a picked action or
   * reaction) and its exit animation has finished.
   */
  onDismiss: () => void
  position?: 'left' | 'right'
  pageX?: number
  pageY?: number
  bubbleWidth?: number
  bubbleHeight?: number
  /** Optional reactions bar rendered above the message. */
  reactions?: ContextMenuReactions
  /**
   * A copy of the pressed message, drawn "lifted" above the dimmed chat at the
   * bubble's position (`pageX` / `pageY`, sized `bubbleWidth`). When it is set,
   * the message, the reactions bar and the menu shift together until all
   * three fit on screen. If the anchor changes while the menu is open (the
   * bubble moved underneath), the copy lands at the new spot on close.
   */
  messagePreview?: React.ReactNode
  /** Drawn above everything else in the overlay, e.g. a full emoji sheet. */
  children?: React.ReactNode
}

interface Layout {
  barTop: number
  barFromBelow: boolean
  menuTop: number
  menuFromBelow: boolean
  previewHeight: number
  shift: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const barWidthFor = (count: number, hasExpand: boolean) => {
  const slots = count + (hasExpand ? 1 : 0)
  return slots > 0 ? BAR_PADDING * 2 + slots * BAR_ITEM + (slots - 1) * BAR_SPACING : BAR_HEIGHT
}

/**
 * Where the bar, the message and the menu go. With a lifted preview they
 * stack as Telegram does - reactions above the message, actions below - and
 * the stack slides as a whole until it fits between the insets, pushed up from
 * the bottom first and clamped at the top (CCI :1203-1213), clipping a message
 * too tall to fit. Without one the original bubble stays where it is, so the
 * bar and the menu each flip to whichever side has room.
 */
const computeLayout = ({
  pageY,
  bubbleHeight,
  barBlock,
  menuHeight,
  minY,
  maxY,
  hasPreview,
}: {
  pageY: number
  bubbleHeight: number
  barBlock: number
  menuHeight: number
  minY: number
  maxY: number
  hasPreview: boolean
}): Layout => {
  const menuBlock = menuHeight > 0 ? menuHeight + MENU_GAP : 0

  if (hasPreview) {
    const previewHeight = Math.max(0, Math.min(bubbleHeight, maxY - minY - barBlock - menuBlock))
    const stackHeight = barBlock + previewHeight + menuBlock
    const stackTop = Math.max(minY, Math.min(pageY - barBlock, maxY - stackHeight))
    const previewTop = stackTop + barBlock

    return {
      barTop: stackTop,
      barFromBelow: true,
      previewHeight,
      menuTop: previewTop + previewHeight + MENU_GAP,
      menuFromBelow: false,
      shift: previewTop - pageY,
    }
  }

  const bubbleBottom = pageY + bubbleHeight
  const isBarAbove = pageY - barBlock >= minY
  const barTop = isBarAbove ? pageY - barBlock : bubbleBottom + BAR_GAP
  const belowTop = isBarAbove ? bubbleBottom + MENU_GAP : barTop + barBlock
  const isMenuBelow = belowTop + menuHeight <= maxY
  const aboveBottom = isBarAbove ? barTop - MENU_GAP : pageY - MENU_GAP

  return {
    barTop,
    barFromBelow: isBarAbove,
    previewHeight: bubbleHeight,
    menuTop: isMenuBelow ? belowTop : Math.max(minY, aboveBottom - menuHeight),
    menuFromBelow: !isMenuBelow,
    shift: 0,
  }
}

type Styles = ReturnType<typeof createStyles>

/** Telegram's per-item ripple: later the farther an item is from the anchor. */
const itemDelay = (centerX: number, anchorX: number, barWidth: number) =>
  ITEM_DELAY_BASE + (Math.abs(centerX - anchorX) / Math.max(barWidth, 1)) * ITEM_DELAY_SPREAD

const PopIn = ({ delay, style, children }: { delay: number, style?: StyleProp<ViewStyle>, children: React.ReactNode }) => {
  const appear = useSharedValue(0)
  useEffect(() => {
    appear.value = withDelay(delay, withSpring(1, ITEM_SPRING), REDUCE_MOTION)
  }, [appear, delay])

  const appearStyle = useAnimatedStyle(() => ({
    transform: [{ scale: BAR_FROM_SCALE + (1 - BAR_FROM_SCALE) * appear.value }],
  }))

  return <Animated.View style={[style, appearStyle]}>{children}</Animated.View>
}

const ReactionButton = ({
  emoji,
  index,
  delay,
  onPress,
  isHidden,
  emojiStyle,
  styles,
}: {
  emoji: string
  index: number
  delay: number
  onPress: (emoji: string, index: number) => void
  /** Flying to the message, so its spot in the bar is left empty. */
  isHidden: boolean
  emojiStyle?: StyleProp<TextStyle>
  styles: Styles
}) => (
  <PopIn delay={delay} style={isHidden && styles.hidden}>
    <Pressable
      onPress={() => onPress(emoji, index)}
      accessibilityRole='button'
      accessibilityLabel={emoji}
      style={({ pressed }) => [styles.reactionButton, pressed && styles.reactionButtonPressed]}
    >
      <Text style={[styles.reactionEmoji, emojiStyle]}>{emoji}</Text>
    </Pressable>
  </PopIn>
)

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

const MenuRow = ({
  item,
  hasIcons,
  highlightColor,
  onPress,
  styles,
}: {
  item: MessageMenuItem
  hasIcons: boolean
  highlightColor: string
  onPress: (onPress: () => void) => void
  styles: Styles
}) => {
  const highlight = useSharedValue(0)
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value }))
  const color = item.destructive ? styles.destructive.color : styles.rowLabel.color

  return (
    <Pressable
      onPress={() => onPress(item.onPress)}
      onPressIn={() => {
        highlight.value = withTiming(1, timing(HIGHLIGHT_MS))
      }}
      onPressOut={() => {
        highlight.value = withTiming(0, timing(HIGHLIGHT_MS))
      }}
      accessibilityRole='button'
      style={styles.row}
    >
      <Animated.View style={[styles.highlight, { backgroundColor: highlightColor }, highlightStyle]} pointerEvents='none' />
      {item.icon && (
        <View style={styles.iconSlot} pointerEvents='none'>
          {item.icon({ color: color as string, size: ICON_SIZE })}
        </View>
      )}
      <Text
        style={[styles.rowLabel, hasIcons && styles.rowLabelWithIcon, item.destructive && styles.destructive]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
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

/**
 * The picked reaction leaving the bar for the message: it follows a parabola
 * 30pt high and shrinks to the reaction pill's size as it lands on the spot
 * the pill appears in.
 */
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
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, FLIGHT, finished => {
      if (finished)
        runOnJS(onEnd)()
    })
  }, [progress, onEnd])

  const dx = target.toX - flight.fromX
  const dy = target.toY - flight.fromY
  const flightStyle = useAnimatedStyle(() => {
    const t = progress.value
    return {
      transform: [
        { translateX: dx * t },
        // A parabola peaking FLIGHT_ARC above the straight line, as
        // `generateParabollicMotionKeyframes` draws it.
        { translateY: dy * t - FLIGHT_ARC * 4 * t * (1 - t) },
        { scale: 1 + (PILL_EMOJI_SIZE / BAR_EMOJI_SIZE - 1) * t },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents='none'
      style={[
        styles.flight,
        { left: flight.fromX - BAR_ITEM / 2, top: flight.fromY - BAR_ITEM / 2 },
        flightStyle,
      ]}
    >
      <Text style={[styles.reactionEmoji, emojiStyle]}>{flight.emoji}</Text>
    </Animated.View>
  )
}

const usePopStyle = (progress: SharedValue<number>, opacity: SharedValue<number>, fromScale: number, rideY: number, lift: SharedValue<number>) =>
  useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      // Rides along with the message as it moves into place and back.
      { translateY: -rideY * (1 - lift.value) },
      { scale: fromScale + (1 - fromScale) * progress.value },
    ],
  }))

/**
 * Telegram-style long-press context menu. The chat blurs (with `expo-blur`)
 * and dims, the pressed message is drawn lifted above it, the reactions bar
 * grows out of a circle at the bubble's corner with its emojis rippling in,
 * and the actions scale out of the corner nearest the bubble. A picked
 * reaction flies to the message; every way out plays the rest in reverse
 * before calling back. All motion runs on Reanimated and honours Reduce
 * Motion; the timings are Telegram's.
 */
export const ContextMenu = ({
  visible,
  items,
  onDismiss,
  position = 'left',
  pageX = 0,
  pageY = 0,
  bubbleWidth = 0,
  bubbleHeight = 0,
  reactions,
  messagePreview,
  children,
}: ContextMenuProps) => {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
  const isDark = useColorScheme() === 'dark'
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const insets = useWindowInsets()

  const backdrop = useSharedValue(0)
  const lift = useSharedValue(0)
  const liftScale = useSharedValue(1)
  const barScale = useSharedValue(0)
  const barOpacity = useSharedValue(0)
  const barGrow = useSharedValue(0)
  const menuScale = useSharedValue(0)
  const menuOpacity = useSharedValue(0)
  const expand = useSharedValue(0)

  // The layout is fixed for as long as the overlay is up. The bubble can still
  // move underneath - presenting the Modal dismisses the keyboard, and the list
  // re-lays out - so a later anchor only changes where the copy lands on close.
  const anchor = { pageX, pageY, bubbleWidth, bubbleHeight }
  const openAnchorRef = useRef<typeof anchor | null>(null)
  const openAnchor = openAnchorRef.current ?? anchor

  // While a picked reaction is flying, the overlay stays up until it has
  // landed and the rest has closed.
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

  const animateIn = useCallback(() => {
    const startScale = pressedScale(openAnchorRef.current?.bubbleWidth ?? 0)
    // The same overlay opens again for the next long-press, so every open starts
    // from rest. Left at 1, `expand` reopened as an empty panel (its content is
    // mounted only once expanded), and the bar skipped its grow and ripple.
    expand.value = 0
    barScale.value = 0
    barGrow.value = 0
    menuScale.value = 0
    backdrop.value = withTiming(1, timing(BACKDROP_MS))
    lift.value = withSpring(1, LIFT_SPRING)
    // The copy starts at the shrunk size the press left the bubble at.
    liftScale.value = startScale
    liftScale.value = withSpring(1, LIFT_SPRING)
    barOpacity.value = withTiming(1, timing(BAR_FADE_IN_MS))
    barScale.value = withSpring(1, BAR_SCALE_SPRING)
    barGrow.value = withDelay(BAR_GROW_DELAY, withSpring(1, BAR_GROW_SPRING), REDUCE_MOTION)
    menuOpacity.value = withTiming(1, timing(MENU_FADE_IN_MS))
    menuScale.value = withSpring(1, LIFT_SPRING)
  }, [backdrop, lift, liftScale, barOpacity, barScale, barGrow, menuOpacity, menuScale, expand])

  const animateOut = useCallback((onDone: () => void) => {
    const isFlying = isFlyingRef.current
    const out = timing(isFlying ? CLOSE_FLYING_MS : CLOSE_MS)
    exitDoneRef.current = onDone
    // The flight (if any) and the backdrop both have to finish.
    pendingRef.current = isFlying ? 2 : 1

    barOpacity.value = withTiming(0, out)
    menuOpacity.value = withTiming(0, out)
    menuScale.value = withTiming(0, out)
    lift.value = withTiming(0, out)
    liftScale.value = withTiming(1, out)
    backdrop.value = withTiming(0, out, finished => {
      if (finished)
        runOnJS(settle)()
    })
  }, [backdrop, lift, liftScale, barOpacity, menuOpacity, menuScale, settle])

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

  const returnX = pageX - openAnchor.pageX
  const returnY = pageY - openAnchor.pageY

  const handleDismiss = useCallback(() => close(onDismiss), [close, onDismiss])

  const handlePress = useCallback((onPress: () => void) => {
    close(() => {
      onPress()
      onDismiss()
    })
  }, [close, onDismiss])

  const hasExpand = !!reactions?.renderExpandedPicker
  const hasReactions = !!reactions && (reactions.emojis.length > 0 || !!reactions.renderAccessory || hasExpand)

  // The bar is sized from its items; an accessory can widen it, so correct
  // from layout once it has drawn.
  const computedBarWidth = barWidthFor(reactions?.emojis.length ?? 0, hasExpand)
  const [accessoryWidth, setAccessoryWidth] = useState(0)
  const onAccessoryLayout = useCallback((event: LayoutChangeEvent) => {
    setAccessoryWidth(event.nativeEvent.layout.width)
  }, [])
  const barWidth = Math.min(computedBarWidth + accessoryWidth, screenWidth - SIDE_INSET * 2)

  // The menu sizes to its longest label between 220 and 240pt.
  const [measuredMenuWidth, setMeasuredMenuWidth] = useState(MENU_MAX_WIDTH)
  const onMenuLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredMenuWidth(event.nativeEvent.layout.width)
  }, [])
  const menuHeight = items.length > 0 ? items.length * ROW_HEIGHT + MENU_PADDING_V * 2 : 0

  const minY = insets.top + TOP_INSET
  const maxY = screenHeight - insets.bottom - BOTTOM_INSET
  const layout = computeLayout({
    pageY: openAnchor.pageY,
    bubbleHeight: openAnchor.bubbleHeight,
    barBlock: hasReactions ? BAR_HEIGHT + BAR_GAP : 0,
    menuHeight,
    minY,
    maxY,
    hasPreview: !!messagePreview,
  })

  const isRight = position === 'right'
  const side = isRight ? 'right' : 'left'
  const bubbleLeft = openAnchor.pageX
  const bubbleRight = openAnchor.pageX + openAnchor.bubbleWidth
  const barLeft = clamp(isRight ? bubbleRight - barWidth : bubbleLeft, SIDE_INSET, screenWidth - barWidth - SIDE_INSET)
  // The menu sits 6pt in from the bubble's edge, less Telegram's 4 / 1pt
  // nudges (CCI :1311-1313).
  const menuLeft = clamp(
    isRight ? bubbleRight - 7 - measuredMenuWidth : bubbleLeft + 2,
    SIDE_INSET,
    screenWidth - measuredMenuWidth - SIDE_INSET
  )

  // The bar grows out of a circle at the end nearest the bubble's edge.
  const anchorX = isRight ? barWidth - BAR_HEIGHT / 2 : BAR_HEIGHT / 2

  // The expanded panel keeps the bar's top and side, but may need to move to
  // stay on screen.
  const panelWidth = Math.min(Math.max(PANEL_WIDTH, barWidth), screenWidth - SIDE_INSET * 2)
  const panelHeight = Math.min(PANEL_HEIGHT, maxY - minY)
  const panelLeft = clamp(isRight ? barLeft + barWidth - panelWidth : barLeft, SIDE_INSET, screenWidth - panelWidth - SIDE_INSET)
  const panelTop = clamp(layout.barTop, minY, maxY - panelHeight)

  // As in Telegram, the reaction is applied first and the emoji flies to its
  // slot: under the original bubble at its live position, which the copy
  // also returns to. Adding a message's first reaction can move the bubble
  // (the row grows), so the target follows the anchor while in flight.
  const flightTarget: FlightTarget = {
    toX: isRight ? pageX + bubbleWidth - PILL_EMOJI_INSET_X : pageX + PILL_EMOJI_INSET_X,
    toY: pageY + bubbleHeight + PILL_EMOJI_OFFSET_Y,
  }

  const handleReaction = useCallback((emoji: string, index: number) => {
    if (isFlyingRef.current)
      return

    isFlyingRef.current = true
    setFlight({
      emoji,
      fromX: barLeft + BAR_PADDING + index * (BAR_ITEM + BAR_SPACING) + BAR_ITEM / 2,
      fromY: layout.barTop + BAR_HEIGHT / 2,
    })
    reactions?.onSelect(emoji)
    close(onDismiss)
  }, [close, reactions, onDismiss, barLeft, layout.barTop])

  // A pick from the expanded panel has no bar slot to fly from, so the
  // overlay simply closes.
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
    menuOpacity.value = withTiming(0, timing(CLOSE_MS))
  }, [expand, menuOpacity])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  const shift = layout.shift
  const previewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: returnX * (1 - lift.value) },
      { translateY: shift * lift.value + returnY * (1 - lift.value) },
      { scale: liftScale.value },
    ],
  }))

  const barDx = panelLeft - barLeft
  const barDy = panelTop - layout.barTop
  const barTop = layout.barTop
  // The panel moves with layout props, not a transform: Reanimated applies
  // transforms to the native view only, so Fabric would still hit-test the
  // panel's emojis at the bar's old spot.
  const barStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
    top: barTop + barDy * expand.value,
    left: barLeft + barDx * expand.value,
    width: barWidth + (panelWidth - barWidth) * expand.value,
    height: BAR_HEIGHT + (panelHeight - BAR_HEIGHT) * expand.value,
    transform: [
      { translateY: -shift * (1 - lift.value) },
      { scale: BAR_FROM_SCALE + (1 - BAR_FROM_SCALE) * barScale.value },
    ],
  }))
  // The pill itself starts as a 46pt circle and grows to the bar's width,
  // anchored at the bubble's side; once expanded it fills the panel.
  const barBackgroundStyle = useAnimatedStyle(() => ({
    width: interpolate(barGrow.value, [0, 1], [BAR_HEIGHT, barWidth], Extrapolation.CLAMP) +
      (panelWidth - barWidth) * expand.value,
  }))
  const barItemsStyle = useAnimatedStyle(() => ({
    opacity: 1 - expand.value,
  }))
  const expandButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(expand.value, [0, 0.5], [1, 0], Extrapolation.CLAMP) }],
  }))
  const panelContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.25, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const menuStyle = usePopStyle(menuScale, menuOpacity, MENU_FROM_SCALE, shift, lift)

  if (!isMounted)
    return null

  const isPreviewClipped = layout.previewHeight < openAnchor.bubbleHeight
  const dimColor = (BlurView ? DIM_COLOR : DIM_COLOR_NO_BLUR)[isDark ? 'dark' : 'light']
  const hasIcons = items.some(item => !!item.icon)
  const expandCenterX = barWidth - EXPAND_INSET - EXPAND_SIZE / 2
  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'

  return (
    <Modal transparent visible animationType='none' onRequestClose={handleDismiss} statusBarTranslucent>
      {/* The lifted copy can carry gesture-driven content (a waveform's
          scrubber); a Modal is its own native root, so it needs its own. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents='none'>
          {BlurView && (
            <BlurView style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'default'} intensity={BLUR_INTENSITY} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dimColor }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} accessibilityLabel='dismiss' />

        {messagePreview != null && (
          <Animated.View
            style={[
              styles.preview,
              {
                top: openAnchor.pageY,
                left: openAnchor.pageX,
                width: openAnchor.bubbleWidth,
                height: isPreviewClipped ? layout.previewHeight : undefined,
              },
              isPreviewClipped && styles.clipped,
              previewStyle,
            ]}
            pointerEvents='none'
          >
            {messagePreview}
          </Animated.View>
        )}

        {items.length > 0 && (
          <Animated.View
            onLayout={onMenuLayout}
            style={[
              styles.menu,
              {
                top: layout.menuTop,
                left: menuLeft,
                borderRadius: Math.min(30, menuHeight / 2),
                transformOrigin: `${side} ${layout.menuFromBelow ? 'bottom' : 'top'}`,
              },
              menuStyle,
            ]}
            pointerEvents={isExpanded ? 'none' : 'auto'}
          >
            {items.map((item, index) => (
              <MenuRow
                key={`${item.label}-${index}`}
                item={item}
                hasIcons={hasIcons}
                highlightColor={highlightColor}
                onPress={handlePress}
                styles={styles}
              />
            ))}
          </Animated.View>
        )}

        {hasReactions && (
          <Animated.View
            style={[
              styles.bar,
              {
                transformOrigin: `${anchorX}px ${layout.barFromBelow ? 'bottom' : 'top'}`,
              },
              barStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.barBackground,
                isRight ? styles.barBackgroundRight : styles.barBackgroundLeft,
                reactions?.containerStyle,
                barBackgroundStyle,
              ]}
            />
            <Animated.View
              style={[styles.barItems, barItemsStyle]}
              pointerEvents={isExpanded ? 'none' : 'box-none'}
            >
              {reactions?.emojis.map((emoji, index) => (
                <ReactionButton
                  key={emoji}
                  emoji={emoji}
                  index={index}
                  delay={itemDelay(BAR_PADDING + index * (BAR_ITEM + BAR_SPACING) + BAR_ITEM / 2, anchorX, barWidth)}
                  onPress={handleReaction}
                  isHidden={flight?.emoji === emoji}
                  emojiStyle={reactions.emojiStyle}
                  styles={styles}
                />
              ))}
              {reactions?.renderAccessory && (
                <View onLayout={onAccessoryLayout}>{reactions.renderAccessory()}</View>
              )}
            </Animated.View>
            {hasExpand && (
              <Animated.View style={[styles.expandButtonWrap, expandButtonStyle]} pointerEvents={isExpanded ? 'none' : 'auto'}>
                <PopIn delay={itemDelay(expandCenterX, anchorX, barWidth)}>
                  <Pressable
                    onPress={handleExpand}
                    accessibilityRole='button'
                    accessibilityLabel='more reactions'
                    hitSlop={6}
                    style={styles.expandButton}
                  >
                    <Icon
                      name='chevronDown'
                      color={theme.colors.incomingMeta}
                      size={20}
                      fallback={<ChevronFallback color={theme.colors.incomingMeta} />}
                    />
                  </Pressable>
                </PopIn>
              </Animated.View>
            )}
            {/* Mounted from the start: a view that attaches to an animated
                style after its animation has finished keeps the style's first
                value, which here is invisible. */}
            {hasExpand && (
              <Animated.View
                style={[styles.panelContent, panelContentStyle]}
                pointerEvents={isExpanded ? 'auto' : 'none'}
              >
                {/* Laid out once at the panel's final size and revealed by the
                    growing, clipped panel - Telegram's mask. Filling the panel
                    instead resized the content on every frame of the expand,
                    so a grid re-laid out and re-rendered its cells each frame. */}
                <View
                  style={[
                    styles.panelContentInner,
                    isRight ? styles.panelContentInnerRight : styles.panelContentInnerLeft,
                    { width: panelWidth, height: panelHeight },
                  ]}
                >
                  {isExpanded && reactions?.renderExpandedPicker?.({ onSelect: handleExpandedSelect })}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}

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

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  root: {
    flex: 1,
  },
  preview: {
    position: 'absolute',
  },
  clipped: {
    overflow: 'hidden',
  },
  hidden: {
    opacity: 0,
  },
  bar: {
    position: 'absolute',
  },
  // Telegram's bar shadow: black at 0.4, 15pt blur (RSN
  // ReactionContextBackgroundNode.swift:170, 193).
  barBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  barBackgroundLeft: {
    left: 0,
  },
  barBackgroundRight: {
    right: 0,
  },
  barItems: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    gap: BAR_SPACING,
  },
  reactionButton: {
    width: BAR_ITEM,
    height: BAR_ITEM,
    borderRadius: BAR_ITEM / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionButtonPressed: {
    transform: [{ scale: 1.2 }],
  },
  reactionEmoji: {
    fontSize: BAR_EMOJI_SIZE,
    lineHeight: 32,
  },
  expandButtonWrap: {
    position: 'absolute',
    top: (BAR_HEIGHT - EXPAND_SIZE) / 2,
    right: EXPAND_INSET,
  },
  expandButton: {
    width: EXPAND_SIZE,
    height: EXPAND_SIZE,
    borderRadius: EXPAND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.reactionBackground,
  },
  panelContent: {
    ...StyleSheet.absoluteFill,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  panelContentInner: {
    position: 'absolute',
    top: 0,
  },
  panelContentInnerLeft: {
    left: 0,
  },
  panelContentInnerRight: {
    right: 0,
  },
  flight: {
    position: 'absolute',
    width: BAR_ITEM,
    height: BAR_ITEM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    minWidth: MENU_MIN_WIDTH,
    maxWidth: MENU_MAX_WIDTH,
    paddingVertical: MENU_PADDING_V,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: HIGHLIGHT_INSET,
    right: HIGHLIGHT_INSET,
    borderRadius: Math.min(20, ROW_HEIGHT / 2),
  },
  iconSlot: {
    position: 'absolute',
    left: ICON_X,
    width: ICON_SLOT,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 17,
    paddingLeft: TEXT_PADDING,
    paddingRight: TEXT_PADDING,
    color: theme.colors.incomingText,
  },
  rowLabelWithIcon: {
    paddingLeft: TITLE_X_WITH_ICON,
  },
  destructive: {
    color: theme.colors.error,
  },
})
