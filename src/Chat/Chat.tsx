import React, {
  createRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  RefObject,
} from 'react'
import { TextInput, View } from 'react-native'
import { ChatContext } from '../ChatContext'
import { createComposerPanelsStore } from '../components/composerPanels'
import { MediaViewerHost } from '../components/mediaViewer/MediaViewerHost'
import { TextHighlightContext } from '../components/textHighlight'
import { TEST_ID } from '../Constant'
import { AnimatedList } from '../MessagesContainer'
import { IMessage, User } from '../Models'
import stylesCommon from '../styles'
import { renderComponentOrElement } from '../utils'
import { ChatBackground } from './ChatBackground'
import { ChatKeyboardAvoidingView } from './ChatKeyboardAvoidingView'
import { ChatMessageList } from './ChatMessageList'
import { ChatProviders } from './ChatProviders'
import { ChatSelectionBar } from './ChatSelectionBar'
import styles from './styles'
import { ChatProps } from './types'
import { useChatContextValue } from './useChatContextValue'
import { useChatMedia } from './useChatMedia'
import { useChatSelection } from './useChatSelection'
import { useComposerHandlers } from './useComposerHandlers'
import { useComposerState } from './useComposerState'
import { useInitialLayout } from './useInitialLayout'
import { useMessageActions } from './useMessageActions'
import { useMessageNavigation } from './useMessageNavigation'
import { useOptionalPeerHints } from './useOptionalPeerHints'
import { useIsGroupChat, useResolvedReactions } from './useResolvedReactions'

export function Chat<TMessage extends IMessage = IMessage> (
  props: ChatProps<TMessage>
) {
  const {
    messages = [],
    initialText = '',
    user = {},
    renderLoading,
    renderSelectionBar,
    isInverted = true,
    reply,
    reactions,
    isGroupChat: isGroupChatProp,
    isAvatarVisible: isAvatarVisibleProp,
    isUsernameVisible: isUsernameVisibleProp,
    renderAvatar,
    renderWallpaper,
  } = props

  const { mediaController, mediaTransferController, mediaGallery, messagesRef } = useChatMedia({
    messages,
    isInverted,
    mediaPlayback: props.mediaPlayback,
    mediaTransfer: props.mediaTransfer,
  })

  const { resolvedTheme, resolvedLabels, contextValues } = useChatContextValue(props)

  const messagesContainerRef = useMemo(
    () => props.messagesContainerRef || createRef<AnimatedList>(),
    [props.messagesContainerRef]
  ) as RefObject<AnimatedList>

  // Typed as a ref so the compiler knows reading `.current` in a callback is not a render input.
  const textInputRef = useMemo(
    () => props.textInputRef || createRef<React.ComponentRef<typeof TextInput>>(),
    [props.textInputRef]
  ) as RefObject<React.ComponentRef<typeof TextInput>>

  const [composerPanels] = useState(createComposerPanelsStore)
  const { selectionStore, isSelecting } = useChatSelection({
    messages,
    messagesRef,
    onSelectionChange: props.onSelectionChange,
  })

  const composer = useComposerState(props, textInputRef)
  const { textStore, editStore, isReplyEnabled, startReply, handleSwipeToReply, startEdit, stopEdit } = composer

  const { highlightStore, getSenderName, scrollToMessage, jumpToQuotedMessage, pageDownReturn } = useMessageNavigation({
    messagesRef,
    messagesContainerRef,
    mediaController,
  })

  useImperativeHandle(props.chatRef, () => ({
    scrollToMessage: (messageId, options) => {
      messagesContainerRef.current?.scrollToKey({
        key: String(messageId),
        animated: options?.animated ?? true,
        viewPosition: options?.viewPosition ?? 0.5,
      })
      if (options?.isHighlighted)
        highlightStore.highlight(messageId)
    },
  }), [messagesContainerRef, highlightStore])

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

  const userId = (user as Partial<User> | undefined)?._id
  const isGroupChat = useIsGroupChat(messages, userId, isGroupChatProp)
  const isAvatarVisible = isAvatarVisibleProp ?? (renderAvatar ? true : isGroupChat)
  const isUsernameVisible = isUsernameVisibleProp ?? isGroupChat
  const resolvedReactions = useResolvedReactions({ reactions, messages, user, isGroupChat })

  const {
    resolvedMessageActions,
    actionCallbacksRef,
    hasClipboard,
    copySelection,
    forwardSelection,
    deleteSelection,
  } = useMessageActions({
    props,
    userId,
    resolvedLabels,
    isReplyEnabled,
    startReply,
    startEdit,
    stopEdit,
    editStore,
    composerPanels,
    selectionStore,
  })

  const { inputToolbarFragment, sendGreeting, notifyInputTextReset } = useComposerHandlers({
    ...composer,
    props,
    textInputRef,
    messagesContainerRef,
    actionCallbacksRef,
  })

  // The wallpaper and the composer paint with the chat's first frame; the message list, by far the
  // heaviest part, mounts in the frame after, so opening a chat never shows an empty screen while
  // its messages are built.
  const [isListMounted, setIsListMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsListMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useOptionalPeerHints(props.audioRecording, props.videoRecording)

  const { isReady, keyboardOffsetRef, keyboardVerticalOffset, onInitialLayoutViewLayout } = useInitialLayout({
    initialText,
    textStore,
    getTextFromProp: composer.getTextFromProp,
    notifyInputTextReset,
  })

  const isSelectionBarShown = isSelecting && renderSelectionBar !== null

  const highlightText = props.highlightText
  const highlightTextStyle = props.highlightTextStyle
  const textHighlight = useMemo(
    () => (highlightText?.trim() ? { text: highlightText, style: highlightTextStyle } : null),
    [highlightText, highlightTextStyle]
  )

  return (
    <ChatContext.Provider value={contextValues}>
      <TextHighlightContext.Provider value={textHighlight}>
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
              <ChatProviders
                mediaController={mediaController}
                mediaTransferController={mediaTransferController}
                highlightStore={highlightStore}
                selectionStore={selectionStore}
                composerPanels={composerPanels}
                mediaGallery={mediaGallery}
              >
                <ChatMessageList<TMessage>
                  isMounted={isListMounted}
                  chatProps={props}
                  messages={messages}
                  isInverted={isInverted}
                  messagesContainerRef={messagesContainerRef}
                  replyForList={replyForList}
                  pageDownReturn={pageDownReturn}
                  getSenderName={getSenderName}
                  scrollToMessage={scrollToMessage}
                  resolvedMessageActions={resolvedMessageActions}
                  resolvedReactions={resolvedReactions}
                  isAvatarVisible={isAvatarVisible}
                  isUsernameVisible={isUsernameVisible}
                  sendGreeting={sendGreeting}
                />
                {isSelectionBarShown && (
                  <ChatSelectionBar<TMessage>
                    store={selectionStore}
                    messages={messages}
                    canCopy={hasClipboard}
                    onCopy={copySelection}
                    onForward={forwardSelection}
                    onDelete={deleteSelection}
                    renderSelectionBar={renderSelectionBar}
                  />
                )}
                {/*
                The selection bar takes the composer's place, but the composer stays
                mounted under it, out of layout: leaving selection used to rebuild the
                whole composer (its recorder, panels and animations) from scratch.
                collapsable={false} keeps this view's native node stable while its
                `display` flips (see the note on TEST_ID.CONTENT above).
              */}
                <View collapsable={false} style={isSelectionBarShown ? styles.composerAway : undefined}>
                  {inputToolbarFragment}
                </View>
                <MediaViewerHost gallery={mediaGallery} />
              </ChatProviders>
            </View>
            {!isReady && renderComponentOrElement(renderLoading, {})}
          </ChatKeyboardAvoidingView>
        </View>
      </TextHighlightContext.Provider>
    </ChatContext.Provider>
  )
}
