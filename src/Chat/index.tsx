import React, {
  createRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  RefObject,
} from 'react'
import {
  View,
  LayoutChangeEvent,
  useColorScheme,
} from 'react-native'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import '../dayjsLocales'
import { GestureHandlerRootView, TextInput } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { ChatContext } from '../ChatContext'
import { TEST_ID } from '../Constant'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import { resolveLabels } from '../i18n'
import { InputToolbar } from '../InputToolbar'
import { MessagesContainer, AnimatedList } from '../MessagesContainer'
import { IMessage, ReplyMessage } from '../Models'
import { isRTLLocale } from '../rtl'
import stylesCommon from '../styles'
import { resolveTheme } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { ChatKeyboardAvoidingView } from './ChatKeyboardAvoidingView'
import styles from './styles'
import { ChatProps } from './types'

dayjs.extend(localizedFormat)

/** Seed for Chat's own SafeAreaProvider - real frame, but no insets claimed yet. */
const INITIAL_SAFE_AREA_METRICS = {
  frame: initialWindowMetrics?.frame ?? { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
}

function Chat<TMessage extends IMessage = IMessage> (
  props: ChatProps<TMessage>
) {
  const {
    messages = [],
    initialText = '',
    isTyping,

    // "random" function from here: https://stackoverflow.com/a/8084248/3452513
    // we do not use uuid since it would add extra native dependency (https://www.npmjs.com/package/react-native-get-random-values)
    // lib's user can decide which algorithm to use and pass it as a prop
    messageIdGenerator = () => (Math.random() + 1).toString(36).substring(7),

    user = {},
    onSend,
    locale = 'en',
    forceRTL,
    colorScheme: colorSchemeProp,
    theme,
    darkTheme,
    icons,
    labels,
    renderLoading,
    actionSheet,
    textInputProps,
    renderChatFooter,
    renderInputToolbar,
    isInverted = true,

    // Reply props
    reply,
  } = props

  // Extract reply props for internal use
  const replyMessageProp = reply?.message
  const onClearReply = reply?.onClear
  const onSwipeToReply = reply?.swipe?.onSwipe
  const renderReplyPreview = reply?.renderPreview
  const replyPreviewContainerStyle = reply?.previewStyle?.containerStyle
  const replyPreviewTextStyle = reply?.previewStyle?.textStyle

  const systemColorScheme = useColorScheme()
  // RN 0.86 can report 'unspecified'; normalize it away before it reaches the theme.
  const colorScheme = normalizeColorScheme(
    colorSchemeProp !== undefined ? colorSchemeProp : systemColorScheme
  )

  // Resolve the theme once per change so its identity is stable; this is what
  // makes on-the-fly theme / color-scheme switching propagate to every memoized
  // StyleSheet without rebuilding styles on unrelated renders.
  const resolvedTheme = useMemo(
    () => resolveTheme(colorScheme, theme, darkTheme),
    [colorScheme, theme, darkTheme]
  )

  const resolvedLabels = useMemo(
    () => resolveLabels(locale, labels),
    [locale, labels]
  )

  const isRTL = useMemo(
    () => forceRTL ?? isRTLLocale(locale),
    [forceRTL, locale]
  )

  const messagesContainerRef = useMemo(
    () => props.messagesContainerRef || createRef<AnimatedList<TMessage>>(),
    [props.messagesContainerRef]
  ) as RefObject<AnimatedList<TMessage>>

  const textInputRef = useMemo(
    () => props.textInputRef || createRef<TextInput>(),
    [props.textInputRef]
  )

  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [text, setText] = useState<string | undefined>(() => props.text || '')
  const [internalReplyMessage, setInternalReplyMessage] = useState<ReplyMessage | null>(null)

  // Use controlled or uncontrolled reply state
  const replyMessage = replyMessageProp !== undefined ? replyMessageProp : internalReplyMessage

  const getTextFromProp = useCallback(
    (fallback: string) => {
      if (props.text === undefined)
        return fallback

      return props.text
    },
    [props.text]
  )

  const scrollToBottom = useCallback(
    (isAnimated = true) => {
      if (!messagesContainerRef?.current)
        return

      if (isInverted) {
        messagesContainerRef.current.scrollToOffset({
          offset: 0,
          animated: isAnimated,
        })
        return
      }

      messagesContainerRef.current.scrollToEnd({ animated: isAnimated })
    },
    [isInverted, messagesContainerRef]
  )

  const scrollAfterSendTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => {
    clearTimeout(scrollAfterSendTimeout.current)
  }, [])

  const handleSwipeToReply = useCallback(
    (message: TMessage) => {
      if (replyMessageProp === undefined)
        // Uncontrolled mode: manage state internally
        setInternalReplyMessage({
          _id: message._id,
          text: message.text,
          user: message.user,
          image: message.image,
          audio: message.audio,
        })

      onSwipeToReply?.(message)
    },
    [replyMessageProp, onSwipeToReply]
  )

  const clearReply = useCallback(() => {
    if (replyMessageProp === undefined)
      // Uncontrolled mode: manage state internally
      setInternalReplyMessage(null)

    onClearReply?.()
  }, [replyMessageProp, onClearReply])

  // Rebuilt on the way down to the list, so it has to keep its identity across renders that
  // change nothing: it is passed through `MessagesContainer` into every row, and `Item`'s memo
  // compares it by reference, so a fresh object here re-renders every mounted row whenever the
  // parent re-renders. See rowRenderChurn.test.tsx.
  const replyForList = useMemo(() => ({
    ...reply,
    swipe: reply?.swipe
      ? { ...reply.swipe, onSwipe: handleSwipeToReply }
      : undefined,
  }), [reply, handleSwipeToReply])

  const renderMessages = useMemo(() => {
    if (!isInitialized)
      return null

    const { messagesContainerStyle, ...messagesContainerProps } = props

    return (
      <View style={[stylesCommon.fill, messagesContainerStyle]}>
        <MessagesContainer<TMessage>
          {...messagesContainerProps}
          isInverted={isInverted}
          messages={messages}
          forwardRef={messagesContainerRef}
          isTyping={isTyping}
          reply={replyForList}
        />
        {renderComponentOrElement(renderChatFooter, {})}
      </View>
    )
  }, [
    isInitialized,
    isTyping,
    messages,
    props,
    isInverted,
    messagesContainerRef,
    renderChatFooter,
    replyForList,
  ])

  const notifyInputTextReset = useCallback(() => {
    props.textInputProps?.onChangeText?.('')
  }, [props.textInputProps])

  const resetInputToolbar = useCallback(() => {
    textInputRef.current?.clear()

    notifyInputTextReset()

    setText(getTextFromProp(''))
  }, [
    getTextFromProp,
    textInputRef,
    notifyInputTextReset,
  ])

  const _onSend = useCallback(
    (messages: TMessage[] = [], shouldResetInputToolbar = false) => {
      if (!Array.isArray(messages))
        messages = [messages]

      const newMessages: TMessage[] = messages.map(message => {
        return {
          ...message,
          user: user!,
          createdAt: new Date(),
          _id: messageIdGenerator?.(),
          // Attach reply message if exists
          ...(replyMessage ? { replyMessage } : {}),
        }
      })

      if (shouldResetInputToolbar === true)
        resetInputToolbar()

      // Clear reply after sending
      clearReply()

      onSend?.(newMessages)

      // One frame's grace so the new message is laid out before we scroll to it.
      // Held in a ref so sending and immediately unmounting cannot fire it afterwards.
      clearTimeout(scrollAfterSendTimeout.current)
      scrollAfterSendTimeout.current = setTimeout(() => scrollToBottom(), 10)
    },
    [messageIdGenerator, onSend, user, resetInputToolbar, scrollToBottom, replyMessage, clearReply]
  )

  const _onChangeText = useCallback(
    (text: string) => {
      props.textInputProps?.onChangeText?.(text)

      // Only set state if it's not being overridden by a prop.
      if (props.text === undefined)
        setText(text)
    },
    [props.text, props.textInputProps]
  )

  // Measures where the chat starts in the window, which is what the
  // KeyboardAvoidingView needs to keep the toolbar on the keyboard.
  const keyboardOffset = useKeyboardVerticalOffset()
  const measureKeyboardOffset = keyboardOffset.onLayout

  // Reveal only once the real offset has been measured, not just once the layout
  // event that kicked off measuring it has fired - `isInitialized` alone let the
  // toolbar paint for a frame at the pre-measurement seed, which is offset 0 for
  // any chat that isn't full-screen. See `useKeyboardVerticalOffset` (#12).
  const isReady = isInitialized && keyboardOffset.isMeasured

  const onInitialLayoutViewLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // Runs on every layout, not just the first: a header appearing or the
      // device rotating moves the chat's top edge.
      measureKeyboardOffset()

      if (isInitialized)
        return

      const { layout } = e.nativeEvent

      if (layout.height <= 0)
        return

      notifyInputTextReset()

      setIsInitialized(true)
      setText(getTextFromProp(initialText))
    },
    [isInitialized, initialText, notifyInputTextReset, getTextFromProp, measureKeyboardOffset]
  )

  const inputToolbarFragment = useMemo(() => {
    if (!isInitialized)
      return null

    const inputToolbarProps = {
      ...props,
      text: getTextFromProp(text!),
      onSend: _onSend,
      textInputProps: {
        ...textInputProps,
        onChangeText: _onChangeText,
        ref: textInputRef,
      },
      // Reply preview props
      replyMessage,
      onClearReply: clearReply,
      renderReplyPreview,
      replyPreviewContainerStyle,
      replyPreviewTextStyle,
    }

    if (renderInputToolbar)
      return renderComponentOrElement(renderInputToolbar, inputToolbarProps)

    return <InputToolbar {...inputToolbarProps} />
  }, [
    isInitialized,
    _onSend,
    getTextFromProp,
    props,
    text,
    renderInputToolbar,
    textInputRef,
    textInputProps,
    _onChangeText,
    replyMessage,
    clearReply,
    renderReplyPreview,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  ])

  const contextValues = useMemo(
    () => ({
      // The built-in UI no longer uses an action sheet; this stays as an
      // escape hatch for consumers who pass their own `actionSheet` (e.g.
      // @expo/react-native-action-sheet). Defaults to a no-op.
      actionSheet:
        actionSheet ||
        (() => ({
          showActionSheetWithOptions: () => {},
        })),
      getLocale: () => locale,
      getIsRTL: () => isRTL,
      getColorScheme: () => colorScheme,
      getTheme: () => resolvedTheme,
      getIcons: () => icons,
      getLabels: () => resolvedLabels,
    }),
    [actionSheet, locale, isRTL, colorScheme, resolvedTheme, icons, resolvedLabels]
  )

  useEffect(() => {
    if (props.text != null)
      setText(props.text)
  }, [props.text])

  return (
    <ChatContext.Provider value={contextValues}>
      <View
        testID={TEST_ID.WRAPPER}
        ref={keyboardOffset.ref}
        style={[stylesCommon.fill, styles.contentContainer]}
        onLayout={onInitialLayoutViewLayout}
      >
        <ChatKeyboardAvoidingView
          keyboardVerticalOffset={keyboardOffset.keyboardVerticalOffset}
          keyboardAvoidingViewProps={props.keyboardAvoidingViewProps}
        >
          {/*
            collapsable={false}: `opacity` is the only paint prop this view ever
            carries, and it's conditional on `isReady` - a plain `{flex:1}` view is
            eligible for Fabric's shadow-node flattening, but one with `opacity`
            isn't, so every mount flips this view's flattening eligibility exactly
            once, right after `isReady` turns true. That flip restructures the
            Yoga tree directly above the composer on the same mount cycle a
            remounted `Chat` first accepts a keystroke, matching the crash in #17
            (`YGNodeGetOwner(childYogaNode) == &yogaNode_`). Pinning collapsable
            keeps this node's shadow-tree identity stable across the flip.
          */}
          <View
            testID={TEST_ID.CONTENT}
            collapsable={false}
            style={[stylesCommon.fill, !isReady && styles.hidden]}
          >
            {renderMessages}
            {inputToolbarFragment}
          </View>
          {!isReady && renderComponentOrElement(renderLoading, {})}
        </ChatKeyboardAvoidingView>
      </View>
    </ChatContext.Provider>
  )
}

function ChatWrapper<TMessage extends IMessage = IMessage> (props: ChatProps<TMessage>) {
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
    // window's bottom inset is consumed before the chat even renders.
    //
    // The provider is seeded with zero insets on purpose. Without `initialMetrics`
    // react-native-safe-area-context seeds a nested provider from its parent, so
    // the first frame used the window's insets and the second the measured ones -
    // bottom 34 -> 0 on an iPhone, which is the jump you see on every mount.
    // Seeding zero matches what a chat inside a navigator settles on, so nothing
    // moves; a genuinely full-screen chat grows into its inset on the next frame
    // instead of collapsing out of one.
    <SafeAreaProvider initialMetrics={INITIAL_SAFE_AREA_METRICS}>
      {withKeyboardProvider}
    </SafeAreaProvider>
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

ChatWrapper.append = <TMessage extends IMessage>(
  currentMessages: TMessage[] = [],
  messages: TMessage[],
  isInverted = true
) => {
  if (!Array.isArray(messages))
    messages = [messages]

  return isInverted
    ? messages.concat(currentMessages)
    : currentMessages.concat(messages)
}

ChatWrapper.prepend = <TMessage extends IMessage>(
  currentMessages: TMessage[] = [],
  messages: TMessage[],
  isInverted = true
) => {
  if (!Array.isArray(messages))
    messages = [messages]

  return isInverted
    ? currentMessages.concat(messages)
    : messages.concat(currentMessages)
}

export {
  ChatWrapper as Chat
}
