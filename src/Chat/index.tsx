import React, {
  createRef,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  RefObject,
} from 'react'
import {
  BackHandler,
  Keyboard,
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
import { ChatContext } from '../ChatContext'
import { ChatEmpty } from '../components/ChatEmpty'
import { ChatLoadingOverlay } from '../components/ChatLoadingOverlay'
import { ChatOverlayProvider, ChatOverlaySlot } from '../components/ChatOverlay'
import { ChatWallpaper, useOutgoingStep } from '../components/ChatWallpaper'
import { ComposerPanelsContext, createComposerPanelsStore } from '../components/composerPanels'
import { buildDefaultMessageActions, DEFAULT_MESSAGE_ACTION_KEYS } from '../components/defaultMessageActions'
import { FloatingRoundNote } from '../components/FloatingRoundNote'
import {
  MediaPlaybackContext,
  createMediaPlaybackController,
  setPlaybackRate,
  subscribePlaybackRate,
} from '../components/mediaPlayback'
import { createMediaTransferController, MediaTransferContext } from '../components/mediaTransfer'
import { createMediaGallery, MediaGalleryContext } from '../components/mediaViewer/gallery'
import { MediaViewerHost } from '../components/mediaViewer/MediaViewerHost'
import { createMessageHighlightStore, MessageHighlightContext } from '../components/messageHighlight'
import {
  createMessageSelectionStore,
  MessageSelectionContext,
  MessageSelectionStore,
  useIsSelectionActive,
  useSelectedIds,
} from '../components/messageSelection'
import { NowPlayingBar } from '../components/NowPlayingBar'
import { SelectionBar, SelectionBarAction, SelectionBarProps } from '../components/SelectionBar'
import { TEST_ID } from '../Constant'
import { renderDefaultExpandedPicker } from '../emoji/defaultExpandedPicker'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { useHasKeyboardProvider } from '../hooks/useHasKeyboardProvider'
import { useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import { resolveLabels } from '../i18n'
import { InputToolbar, InputToolbarProps } from '../InputToolbar'
import { devHint } from '../logging'
import { MessagesContainer, AnimatedList } from '../MessagesContainer'
import { PageDownReturn, PageDownReturnContext } from '../MessagesContainer/pageDownReturn'
import { appendMessages, prependMessages, toggleReaction } from '../messageUtils'
import { IMessage, MessageMenuItem, ReplyMessage, User } from '../Models'
import { getClipboard, hasRoundVideoCapture, hasVoiceRecording, getExpoImagePicker } from '../optional'
import { isRTLLocale } from '../rtl'
import { createStore, Store, useStore } from '../store'
import stylesCommon from '../styles'
import { ChatTheme, resolveTheme } from '../Theme'
import { renderComponentOrElement } from '../utils'
import { ChatKeyboardAvoidingView } from './ChatKeyboardAvoidingView'
import { ChatSafeAreaProvider } from './ChatSafeAreaProvider'
import styles from './styles'
import { ChatProps } from './types'

// Memoized: the composer re-renders on its own state, not because the chat around it did.
const MemoInputToolbar = React.memo(InputToolbar) as typeof InputToolbar

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

/** Oldest first, the order a selection is copied and forwarded in. */
const byDate = <TMessage extends IMessage>(a: TMessage, b: TMessage) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

/**
 * The bar in the composer's place while messages are selected. Only this re-renders as messages
 * are checked; `Chat` itself re-renders once on the way in and once on the way out.
 */
function ChatSelectionBar<TMessage extends IMessage> ({
  store,
  messages: allMessages,
  canCopy,
  onCopy,
  onForward,
  onDelete,
  renderSelectionBar,
}: {
  store: MessageSelectionStore
  messages: TMessage[]
  canCopy: boolean
  onCopy: (messages: TMessage[]) => void
  onForward?: (messages: TMessage[]) => void
  onDelete?: (messages: TMessage[]) => void
  renderSelectionBar?: ((props: SelectionBarProps & { messages: TMessage[] }) => React.ReactNode) | null
}) {
  const ids = useSelectedIds(store)
  const messages = useMemo(() => ids
    .map(id => allMessages.find(message => message._id === id))
    .filter((message): message is TMessage => !!message)
  , [ids, allMessages])
  const ordered = useMemo(() => [...messages].sort(byDate), [messages])

  const actions: SelectionBarAction[] = []
  if (canCopy && ordered.some(message => !!message.text))
    actions.push({ key: 'copy', onPress: () => onCopy(ordered) })
  if (onForward)
    actions.push({ key: 'forward', onPress: () => onForward(ordered) })
  if (onDelete)
    actions.push({ key: 'delete', onPress: () => onDelete(ordered) })

  const props = { count: ids.length, onClose: store.clear, actions }
  if (renderSelectionBar)
    return <>{renderSelectionBar({ ...props, messages: ordered })}</>

  return <SelectionBar {...props} />
}

// "random" function from here: https://stackoverflow.com/a/8084248/3452513
// we do not use uuid since it would add extra native dependency (https://www.npmjs.com/package/react-native-get-random-values)
// lib's user can decide which algorithm to use and pass it as a prop
const defaultMessageIdGenerator = () => (Math.random() + 1).toString(36).substring(7)

/**
 * An app's `renderInputToolbar`, called from a component of its own. Its props carry the
 * composer's ref and ref-backed handlers, which must not be handed to a function called while
 * `Chat` renders.
 */
function CustomInputToolbar<TProps extends Record<string, any>> ({ render, props }: {
  render: Parameters<typeof renderComponentOrElement<TProps>>[0]
  props: TProps
}) {
  return <>{renderComponentOrElement(render, props)}</>
}

const sameText = (text: string) => text

/**
 * The composer, and the only part of the chat a keystroke re-renders: the typed text lives in a
 * store this host reads, not in `Chat`'s state, so typing leaves `Chat`, the keyboard-avoiding
 * view and the overlay provider alone. A controlled `text` prop still wins over the store.
 */
function ComposerHost<TProps extends Record<string, any>> ({ textStore, controlledText, render, props }: {
  textStore: Store<string>
  controlledText: string | undefined
  render: Parameters<typeof renderComponentOrElement<TProps>>[0] | undefined
  props: TProps
}) {
  const storedText = useStore(textStore, sameText, '')
  const text = controlledText === undefined ? storedText : controlledText

  if (render)
    return <CustomInputToolbar render={render} props={{ ...props, text }} />

  // The built-in composer has no use for the messages, and leaving them out lets its memo
  // skip the render a new message would otherwise cost it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { messages: _messages, ...composerProps } = props
  return <MemoInputToolbar {...(composerProps as unknown as InputToolbarProps<IMessage>)} text={text} />
}

// The input's ref may be the app's (a prop), so the compiler cannot tell a `.current` read inside
// a callback from a render input; reading it out here keeps the callback's memoization.
const clearInput = (ref: RefObject<React.ComponentRef<typeof TextInput> | null>) => ref.current?.clear()

function Chat<TMessage extends IMessage = IMessage> (
  props: ChatProps<TMessage>
) {
  const {
    messages = [],
    initialText = '',
    isTyping,

    messageIdGenerator = defaultMessageIdGenerator,

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
    mediaTransfer,

    reactions,
    messageActions,
    defaultMessageActions = true,
    onEditMessage,
    onDeleteMessage,
    onForwardMessage,
    onPinMessage,
    onForwardMessages,
    onDeleteMessages,
    onSelectionChange,
    renderSelectionBar,
    onLongPressMessage,
    isGroupChat: isGroupChatProp,
    isAvatarVisible: isAvatarVisibleProp,
    isUsernameVisible: isUsernameVisibleProp,
    renderAvatar,
    renderWallpaper,
    emptyChatGreeting,
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

  // Media button handlers, read at press time; written per render like the
  // playback options so rows never re-render for a new handler.
  const [mediaTransferController] = useState(createMediaTransferController)
  mediaTransferController.set(mediaTransfer)

  // The latest messages, for what reads them only when it needs them: the selection, and the
  // photos the media viewer pages through (read when it opens, so nothing re-renders as
  // messages arrive).
  const messagesRef = useRef(messages)
  const [mediaGallery] = useState(createMediaGallery)
  useInsertionEffect(() => {
    messagesRef.current = messages
    mediaGallery.setMessages(messages)
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

  const onPlaybackRateChange = mediaPlayback?.onPlaybackRateChange
  const onPlaybackRateChangeRef = useRef(onPlaybackRateChange)
  useInsertionEffect(() => {
    onPlaybackRateChangeRef.current = onPlaybackRateChange
  })
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
    () => props.messagesContainerRef || createRef<AnimatedList>(),
    [props.messagesContainerRef]
  ) as RefObject<AnimatedList>

  // Typed as a ref so the compiler knows reading `.current` in a callback is not a render input.
  const textInputRef = useMemo(
    () => props.textInputRef || createRef<React.ComponentRef<typeof TextInput>>(),
    [props.textInputRef]
  ) as RefObject<React.ComponentRef<typeof TextInput>>

  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  // The typed text, read by `ComposerHost` alone: a keystroke must not re-render `Chat`.
  const [textStore] = useState(() => createStore<string>(props.text || props.initialText || ''))
  const [internalReplyMessage, setInternalReplyMessage] = useState<ReplyMessage | null>(null)
  // The message being edited in the composer (edit mode), or null.
  const [editingMessage, setEditingMessage] = useState<TMessage | null>(null)
  const [highlightStore] = useState(createMessageHighlightStore)
  const [composerPanels] = useState(createComposerPanelsStore)
  const [selectionStore] = useState(createMessageSelectionStore)
  const isSelecting = useIsSelectionActive(selectionStore)
  useEffect(() => () => highlightStore.dispose(), [highlightStore])

  // The selection's messages are looked up by id when it changes; deleted ones drop out of it.
  useEffect(() => {
    selectionStore.retain(new Set(messages.map(message => message._id)))
  }, [messages, selectionStore])

  const onSelectionChangeRef = useRef(onSelectionChange)
  useInsertionEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  })
  useEffect(() => selectionStore.subscribe(() => {
    const ids = selectionStore.getSelectedIds()
    onSelectionChangeRef.current?.(
      ids.map(id => messagesRef.current.find(message => message._id === id)).filter((m): m is TMessage => !!m)
    )
  }), [selectionStore])

  // Android's back leaves selection mode first.
  useEffect(() => {
    if (!isSelecting)
      return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      selectionStore.clear()
      return true
    })
    return () => subscription.remove()
  }, [isSelecting, selectionStore])

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
      // The list renders oldest first, so the newest message is at its end.
      messagesContainerRef.current?.scrollToEnd({ animated: isAnimated })
    },
    [messagesContainerRef]
  )

  const scrollAfterSendTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => {
    clearTimeout(scrollAfterSendTimeout.current)
  }, [])

  const isReplyEnabled = reply?.isEnabled !== false
  const onReply = reply?.onReply
  const onReplyRef = useRef(onReply)
  useInsertionEffect(() => {
    onReplyRef.current = onReply
  })

  const focusComposer = useCallback(() => {
    // After the menu's exit, so the keyboard does not fight the lifted bubble flying back.
    requestAnimationFrame(() => textInputRef.current?.focus())
  }, [textInputRef])

  // A reply replaces an edit in progress.
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

  // Read through a ref: these end up in the reply config every row gets, and depending on
  // `messages` re-rendered every mounted row each time a message was sent or arrived.
  const getSenderName = useCallback((messageId: string | number) =>
    messagesRef.current.find(message => message._id === messageId)?.user?.name
  , [])

  // The now-playing bar scrolls to the playing message.
  const scrollToMessage = useCallback((messageId: string | number) => {
    if (!messagesRef.current.some(message => message._id === messageId))
      return

    // By key: the list reaches a row it has not measured yet, far up the history, too.
    messagesContainerRef.current?.scrollToKey({ key: String(messageId), animated: true, viewPosition: 0.5 })
  }, [messagesContainerRef])

  // Tapping a quote jumps to the message it quotes and flashes it. The scroll-to-bottom button
  // then comes up and takes you back to where you tapped it (`returnToMessageId`).
  const [returnToMessageId, setReturnToMessageId] = useState<string | number | null>(null)
  const jumpToQuotedMessage = useCallback((replyMessage: ReplyMessage, fromMessage?: IMessage) => {
    scrollToMessage(replyMessage._id)
    highlightStore.highlight(replyMessage._id)
    if (fromMessage && fromMessage._id !== replyMessage._id)
      setReturnToMessageId(fromMessage._id)
  }, [scrollToMessage, highlightStore])

  const pageDownReturn = useMemo((): PageDownReturn => ({
    messageId: returnToMessageId,
    goBack: () => {
      if (returnToMessageId == null)
        return

      scrollToMessage(returnToMessageId)
      highlightStore.highlight(returnToMessageId)
      setReturnToMessageId(null)
    },
    clear: () => setReturnToMessageId(null),
  }), [returnToMessageId, scrollToMessage, highlightStore])

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

  // Edit mode: the message's text goes into the composer under an "Editing"
  // banner, and sending saves it instead of posting a new message. Text changes go through
  // `_onChangeText` (defined further down), reached through a ref.
  const changeTextRef = useRef<(text: string) => void>(() => {})
  const clearReplyRef = useRef<() => void>(() => {})
  // The draft (what the user typed, never a message being edited): set aside while editing,
  // put back when the edit is saved or cancelled, and reported through `onDraftChange`.
  const isEditingRef = useRef(false)
  const stashedDraftRef = useRef('')
  const draftRef = useRef(props.initialText ?? '')
  const onDraftChange = props.onDraftChange
  const onDraftChangeRef = useRef(onDraftChange)
  useInsertionEffect(() => {
    onDraftChangeRef.current = onDraftChange
  })
  const notifyDraft = useCallback((draft: string) => {
    if (isEditingRef.current || draft === draftRef.current)
      return
    draftRef.current = draft
    onDraftChangeRef.current?.(draft)
  }, [])

  const startEdit = useCallback((message: TMessage) => {
    clearReplyRef.current()
    if (!isEditingRef.current)
      stashedDraftRef.current = textStore.get()
    isEditingRef.current = true
    setEditingMessage(message)
    changeTextRef.current(message.text ?? '')
    focusComposer()
  }, [focusComposer, textStore])

  /** Leaves edit mode and gives the composer back the draft from before it. */
  const restoreDraft = useCallback(() => {
    isEditingRef.current = false
    const draft = stashedDraftRef.current
    stashedDraftRef.current = ''
    changeTextRef.current(draft)
  }, [])

  const stopEdit = useCallback(() => {
    setEditingMessage(null)
    restoreDraft()
  }, [restoreDraft])

  useInsertionEffect(() => {
    cancelEdit.current = () => {
      if (editingMessage)
        stopEdit()
    }
  })

  // A group is any chat with more than one other sender; avatars and sender names show
  // only there.
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

  // Who reacted, for the avatars in a reaction pill: the senders of the loaded messages and you.
  // Read through a ref, so the lookup itself never changes and no row re-renders for it.
  const usersById = useMemo(() => {
    const map = new Map<string | number, User>()
    for (const message of messages)
      if (message.user)
        map.set(message.user._id, message.user)
    if (user && (user as Partial<User>)._id != null)
      map.set((user as User)._id, user as User)
    return map
  }, [messages, user])
  const usersByIdRef = useRef(usersById)
  useInsertionEffect(() => {
    usersByIdRef.current = usersById
  })
  const getUserFromMessages = useCallback((id: string | number) => usersByIdRef.current.get(id), [])

  // Reactions turn on by themselves once the app can apply them.
  // The expand button opens the built-in emoji grid unless the app passes its own (or `null`).
  const resolvedReactions = useMemo(() => reactions
    ? {
      ...reactions,
      isEnabled: reactions.isEnabled ?? !!reactions.onReactionPress,
      getUser: reactions.getUser ?? getUserFromMessages,
      isGroupChat,
      renderExpandedPicker: reactions.renderExpandedPicker === undefined
        ? renderDefaultExpandedPicker
        : reactions.renderExpandedPicker,
    }
    : undefined
  , [reactions, getUserFromMessages, isGroupChat])

  // The app's callbacks are read through a ref, so an inline arrow does not hand every row a
  // new `messageActions` (and re-render it) on each parent render.
  const actionCallbacksRef = useRef({ onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage, onForwardMessages, onDeleteMessages })
  useInsertionEffect(() => {
    actionCallbacksRef.current = { onEditMessage, onDeleteMessage, onForwardMessage, onPinMessage, onForwardMessages, onDeleteMessages }
  })
  const hasPin = !!onPinMessage
  const hasEdit = !!onEditMessage
  const hasDelete = !!onDeleteMessage || !!onDeleteMessages
  const hasForward = !!onForwardMessage || !!onForwardMessages
  const hasClipboard = !!getClipboard()
  // Selecting is only offered when a selection can be acted on.
  const canSelect = hasClipboard || hasDelete || hasForward

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
    const startSelection = (message: TMessage) => {
      Keyboard.dismiss()
      composerPanels.close()
      selectionStore.start(message._id)
    }
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
        onForward: hasForward
          ? m => {
            const { onForwardMessage, onForwardMessages } = actionCallbacksRef.current
            if (onForwardMessage)
              onForwardMessage(m)
            else
              onForwardMessages?.([m])
          }
          : undefined,
        onSelect: canSelect ? startSelection : undefined,
        onPin: hasPin ? m => actionCallbacksRef.current.onPinMessage?.(m) : undefined,
        onDelete: hasDelete
          ? m => {
            if (editingMessage?._id === m._id)
              stopEdit()
            const { onDeleteMessage, onDeleteMessages } = actionCallbacksRef.current
            if (onDeleteMessage)
              onDeleteMessage(m)
            else
              onDeleteMessages?.([m])
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
    canSelect,
    composerPanels,
    selectionStore,
  ])

  useEffect(() => {
    mediaController.setScroller(scrollToMessage)
    return () => mediaController.setScroller(null)
  }, [mediaController, scrollToMessage])

  // The greeting goes out like any typed message; `_onSend` is defined further down.
  const sendRef = useRef<(messages: TMessage[]) => void>(() => {})
  const sendGreeting = useCallback((greeting: string) => {
    sendRef.current([{ text: greeting } as TMessage])
  }, [])
  // A spinner replaces the empty-chat card while history loads, and only over an empty list:
  // messages already passed stay visible.
  const isHistoryLoading = !!props.isLoading && messages.length === 0
  const isChatEmptyShown = messages.length === 0 && props.renderChatEmpty === undefined && !props.isLoading

  const isNowPlayingBarEnabled = mediaPlayback?.isNowPlayingBarEnabled ?? true
  const isFloatingRoundNoteEnabled = mediaPlayback?.isFloatingRoundNoteEnabled ?? true

  // The wallpaper and the composer paint with the chat's first frame; the message list, by far the
  // heaviest part, mounts in the frame after, so opening a chat never shows an empty screen while
  // its messages are built.
  const [isListMounted, setIsListMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsListMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const renderMessages = useMemo(() => {
    // The composer's props stay out of the list: whatever reaches `MessagesContainer` is handed
    // to every row, and `Item` compares each prop by reference, so a consumer's inline `onSend`
    // or the controlled `text` changing on a keystroke re-rendered every message on screen.
    const {
      messagesContainerStyle,
      /* eslint-disable @typescript-eslint/no-unused-vars */
      text: _text,
      initialText: _initialText,
      onDraftChange: _onDraftChange,
      onSend: _onSend,
      textInputProps: _textInputProps,
      textInputRef: _textInputRef,
      messageIdGenerator: _messageIdGenerator,
      minInputToolbarHeight: _minInputToolbarHeight,
      minComposerHeight: _minComposerHeight,
      maxComposerHeight: _maxComposerHeight,
      isSendButtonAlwaysVisible: _isSendButtonAlwaysVisible,
      isMultiline: _isMultiline,
      renderInputToolbar: _renderInputToolbar,
      renderComposer: _renderComposer,
      renderActions: _renderActions,
      renderSend: _renderSend,
      renderAccessory: _renderAccessory,
      renderChatFooter: _renderChatFooter,
      onPressActionButton: _onPressActionButton,
      actions: _actions,
      actionSheetOptionTintColor: _actionSheetOptionTintColor,
      emojiKeyboard: _emojiKeyboard,
      attachments: _attachments,
      keyboardProviderProps: _keyboardProviderProps,
      keyboardAvoidingViewProps: _keyboardAvoidingViewProps,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...messagesContainerProps
    } = props

    return (
      <View style={[stylesCommon.fill, messagesContainerStyle]}>
        {isNowPlayingBarEnabled && (
          <NowPlayingBar getSenderName={getSenderName} onPressTitle={scrollToMessage} />
        )}
        {/* The list's own area, so the floating round note docks to it and
            not over the "now playing" bar above. */}
        <View style={stylesCommon.fill}>
          <PageDownReturnContext.Provider value={pageDownReturn}>
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
          </PageDownReturnContext.Provider>
          {isChatEmptyShown && (
            <View style={styles.emptyOverlay} pointerEvents='box-none'>
              <ChatEmpty greeting={emptyChatGreeting} onPressGreeting={sendGreeting} />
            </View>
          )}
          <ChatLoadingOverlay isVisible={isHistoryLoading} />
          {isFloatingRoundNoteEnabled && <FloatingRoundNote />}
        </View>
        {renderComponentOrElement(renderChatFooter, {})}
        <ChatOverlaySlot />
      </View>
    )
  }, [
    isTyping,
    messages,
    props,
    isInverted,
    messagesContainerRef,
    renderChatFooter,
    replyForList,
    pageDownReturn,
    isNowPlayingBarEnabled,
    isFloatingRoundNoteEnabled,
    getSenderName,
    scrollToMessage,
    resolvedMessageActions,
    resolvedReactions,
    isAvatarVisible,
    isUsernameVisible,
    isChatEmptyShown,
    isHistoryLoading,
    emptyChatGreeting,
    sendGreeting,
  ])

  const notifyInputTextReset = useCallback(() => {
    props.textInputProps?.onChangeText?.('')
  }, [props.textInputProps])

  const resetInputToolbar = useCallback(() => {
    clearInput(textInputRef)

    notifyInputTextReset()

    textStore.set(getTextFromProp(''))
    notifyDraft('')
  }, [
    textStore,
    getTextFromProp,
    textInputRef,
    notifyInputTextReset,
    notifyDraft,
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
        restoreDraft()
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
    [messageIdGenerator, onSend, user, resetInputToolbar, scrollToBottom, replyMessage, clearReply, editingMessage, restoreDraft]
  )

  const _onChangeText = useCallback(
    (text: string) => {
      props.textInputProps?.onChangeText?.(text)

      // Only set state if it's not being overridden by a prop.
      if (props.text === undefined)
        textStore.set(text)
      notifyDraft(text)
    },
    [props.text, props.textInputProps, notifyDraft, textStore]
  )
  useInsertionEffect(() => {
    changeTextRef.current = _onChangeText
    sendRef.current = messages => _onSend(messages, false)
    clearReplyRef.current = () => {
      if (replyMessage)
        clearReply()
    }
  })

  // Hints for a feature that was asked for but cannot work without its optional peer.
  const isRequested = (config: boolean | { isEnabled?: boolean } | undefined) =>
    config === true || (typeof config === 'object' && config.isEnabled === true)
  const isAudioRecordingRequested = isRequested(props.audioRecording)
  const isVideoRecordingRequested = isRequested(props.videoRecording)
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
  const {
    ref: keyboardOffsetRef,
    onLayout: measureKeyboardOffset,
    keyboardVerticalOffset,
    isMeasured: isKeyboardOffsetMeasured,
  } = useKeyboardVerticalOffset()

  // Reveal only once the real offset has been measured, not just once the layout
  // event that kicked off measuring it has fired - `isInitialized` alone let the
  // toolbar paint for a frame at the pre-measurement seed, which is offset 0 for
  // any chat that isn't full-screen. See `useKeyboardVerticalOffset` (#12).
  const isReady = isInitialized && isKeyboardOffsetMeasured

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
      textStore.set(getTextFromProp(initialText ?? ''))
    },
    [isInitialized, initialText, notifyInputTextReset, getTextFromProp, measureKeyboardOffset, textStore]
  )

  const copySelection = useCallback((selected: TMessage[]) => {
    const text = selected.map(message => message.text).filter(Boolean).join('\n\n')
    if (text)
      getClipboard()?.setString(text)
    selectionStore.clear()
  }, [selectionStore])

  const forwardSelection = useMemo(() => {
    if (!hasForward)
      return undefined
    return (selected: TMessage[]) => {
      const { onForwardMessage, onForwardMessages } = actionCallbacksRef.current
      if (onForwardMessages)
        onForwardMessages(selected)
      else
        selected.forEach(message => onForwardMessage?.(message))
      selectionStore.clear()
    }
  }, [hasForward, selectionStore])

  const deleteSelection = useMemo(() => {
    if (!hasDelete)
      return undefined
    return (selected: TMessage[]) => {
      if (editingMessage && selected.some(message => message._id === editingMessage._id))
        stopEdit()
      const { onDeleteMessage, onDeleteMessages } = actionCallbacksRef.current
      if (onDeleteMessages)
        onDeleteMessages(selected)
      else
        selected.forEach(message => onDeleteMessage?.(message))
      selectionStore.clear()
    }
  }, [hasDelete, editingMessage, stopEdit, selectionStore])

  // The composer's send keeps one identity: it is an event handler, and a new one each time
  // the app's `onSend` or the reply/edit state changed re-rendered the whole composer.
  const onSendRef = useRef(_onSend)
  useInsertionEffect(() => {
    onSendRef.current = _onSend
  })
  const composerOnSend = useCallback((messages?: TMessage[], shouldResetInputToolbar?: boolean) =>
    onSendRef.current(messages, shouldResetInputToolbar)
  , [])

  const composerTextInputProps = useMemo(() => ({
    ...textInputProps,
    onChangeText: _onChangeText,
    ref: textInputRef,
  }), [textInputProps, _onChangeText, textInputRef])

  const isSelectionBarShown = isSelecting && renderSelectionBar !== null
  const inputToolbarFragment = useMemo(() => {
    // The selection bar takes the composer's place (below), and needs `messages`, which this
    // memo is kept clear of.
    if (isSelectionBarShown)
      return null

    const inputToolbarProps = {
      ...props,
      onSend: composerOnSend,
      textInputProps: composerTextInputProps,
      // Reply preview props
      replyMessage,
      onClearReply: clearReply,
      editMessage: editingMessage,
      onCancelEdit: stopEdit,
      renderReplyPreview,
      replyPreviewContainerStyle,
      replyPreviewTextStyle,
    }

    return (
      <ComposerHost
        textStore={textStore}
        controlledText={props.text}
        render={renderInputToolbar}
        props={inputToolbarProps}
      />
    )
  }, [
    composerOnSend,
    textStore,
    props,
    renderInputToolbar,
    composerTextInputProps,
    replyMessage,
    clearReply,
    editingMessage,
    stopEdit,
    renderReplyPreview,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
    isSelectionBarShown,
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
      textStore.set(props.text)
  }, [props.text, textStore])

  return (
    <ChatContext.Provider value={contextValues}>
      <View
        testID={TEST_ID.WRAPPER}
        ref={keyboardOffsetRef}
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
          keyboardVerticalOffset={keyboardVerticalOffset}
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
              <MediaTransferContext.Provider value={mediaTransferController}>
                <MessageHighlightContext.Provider value={highlightStore}>
                  <MessageSelectionContext.Provider value={selectionStore}>
                    <ComposerPanelsContext.Provider value={composerPanels}>
                      <MediaGalleryContext.Provider value={mediaGallery}>
                        <ChatOverlayProvider>
                          {isListMounted ? renderMessages : <View style={stylesCommon.fill} />}
                          {isSelectionBarShown
                            ? (
                              <ChatSelectionBar<TMessage>
                                store={selectionStore}
                                messages={messages}
                                canCopy={hasClipboard}
                                onCopy={copySelection}
                                onForward={forwardSelection}
                                onDelete={deleteSelection}
                                renderSelectionBar={renderSelectionBar}
                              />
                            )
                            : inputToolbarFragment}
                          <MediaViewerHost gallery={mediaGallery} />
                        </ChatOverlayProvider>
                      </MediaGalleryContext.Provider>
                    </ComposerPanelsContext.Provider>
                  </MessageSelectionContext.Provider>
                </MessageHighlightContext.Provider>
              </MediaTransferContext.Provider>
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

export {
  ChatWrapper as Chat
}
