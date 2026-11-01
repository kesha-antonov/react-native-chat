import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, Keyboard, Platform, StyleSheet } from 'react-native'
import { KeyboardEvents, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedStyles } from '../hooks/useTheme'
import { ChatTheme } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { EmojiGrid } from './EmojiGrid'
import { EmojiCategoryKey, emojiRecents } from './emojiStore'

/*
 * Telegram Android's in-app emoji keyboard (`ChatActivityEnterView` + `EmojiView`, 13.1.1):
 * the panel takes the system keyboard's place at the last keyboard height (200 before one was
 * seen, `CAEV:3565, 12712`), so switching keyboard <-> emoji keeps the composer still; from
 * nothing it slides up over 250ms on `ChatListItemAnimator.DEFAULT_INTERPOLATOR`
 * (`CAEV:12746-12765`). The panel is a sheet with 29 top corners under the floating composer
 * (`ChatInputViewsContainer.INPUT_KEYBOARD_RADIUS`).
 */
const SWITCH = { duration: 250, easing: Easing.bezier(0.1992, 0.0106, 0.2792, 0.9103) }
const SHEET_RADIUS = 29
// While searching, the search row and two rows of results stay above the system keyboard.
const SEARCH_MODE_HEIGHT = 50 + 2 * 48 + 6

// The last system keyboard height, shared by every chat (Telegram keeps it as `kbd_height`).
let lastKeyboardHeight = 0

/** Props for a custom `emojiKeyboard.renderEmojiKeyboard`. */
export interface EmojiKeyboardRenderProps {
  /** Insert an emoji at the caret. */
  onSelect: (emoji: string) => void
  /** Delete the character before the caret. */
  onBackspace: () => void
  /** Go back to the system keyboard. */
  onClose: () => void
  /** The panel's height, including the bottom inset. */
  height: number
  /** The bottom inset (home indicator) the content should keep clear of. */
  bottomInset: number
}

/**
 * The built-in emoji keyboard (`Chat`'s `emojiKeyboard` prop). It is on by default; the emoji
 * button opens it in the system keyboard's place.
 */
export interface EmojiKeyboardProps {
  /** Show the emoji button and its keyboard. Default true. */
  isEnabled?: boolean
  /** Fixed column count; by default as many 45pt columns as fit (8 on a phone). */
  columns?: number
  /** Which tabs to offer, in order. Default: all. */
  categories?: EmojiCategoryKey[]
  /**
   * Telegram's recents (by use count, at most 48). `false` hides them. They persist through
   * `@react-native-async-storage/async-storage` when it is installed, under `storageKey`.
   */
  recents?: boolean | { isEnabled?: boolean, storageKey?: string, isPersisted?: boolean }
  /** Show search. Default true. */
  isSearchEnabled?: boolean
  /** Draw your own keyboard in the panel instead of the built-in grid. */
  renderEmojiKeyboard?: (props: EmojiKeyboardRenderProps) => React.ReactNode
}

export const resolveEmojiKeyboard = (value: boolean | EmojiKeyboardProps | undefined): EmojiKeyboardProps | null => {
  if (value === false)
    return null
  if (value === true || value === undefined)
    return {}
  return value.isEnabled === false ? null : value
}

interface UseEmojiKeyboardOptions {
  isEnabled: boolean
  focusComposer: () => void
  defaultHeight: number
}

export interface EmojiKeyboardController {
  /** The emoji panel is up (the button shows the keyboard icon). */
  isOpen: boolean
  /** The panel has been opened at least once, so it is mounted. */
  isMounted: boolean
  /** The panel's search field has the system keyboard. */
  isSearching: boolean
  toggle: () => void
  close: () => void
  /** The composer took focus: the system keyboard replaces the panel. */
  onComposerFocus: () => void
  onSearchModeChange: (isSearching: boolean) => void
  /** 0 closed, 1 open, on the UI thread. */
  open: SharedValue<number>
  searching: SharedValue<number>
  panelHeight: number
}

export function useEmojiKeyboard ({ isEnabled, focusComposer, defaultHeight }: UseEmojiKeyboardOptions): EmojiKeyboardController {
  const insets = useSafeAreaInsets()
  const keyboard = useReanimatedKeyboardAnimation()
  const fallbackProgress = useSharedValue(0)
  const keyboardProgress = keyboard?.progress ?? fallbackProgress

  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [panelHeight, setPanelHeight] = useState(() => lastKeyboardHeight || defaultHeight + insets.bottom)
  const open = useSharedValue(0)
  const searching = useSharedValue(0)
  const isOpenRef = useRef(false)
  isOpenRef.current = isOpen
  // The composer asked for the system keyboard; the panel goes once it is up.
  const awaitingKeyboardRef = useRef(false)

  const finishClose = useCallback((animated: boolean) => {
    awaitingKeyboardRef.current = false
    open.value = animated ? withTiming(0, SWITCH) : 0
    searching.value = 0
    setIsSearching(false)
    setIsOpen(false)
  }, [open, searching])

  useEffect(() => {
    const show = KeyboardEvents.addListener('keyboardDidShow', event => {
      if (event?.height > 0) {
        lastKeyboardHeight = event.height
        // Not while the panel is showing: it would jump. It takes the new height next time.
        if (!isOpenRef.current || awaitingKeyboardRef.current)
          setPanelHeight(event.height)
      }
      if (awaitingKeyboardRef.current)
        finishClose(true)
    })
    return () => show?.remove?.()
  }, [finishClose])

  // Android's back closes the panel first, as Telegram's does.
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'android')
      return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finishClose(true)
      return true
    })
    return () => subscription.remove()
  }, [isOpen, finishClose])

  const toggle = useCallback(() => {
    if (!isEnabled)
      return

    if (isOpenRef.current) {
      // Back to the system keyboard: the panel stays under it until the keyboard is up.
      awaitingKeyboardRef.current = true
      focusComposer()
      return
    }

    emojiRecents.load()
    if (lastKeyboardHeight > 0)
      setPanelHeight(lastKeyboardHeight)
    setIsMounted(true)
    setIsOpen(true)
    const isKeyboardUp = keyboardProgress.value > 0.5
    if (isKeyboardUp) {
      // The panel takes the keyboard's exact place while the keyboard leaves.
      open.value = 1
      Keyboard.dismiss()
    } else {
      open.value = withTiming(1, SWITCH)
    }
  }, [isEnabled, focusComposer, keyboardProgress, open])

  const close = useCallback(() => {
    if (!isOpenRef.current)
      return
    if (keyboardProgress.value > 0.5)
      Keyboard.dismiss()
    finishClose(true)
  }, [finishClose, keyboardProgress])

  const onComposerFocus = useCallback(() => {
    if (!isOpenRef.current)
      return
    awaitingKeyboardRef.current = true
    // Moving focus from the panel's search keeps the keyboard up, so nothing will announce it.
    if (searching.value > 0 || keyboardProgress.value > 0.9)
      finishClose(true)
  }, [finishClose, keyboardProgress, searching])

  const onSearchModeChange = useCallback((next: boolean) => {
    searching.value = next ? 1 : 0
    setIsSearching(next)
  }, [searching])

  return {
    isOpen,
    isMounted: isMounted && isEnabled,
    isSearching,
    toggle,
    close,
    onComposerFocus,
    onSearchModeChange,
    open,
    searching,
    panelHeight,
  }
}

interface EmojiKeyboardPanelProps {
  controller: EmojiKeyboardController
  config: EmojiKeyboardProps
  onSelect: (emoji: string) => void
  onBackspace: () => void
}

/**
 * The space under the composer the panel fills. Its height is the panel's share of the bottom,
 * less whatever the system keyboard already covers, so the composer stays put while the two
 * trade places; the panel itself is laid out once at full height and simply revealed.
 */
export function EmojiKeyboardPanel ({ controller, config, onSelect, onBackspace }: EmojiKeyboardPanelProps) {
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const keyboard = useReanimatedKeyboardAnimation()
  const fallbackHeight = useSharedValue(0)
  const keyboardHeight = keyboard?.height ?? fallbackHeight
  const { open, searching, panelHeight, isMounted } = controller

  const spacerStyle = useAnimatedStyle(() => {
    const covered = Math.max(0, -keyboardHeight.value)
    const height = searching.value > 0
      ? Math.max(SEARCH_MODE_HEIGHT, panelHeight - covered) * open.value
      : Math.max(0, open.value * panelHeight - covered)
    return { height }
  })
  // Hidden once closed: the translucent system keyboard would show it through.
  const panelStyle = useAnimatedStyle(() => ({ opacity: open.value > 0 ? 1 : 0 }))

  // Recents and skin tones follow the app's choice of storage.
  const recents = config.recents
  const recentsConfig = typeof recents === 'object' ? recents : null
  useEffect(() => {
    emojiRecents.configure({ storageKey: recentsConfig?.storageKey, isPersisted: recentsConfig?.isPersisted })
  }, [recentsConfig?.storageKey, recentsConfig?.isPersisted])

  if (!isMounted)
    return null

  const isRecentsEnabled = recents === false ? false : recentsConfig?.isEnabled !== false
  const renderProps: EmojiKeyboardRenderProps = {
    onSelect,
    onBackspace,
    onClose: controller.close,
    height: panelHeight,
    bottomInset: insets.bottom,
  }

  return (
    <Animated.View style={[styles.spacer, spacerStyle]}>
      <Animated.View
        testID='emoji-keyboard'
        style={[styles.panel, { height: panelHeight }, panelStyle]}
        pointerEvents={controller.isOpen ? 'auto' : 'none'}
      >
        {config.renderEmojiKeyboard
          ? renderComponentOrElement(config.renderEmojiKeyboard, renderProps)
          : (
            <EmojiGrid
              variant='keyboard'
              onSelect={onSelect}
              onBackspace={onBackspace}
              columns={config.columns}
              categories={config.categories}
              isRecentsEnabled={isRecentsEnabled}
              isSearchEnabled={config.isSearchEnabled !== false}
              onSearchModeChange={controller.onSearchModeChange}
              bottomInset={insets.bottom}
            />
          )}
      </Animated.View>
    </Animated.View>
  )
}

const createStyles = (theme: ChatTheme) => StyleSheet.create({
  // Unclipped: the panel hangs below it, under the keyboard or off screen, and is revealed.
  spacer: {
    overflow: 'visible',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: theme.emojiKeyboard.background,
    overflow: 'hidden',
    paddingTop: 4,
  },
})
