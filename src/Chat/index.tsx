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
import {
  ActionSheetProvider,
  ActionSheetProviderRef,
} from '@expo/react-native-action-sheet'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import { GestureHandlerRootView, TextInput } from 'react-native-gesture-handler'
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider, useSafeAreaFrame } from 'react-native-safe-area-context'
import { ChatContext } from '../ChatContext'
import { TEST_ID } from '../Constant'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { InputToolbar } from '../InputToolbar'
import { MessagesContainer, AnimatedList } from '../MessagesContainer'
import { IMessage, ReplyMessage } from '../Models'
import stylesCommon from '../styles'
import { renderComponentOrElement } from '../utils'
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
  const colorScheme = colorSchemeProp !== undefined ? colorSchemeProp : systemColorScheme

  const actionSheetRef = useRef<ActionSheetProviderRef>(null)

  // `keyboardVerticalOffset` is the distance from the top of the window down to this
  // chat container - it depends on the navigation header and on whatever else the app
  // draws above the chat, which insets cannot see. `SafeAreaProvider` (mounted right
  // around us by `ChatWrapper`) already reports exactly that: its frame is measured
  // natively against the root view and refreshed on every layout change.
  const frame = useSafeAreaFrame()

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

  const onInitialLayoutViewLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (isInitialized)
        return

      const { layout } = e.nativeEvent

      if (layout.height <= 0)
        return

      notifyInputTextReset()

      setIsInitialized(true)
      setText(getTextFromProp(initialText))
    },
    [isInitialized, initialText, notifyInputTextReset, getTextFromProp]
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
      actionSheet:
        actionSheet ||
        (() => ({
          showActionSheetWithOptions:
            actionSheetRef.current!.showActionSheetWithOptions,
        })),
      getLocale: () => locale,
      getColorScheme: () => colorScheme,
    }),
    [actionSheet, locale, colorScheme]
  )

  useEffect(() => {
    if (props.text != null)
      setText(props.text)
  }, [props.text])

  return (
    <ChatContext.Provider value={contextValues}>
      <ActionSheetProvider ref={actionSheetRef}>
        <View
          testID={TEST_ID.WRAPPER}
          style={[stylesCommon.fill, styles.contentContainer]}
          onLayout={onInitialLayoutViewLayout}
        >
          <KeyboardAvoidingView
            behavior='translate-with-padding'
            keyboardVerticalOffset={frame.y}
            style={stylesCommon.fill}
            {...props.keyboardAvoidingViewProps}
          >
            <View style={[stylesCommon.fill, !isInitialized && styles.hidden]}>
              {renderMessages}
              {inputToolbarFragment}
            </View>
            {!isInitialized && renderComponentOrElement(renderLoading, {})}
          </KeyboardAvoidingView>
        </View>
      </ActionSheetProvider>
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

  const chat = <Chat<TMessage> {...rest} />

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
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
