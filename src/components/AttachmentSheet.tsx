import React, { useCallback, useEffect, useRef } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useThemedStyles } from '../hooks/useTheme'
import { IconRenderer } from '../Icons'
import { ChatTheme } from '../Theme'

// Optional native bottom sheet (Telegram-style: native grabber, dimmed backdrop,
// drag-to-dismiss, detents). Resolved through a try/catch require so the bundle
// works whether or not it's installed; without it we fall back to a Modal sheet.
let trueSheetMod: any = null
try {
  trueSheetMod = require('@lodev09/react-native-true-sheet')
} catch {
  trueSheetMod = null
}
const TrueSheet = trueSheetMod?.TrueSheet ?? null

export const isTrueSheetAvailable = !!TrueSheet

export interface AttachmentAction {
  title: string
  action: () => void
  /** Render the title in the destructive color. */
  destructive?: boolean
  /** Optional icon - when any action has one, the sheet renders as a grid. */
  icon?: IconRenderer
  /** Tile tint for the grid icon (defaults to the theme accent). */
  color?: string
}

export interface AttachmentSheetProps {
  visible: boolean
  actions: AttachmentAction[]
  onClose: () => void
  /** Optional tint for the action labels (defaults to the theme accent). */
  tintColor?: string
}

type SheetStyles = ReturnType<typeof createStyles>

// Shared content (grid of tiles when any action has an icon, otherwise a list).
const SheetContent = ({
  actions,
  tintColor,
  onAction,
  styles,
}: {
  actions: AttachmentAction[]
  tintColor?: string
  onAction: (action: () => void) => void
  styles: SheetStyles
}) => {
  const isGrid = actions.some(a => a.icon)

  if (isGrid)
    return (
      <View style={styles.grid}>
        {actions.map((item, index) => (
          <Pressable
            key={`${item.title}-${index}`}
            onPress={() => onAction(item.action)}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: item.color ?? styles.accent.color }]}>
              {item.icon?.({ color: '#fff', size: 26 })}
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
    )

  return (
    <View>
      {actions.map((item, index) => (
        <Pressable
          key={`${item.title}-${index}`}
          onPress={() => onAction(item.action)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.rowDivider,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={[styles.rowText, { color: item.destructive ? styles.destructive.color : (tintColor ?? styles.accent.color) }]}>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

// Primary path: a real native bottom sheet via react-native-true-sheet.
const TrueSheetAttachment = ({ visible, actions, onClose, tintColor }: AttachmentSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const ref = useRef<any>(null)
  const presented = useRef(false)

  useEffect(() => {
    // Guard against dismissing before the first present (TrueSheet rejects with
    // "No sheet" otherwise) and swallow the returned promise's rejection.
    if (visible) {
      presented.current = true
      ref.current?.present()?.catch(() => {})
    } else if (presented.current) {
      presented.current = false
      ref.current?.dismiss()?.catch(() => {})
    }
  }, [visible])

  const onAction = useCallback((action: () => void) => {
    action()
    presented.current = false
    ref.current?.dismiss()?.catch(() => {})
  }, [])

  // Swiped or tapped away natively: the sheet is already gone, so the `visible`
  // flip that follows must not ask it to dismiss again.
  const onDidDismiss = useCallback(() => {
    presented.current = false
    onClose()
  }, [onClose])

  return (
    <TrueSheet
      ref={ref}
      detents={['auto']}
      cornerRadius={16}
      grabber
      dimmed
      backgroundColor={styles.group.backgroundColor as string}
      onDidDismiss={onDidDismiss}
    >
      <View style={[styles.trueContent, { paddingBottom: insets.bottom + 12 }]}>
        <SheetContent actions={actions} tintColor={tintColor} onAction={onAction} styles={styles} />
      </View>
    </TrueSheet>
  )
}

// The sheet rises on a firm spring with no visible overshoot - the iOS sheet
// feel - and drops away faster than it came.
const SHEET_SPRING = { damping: 30, stiffness: 320, mass: 1, reduceMotion: ReduceMotion.System }
const SHEET_OUT = { duration: 220, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }
const BACKDROP_IN = { duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }

// Fallback: a Modal sheet with a dimmed backdrop and a grab handle. Slides up,
// dismisses on backdrop tap (used when react-native-true-sheet isn't installed).
const ModalAttachment = ({ visible, actions, onClose, tintColor }: AttachmentSheetProps) => {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  // 0 is closed, 1 open; the sheet starts a full window below its rest spot
  // so it never peeks in, whatever its height.
  const backdrop = useSharedValue(0)
  const offset = useSharedValue(windowHeight)

  const animateIn = useCallback(() => {
    offset.value = windowHeight
    offset.value = withSpring(0, SHEET_SPRING)
    backdrop.value = withTiming(1, BACKDROP_IN)
  }, [offset, backdrop, windowHeight])

  const animateOut = useCallback((onDone: () => void) => {
    backdrop.value = withTiming(0, SHEET_OUT)
    offset.value = withTiming(windowHeight, SHEET_OUT, finished => {
      if (finished)
        runOnJS(onDone)()
    })
  }, [offset, backdrop, windowHeight])

  const { isMounted, close } = useAnimatedPresence(visible, animateIn, animateOut)

  const dismiss = useCallback(() => close(onClose), [close, onClose])

  // The action runs once the sheet is gone, so a picker it opens (camera,
  // library) doesn't present over a half-closed sheet.
  const onAction = useCallback((action: () => void) => {
    close(() => {
      action()
      onClose()
    })
  }, [close, onClose])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }))

  if (!isMounted)
    return null

  return (
    <Modal transparent visible animationType='none' onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents='none' />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel='dismiss' />
      <Animated.View style={[styles.sheetWrapper, { paddingBottom: insets.bottom + 8 }, sheetStyle]}>
        <View style={styles.group}>
          <View style={styles.handle} />
          <SheetContent actions={actions} tintColor={tintColor} onAction={onAction} styles={styles} />
        </View>
      </Animated.View>
    </Modal>
  )
}

/**
 * Telegram-style attachment sheet. Uses the native `react-native-true-sheet`
 * when installed (native grabber, dimmed backdrop, drag-to-dismiss); otherwise
 * falls back to a dependency-free Modal sheet. No Cancel button - dismiss by
 * dragging down or tapping the backdrop.
 */
export const AttachmentSheet = (props: AttachmentSheetProps) =>
  isTrueSheetAvailable ? <TrueSheetAttachment {...props} /> : <ModalAttachment {...props} />

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  // Content padding inside the native sheet (which provides its own surface).
  trueContent: {
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.separator,
    marginTop: 8,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  tile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  tilePressed: {
    opacity: 0.6,
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 12,
    color: theme.colors.incomingText,
  },
  row: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator,
  },
  rowPressed: {
    backgroundColor: theme.colors.reactionBackground,
  },
  rowText: {
    fontSize: 18,
  },
  accent: {
    color: theme.colors.accent,
  },
  destructive: {
    color: theme.colors.error,
  },
})
