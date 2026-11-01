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
  TextInput,
  useColorScheme,
} from 'react-native'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import '../dayjsLocales'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { ChatContext } from '../ChatContext'
import { ChatOverlayProvider, ChatOverlaySlot } from '../components/ChatOverlay'
import { ChatWallpaper, useOutgoingStep } from '../components/ChatWallpaper'
import { buildDefaultMessageActions, DEFAULT_MESSAGE_ACTION_KEYS } from '../components/defaultMessageActions'
import { FloatingRoundNote } from '../components/FloatingRoundNote'
import {
  MediaPlaybackContext,
  createMediaPlaybackController,
  setPlaybackRate,
  subscribePlaybackRate,
} from '../components/mediaPlayback'
import { createMessageHighlightStore, MessageHighlightContext } from '../components/messageHighlight'
import { NowPlayingBar } from '../components/NowPlayingBar'
import { TEST_ID } from '../Constant'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import { resolveLabels } from '../i18n'
import { InputToolbar } from '../InputToolbar'
import { devHint } from '../logging'
import { MessagesContainer, AnimatedList } from '../MessagesContainer'
import { appendMessages, prependMessages, toggleReaction } from '../messageUtils'
import { IMessage, MessageMenuItem, ReplyMessage, User } from '../Models'
import { getClipboard, hasRoundVideoCapture, hasVoiceRecording, getExpoImagePicker } from '../optional'
import { isRTLLocale } from '../rtl'
import stylesCommon from '../styles'
import { ChatTheme, resolveTheme } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { ChatKeyboardAvoidingView } from './ChatKeyboardAvoidingView'
import styles from './styles'
import { ChatProps } from './types'

dayjs.extend(localizedFormat)

/**
 * The wallpaper behind the list and the floating composer. It sits outside the keyboard
 * avoiding view, so the keyboard does not squash it, and holds the outgoing-message count
 * itself, so a send re-renders only this.
 */
function ChatBackground ({
  messages,
  userId,
  isInverted,
  theme,
  renderWallpaper,
}: {
  messages: IMessage[]
  userId: string | number | undefined
  isInverted: boolean
  theme: ChatTheme
  renderWallpaper?: (() => React.ReactNode) | null
}) {
  const step = useOutgoingStep(messages, userId, isInverted)

  if (renderWallpaper !== undefined)
    return renderWallpaper ? <>{renderWallpaper()}</> : null

  if (!theme.wallpaper.isEnabled)
    return null

  return <ChatWallpaper step={step} />
}

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
    mediaPlayback,

    reactions,
    messageActions,
    defaultMessageActions = true,
    onEditMessage,
    onDeleteMessage,
    onForwardMessage,
    onPinMessage,
    onLongPressMessage,
    isGroupChat: isGroupChatProp,
    isAvatarVisible: isAvatarVisibleProp,
    isUsernameVisible: isUsernameVisibleProp,
    renderAvatar,
    renderWallpaper,
  } = props

  // One playlist per chat: players register by message id and the controller
  // finds the next note from these messages. Fed on every render as a plain
  // write, so the list rows never re-render for it.
  const [mediaController] = useState(createMediaPlaybackController)
  mediaController.setMessages(messages, isInverted)
  mediaController.setOptions({
    isAutoPlayNextEnabled: mediaPlayback?.isAutoPlayNextEnabled ?? true,
    isRoundVideoAutoplayEnabled: mediaPlayback?.isRoundVideoAutoplayEnabled ?? false,
    onMediaRead: mediaPlayback?.onMediaRead,
    isNearEar: mediaPlayback?.isNearEar,
    onTranscribe: mediaPlayback?.onTranscribe,
    onViewOnceEnd: mediaPlayback?.onViewOnceEnd,
    isFloatingRoundNoteEnabled: mediaPlayback?.isFloatingRoundNoteEnabled ?? true,
  })

  // A round note kept playing past its row is stopped with the chat, and rows
  // unmounting along with it stop theirs rather than floating them.
  useEffect(() => {
    mediaController.notePlayers.setActive(true)
    return () => mediaController.notePlayers.setActive(false)
  }, [mediaController])

  const initialPlaybackRate = mediaPlayback?.playbackRate
  useEffect(() => {
    if (initialPlaybackRate != null)
      setPlaybackRate(initialPlaybackRate)
  }, [initialPlaybackRate])

  const onPlaybackRateChangeRef = useRef(mediaPlayback?.onPlaybackRateChange)
  onPlaybackRateChangeRef.current = mediaPlayback?.onPlaybackRateChange
  useEffect(() => subscribePlaybackRate(rate => onPlaybackRateChangeRef.current?.(rate)), [])

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
    () => props.textInputRef || createRef<React.ComponentRef<typeof TextInput>>(),
    [props.textInputRef]
  )

  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [text, setText] = useState<string | undefined>(() => props.text || '')
  const [internalReplyMessage, setInternalReplyMessage] = useState<ReplyMessage | null>(null)
  // The message being edited in the composer (Telegram's edit mode), or null.
  const [editingMessage, setEditingMessage] = useState<TMessage | null>(null)
  const [highlightStore] = useState(createMessageHighlightStore)
  useEffect(() => () => highlightStore.dispose(), [highlightStore])

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

  const isReplyEnabled = reply?.isEnabled !== false
  const onReplyRef = useRef(reply?.onReply)
  onReplyRef.current = reply?.onReply

  const focusComposer = useCallback(() => {
    // After the menu's exit, so the keyboard does not fight the lifted bubble flying back.
    requestAnimationFrame(() => textInputRef.current?.focus())
  }, [textInputRef])

  // A reply replaces an edit in progress, as in Telegram.
  const cancelEdit = useRef<() => void>(() => {})

  const startReply = useCallback(
    (message: TMessage) => {
      cancelEdit.current()

      if (replyMessageProp === undefined)
        // Uncontrolled mode: manage state internally
        setInternalReplyMessage({
          _id: message._id,
          text: message.text,
          user: message.user,
          image: message.image,
          audio: message.audio,
        })

      onReplyRef.current?.(message)
      focusComposer()
    },
    [replyMessageProp, focusComposer]
  )

  const handleSwipeToReply = useCallback(
    (message: TMessage) => {
      startReply(message)
      onSwipeToReply?.(message)
    },
    [startReply, onSwipeToReply]
  )

  const clearReply = useCallback(() => {
    if (replyMessageProp === undefined)
      // Uncontrolled mode: manage state internally
      setInternalReplyMessage(null)

    onClearReply?.()
  }, [replyMessageProp, onClearReply])

  const getSenderName = useCallback((messageId: string | number) =>
    messages.find(message => message._id === messageId)?.user?.name
  , [messages])

  // Telegram scrolls to the playing message from its bar.
  const scrollToMessage = useCallback((messageId: string | number) => {
    const index = messages.findIndex(message => message._id === messageId)
    if (index < 0)
      return

    try {
      messagesContainerRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
    } catch {
      // Not laid out yet (virtualized away); nothing to jump to.
    }
  }, [messages, messagesContainerRef])

  // Tapping a quote jumps to the message it quotes and flashes it.
  const jumpToQuotedMessage = useCallback((replyMessage: ReplyMessage) => {
    scrollToMessage(replyMessage._id)
    highlightStore.highlight(replyMessage._id)
  }, [scrollToMessage, highlightStore])

  // Rebuilt on the way down to the list, so it has to keep its identity across renders that
  // change nothing: it is passed through `MessagesContainer` into every row, and `Item`'s memo
  // compares it by reference, so a fresh object here re-renders every mounted row whenever the
  // parent re-renders. See rowRenderChurn.test.tsx.
  const isSwipeEnabled = isReplyEnabled && (reply?.swipe?.isEnabled ?? true)
  const replyForList = useMemo(() => ({
    ...reply,
    onPress: reply?.onPress ?? jumpToQuotedMessage,
    swipe: { ...reply?.swipe, isEnabled: isSwipeEnabled, onSwipe: handleSwipeToReply },
  }), [reply, handleSwipeToReply, isSwipeEnabled, jumpToQuotedMessage])

  // Telegram's edit mode: the message's text goes into the composer under an "Editing"
  // banner, and sending saves it instead of posting a new message. Text changes go through
  // `_onChangeText` (defined further down), reached through a ref.
  const changeTextRef = useRef<(text: string) => void>(() => {})
  const clearReplyRef = useRef<() => void>(() => {})

  const startEdit = useCallback((message: TMessage) => {
    clearReplyRef.current()
    setEditingMessage(message)
    changeTextRef.current(message.text ?? '')
    focusComposer()
  }, [focusComposer])

  const stopEdit = useCallback(() => {
    setEditingMessage(null)
    changeTextRef.current('')
  }, [])

  cancelEdit.current = () => {
    if (editingMessage)
      stopEdit()
  }

  // A group is any chat with more than one other sender; Telegram shows avatars and sender
  // names only there.
  const userId = (user as Partial<User> | undefined)?._id
  const isGroupChat = useMemo(() => {
    if (isGroupChatProp !== undefined)
      return isGroupChatProp

    const others = new Set<string | number>()
    for (const message of messages) {
      if (message.system || !message.user || message.user._id === userId)
        continue

      others.add(message.user._id)
      if (others.size > 1)
        return true
    }
    return false
  }, [isGroupChatProp, messages, userId])
  const isAvatarVisible = isAvatarVisibleProp ?? (renderAvatar ? true : isGroupChat)
  const isUsernameVisible = isUsernameVisibleProp ?? isGroupChat

  // Reactions turn on by themselves once the app can apply them.
  const resolvedReactions = useMemo(() => reactions
    ? { ...reactions, isEnabled: reactions.isEnabled ?? !!reactions.onReactionPress }
    : undefined
  , [reactions])

  // The app's callbacks are read through a ref, so an inline arrow does not hand every row a
  // new `messageActions` (and re-render it) on each parent render.
  const actionCallbacksRef = useRef({ onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage })
  actionCallbacksRef.current = { onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage }
  const hasPin = !!onPinMessage
  const hasEdit = !!onEditMessage
  const hasDelete = !!onDeleteMessage
  const hasForward = !!onForwardMessage

  // An app that already handles long-press itself keeps that, unless it asks for actions.
  const actionKeys = defaultMessageActions === false || (onLongPressMessage && messageActions === undefined)
    ? []
    : defaultMessageActions === true ? DEFAULT_MESSAGE_ACTION_KEYS : defaultMessageActions
  const actionKeysId = actionKeys.join(',')

  const resolvedMessageActions = useMemo(() => {
    if (Array.isArray(messageActions))
      return messageActions

    const keys = (actionKeysId ? actionKeysId.split(',') : []) as typeof DEFAULT_MESSAGE_ACTION_KEYS
    if (keys.length === 0 && !messageActions)
      return undefined

    const clipboard = keys.includes('copy') ? getClipboard() : null
    const owner = userId != null ? { _id: userId } : undefined
    const defaultsFor = (message: TMessage): MessageMenuItem[] => keys.length === 0
      ? []
      : buildDefaultMessageActions({
        message,
        user: owner,
        labels: resolvedLabels,
        keys,
        clipboard,
        onReply: isReplyEnabled ? startReply : undefined,
        onEdit: hasEdit ? startEdit : undefined,
        onForward: hasForward ? m => actionCallbacksRef.current.onForwardMessage?.(m) : undefined,
        onPin: hasPin ? m => actionCallbacksRef.current.onPinMessage?.(m) : undefined,
        onDelete: hasDelete
          ? m => {
            if (editingMessage?._id === m._id)
              stopEdit()
            actionCallbacksRef.current.onDeleteMessage?.(m)
          }
          : undefined,
      })

    if (typeof messageActions === 'function')
      return (message: TMessage) => messageActions(message, defaultsFor(message))

    return defaultsFor
  }, [
    messageActions,
    actionKeysId,
    userId,
    resolvedLabels,
    isReplyEnabled,
    startReply,
    startEdit,
    stopEdit,
    editingMessage,
    hasEdit,
    hasDelete,
    hasForward,
    hasPin,
  ])

  useEffect(() => {
    mediaController.setScroller(scrollToMessage)
    return () => mediaController.setScroller(null)
  }, [mediaController, scrollToMessage])

  const isNowPlayingBarEnabled = mediaPlayback?.isNowPlayingBarEnabled ?? true
  const isFloatingRoundNoteEnabled = mediaPlayback?.isFloatingRoundNoteEnabled ?? true

  const renderMessages = useMemo(() => {
    if (!isInitialized)
      return null

    const { messagesContainerStyle, ...messagesContainerProps } = props

    return (
      <View style={[stylesCommon.fill, messagesContainerStyle]}>
        {isNowPlayingBarEnabled && (
          <NowPlayingBar getSenderName={getSenderName} onPressTitle={scrollToMessage} />
        )}
        {/* The list's own area, so the floating round note docks to it and
            not over the "now playing" bar above. */}
        <View style={stylesCommon.fill}>
          <MessagesContainer<TMessage>
            {...messagesContainerProps}
            {...{
              messageActions: resolvedMessageActions,
              reactions: resolvedReactions,
              isAvatarVisible,
              isUsernameVisible,
            }}
            isInverted={isInverted}
            messages={messages}
            forwardRef={messagesContainerRef}
            isTyping={isTyping}
            reply={replyForList}
          />
          {isFloatingRoundNoteEnabled && <FloatingRoundNote />}
        </View>
        {renderComponentOrElement(renderChatFooter, {})}
        <ChatOverlaySlot />
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
    isNowPlayingBarEnabled,
    isFloatingRoundNoteEnabled,
    getSenderName,
    scrollToMessage,
    resolvedMessageActions,
    resolvedReactions,
    isAvatarVisible,
    isUsernameVisible,
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

      // In edit mode the composer saves the edited text instead of posting a message.
      const [edit] = messages
      if (
        editingMessage &&
        messages.length === 1 &&
        typeof edit?.text === 'string' &&
        !edit.audio &&
        !edit.video
      ) {
        if (shouldResetInputToolbar === true)
          resetInputToolbar()

        setEditingMessage(null)
        actionCallbacksRef.current.onEditMessage?.(editingMessage, edit.text)
        return
      }

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
    [messageIdGenerator, onSend, user, resetInputToolbar, scrollToBottom, replyMessage, clearReply, editingMessage]
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
  changeTextRef.current = _onChangeText
  clearReplyRef.current = () => {
    if (replyMessage)
      clearReply()
  }

  // Hints for a feature that was asked for but cannot work without its optional peer.
  const isAudioRecordingRequested = !!props.audioRecording?.isEnabled
  const isVideoRecordingRequested = !!props.videoRecording?.isEnabled
  useEffect(() => {
    if (isAudioRecordingRequested && !hasVoiceRecording())
      devHint('voice-recording-peer', 'Chat: `audioRecording.isEnabled` is set but `expo-audio` is not installed - the mic button is hidden')
  }, [isAudioRecordingRequested])
  useEffect(() => {
    if (isVideoRecordingRequested && !hasRoundVideoCapture() && !getExpoImagePicker()?.launchCameraAsync)
      devHint('video-recording-peer', 'Chat: `videoRecording.isEnabled` is set but neither `react-native-vision-camera` nor `expo-image-picker` is installed - the camera button is hidden')
  }, [isVideoRecordingRequested])

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
      editMessage: editingMessage,
      onCancelEdit: stopEdit,
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
    editingMessage,
    stopEdit,
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
        style={[stylesCommon.fill, styles.contentContainer, { backgroundColor: resolvedTheme.colors.background }]}
        onLayout={onInitialLayoutViewLayout}
      >
        <ChatBackground
          messages={messages}
          userId={userId}
          isInverted={isInverted}
          theme={resolvedTheme}
          renderWallpaper={renderWallpaper}
        />
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
            <MediaPlaybackContext.Provider value={mediaController}>
              <MessageHighlightContext.Provider value={highlightStore}>
                <ChatOverlayProvider>
                  {renderMessages}
                  {inputToolbarFragment}
                </ChatOverlayProvider>
              </MessageHighlightContext.Provider>
            </MediaPlaybackContext.Provider>
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

export {
  ChatWrapper as Chat
}
