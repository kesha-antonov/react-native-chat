import React, { useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { appendMessages, prependMessages, toggleReaction } from '../messageUtils'
import { IMessage } from '../Models'
import { Chat } from './Chat'
import { ChatSafeAreaProvider } from './ChatSafeAreaProvider'
import styles from './styles'
import { ChatProps } from './types'

export function ChatWrapper<TMessage extends IMessage = IMessage> (props: ChatProps<TMessage>) {
  const {
    keyboardProviderProps,
    enableKeyboardProvider = true,
    enableGestureHandlerRootView = true,
    ...rest
  } = props

  // Apps are meant to mount `KeyboardProvider` once, at the root. Nesting a second one
  // breaks keyboard handling on Android, so we only provide one when the app has none.
  //
  // Locked in on mount rather than read fresh every render: Chat is often portaled in
  // and out of the tree (a bottom sheet, a conditional screen), and if this ever flipped
  // on a later render, `chat` below would move from being a direct child of the fragment
  // to a child of `KeyboardProvider` (or back) - a structural change React can only handle
  // by unmounting and remounting the whole subtree. That kind of surprise remount, with a
  // shared element reused across both branches, is exactly the shape of hazard reported in
  // #17 alongside a rare Fabric/Yoga layout assertion; locking the choice removes it even
  // though it wasn't confirmed as that bug's root cause.
  const [hasKeyboardProvider] = useState(useHasKeyboardProvider())
  const chat = <Chat<TMessage> {...rest} />

  const withKeyboardProvider = (
    <>
      {!enableKeyboardProvider || hasKeyboardProvider
        ? chat
        : (
      // No `statusBarTranslucent` / `navigationBarTranslucent` here on purpose.
      // On Android those tell the provider that the app already draws behind the
      // system bars, and it answers by zeroing the *activity* content view's
      // margins - a window-level change it never undoes, so a chat screen would
      // leave the whole app under the navigation bar after you navigate away
      // (#2755). react-native-keyboard-controller turns both on by itself when
      // the app really is edge-to-edge, so forcing them only ever mismatches a
      // window that is not. Override via `keyboardProviderProps` if needed.
          <KeyboardProvider {...keyboardProviderProps}>
            {chat}
          </KeyboardProvider>
        )}
    </>
  )

  const content = (
    // Chat measures its *own* insets rather than reusing the app's. Reusing them
    // double-pads: a navigator has usually already inset the screen, so the
    // window's bottom inset is consumed before the chat even renders. The provider
    // is seeded from where the chat sits in the window, so the first frame already
    // has the insets the native measurement will report.
    <ChatSafeAreaProvider>
      {withKeyboardProvider}
    </ChatSafeAreaProvider>
  )

  // Apps are meant to mount `GestureHandlerRootView` once, at the root, same as
  // `KeyboardProvider` above - a nested one changes the native view hierarchy around
  // the composer for no benefit. Unlike `KeyboardProvider`, this can't be auto-detected:
  // `react-native-gesture-handler` doesn't publicly expose whether one is already
  // mounted above, so an app that has its own (directly, or via something like a bottom
  // sheet library) needs to opt out explicitly.
  if (!enableGestureHandlerRootView)
    return <View style={styles.fill}>{content}</View>

  return (
    <GestureHandlerRootView style={styles.fill}>
      {content}
    </GestureHandlerRootView>
  )
}

/** Append messages at the newest end of the list (the end `onSend` messages go to). */
ChatWrapper.append = appendMessages

/** Prepend messages at the oldest end of the list (for loading history). */
ChatWrapper.prepend = prependMessages

/**
 * Add or remove a user's reaction on one message, returning a new messages array - the
 * reducer behind `reactions.onReactionPress`:
 *
 * ```ts
 * onReactionPress: (message, emoji) =>
 *   setMessages(previous => Chat.toggleReaction(previous, message._id, emoji, user._id))
 * ```
 */
ChatWrapper.toggleReaction = toggleReaction
