import React, {
  createRef,
  useEffect,
  useMemo,
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
import { GestureHandlerRootView, TextInput } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ChatContext } from '../ChatContext'
import { TEST_ID } from '../Constant'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { useHasSafeAreaProvider } from '../hooks/useHasSafeAreaProvider'
import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import { resolveLabels } from '../i18n'
import { InputToolbar } from '../InputToolbar'
import { MessagesContainer, AnimatedList } from '../MessagesContainer'
import { IMessage, ReplyMessage } from '../Models'
import stylesCommon from '../styles'
import { resolveTheme } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { ChatKeyboardAvoidingView } from './ChatKeyboardAvoidingView'
import styles from './styles'
import { ChatProps } from './types'

dayjs.extend(localizedFormat)

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
          reply={{
            ...reply,
            swipe: reply?.swipe ? {
              ...reply.swipe,
              onSwipe: handleSwipeToReply,
            } : undefined,
          }}
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
    reply,
    handleSwipeToReply,
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

      setTimeout(() => scrollToBottom(), 10)
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
      getColorScheme: () => colorScheme,
      getTheme: () => resolvedTheme,
      getIcons: () => icons,
      getLabels: () => resolvedLabels,
    }),
    [actionSheet, locale, colorScheme, resolvedTheme, icons, resolvedLabels]
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
          <View style={[stylesCommon.fill, !isInitialized && styles.hidden]}>
            {renderMessages}
            {inputToolbarFragment}
          </View>
          {!isInitialized && renderComponentOrElement(renderLoading, {})}
        </ChatKeyboardAvoidingView>
      </View>
    </ChatContext.Provider>
  )
}

function ChatWrapper<TMessage extends IMessage = IMessage> (props: ChatProps<TMessage>) {
  const {
    keyboardProviderProps,
    disableKeyboardProvider = false,
    ...rest
  } = props

  // Apps are meant to mount `KeyboardProvider` once, at the root. Nesting a second one
  // breaks keyboard handling on Android, so we only provide one when the app has none.
  const hasKeyboardProvider = useHasKeyboardProvider()
  // Apps normally mount `SafeAreaProvider` once at the root. Nesting a second one
  // makes every chat mount visibly jump: the nested provider renders first with the
  // parent's insets and only then with its own measured ones.
  const hasSafeAreaProvider = useHasSafeAreaProvider()

  const chat = <Chat<TMessage> {...rest} />

  const withKeyboardProvider = (
    <>
      {disableKeyboardProvider || hasKeyboardProvider
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

  return (
    <GestureHandlerRootView style={styles.fill}>
      {hasSafeAreaProvider
        ? withKeyboardProvider
        : <SafeAreaProvider>{withKeyboardProvider}</SafeAreaProvider>}
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
