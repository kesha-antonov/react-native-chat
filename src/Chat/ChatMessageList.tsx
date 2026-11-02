import React, { RefObject } from 'react'
import { View } from 'react-native'
import { ChatEmpty } from '../components/ChatEmpty'
import { ChatLoadingOverlay } from '../components/ChatLoadingOverlay'
import { ChatOverlaySlot } from '../components/ChatOverlay'
import { FloatingRoundNote } from '../components/FloatingRoundNote'
import { NowPlayingBar } from '../components/NowPlayingBar'
import { AnimatedList, MessagesContainer, MessagesContainerProps } from '../MessagesContainer'
import { PageDownReturn, PageDownReturnContext } from '../MessagesContainer/pageDownReturn'
import { IMessage, MessageMenuItem } from '../Models'
import stylesCommon from '../styles'
import { renderComponentOrElement } from '../utils'
import styles from './styles'
import { ChatProps } from './types'

/**
 * The message list and what sits over it: the now-playing bar, the empty-chat card, the history
 * spinner, the floating round note and the app's footer. Until `isMounted`, an empty view holds
 * its place, so the list mounts a frame after the rest of the chat.
 */
export function ChatMessageList<TMessage extends IMessage> ({
  isMounted,
  chatProps: props,
  messages,
  isInverted,
  messagesContainerRef,
  replyForList,
  pageDownReturn,
  getSenderName,
  scrollToMessage,
  resolvedMessageActions,
  resolvedReactions,
  isAvatarVisible,
  isUsernameVisible,
  sendGreeting,
}: {
  isMounted: boolean
  chatProps: ChatProps<TMessage>
  messages: TMessage[]
  isInverted: boolean
  messagesContainerRef: RefObject<AnimatedList>
  replyForList: MessagesContainerProps<TMessage>['reply']
  pageDownReturn: PageDownReturn
  getSenderName: (messageId: string | number) => string | undefined
  scrollToMessage: (messageId: string | number) => void
  resolvedMessageActions: MessageMenuItem[] | ((message: TMessage) => MessageMenuItem[]) | undefined
  resolvedReactions: MessagesContainerProps<TMessage>['reactions']
  isAvatarVisible: boolean
  isUsernameVisible: boolean
  sendGreeting: (greeting: string) => void
}) {
  if (!isMounted)
    return <View style={stylesCommon.fill} />

  const { isTyping, renderChatFooter, emptyChatGreeting, mediaPlayback } = props

  // A spinner replaces the empty-chat card while history loads, and only over an empty list:
  // messages already passed stay visible.
  const isHistoryLoading = !!props.isLoading && messages.length === 0
  const isChatEmptyShown = messages.length === 0 && props.renderChatEmpty === undefined && !props.isLoading

  const isNowPlayingBarEnabled = mediaPlayback?.isNowPlayingBarEnabled ?? true
  const isFloatingRoundNoteEnabled = mediaPlayback?.isFloatingRoundNoteEnabled ?? true

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
}
