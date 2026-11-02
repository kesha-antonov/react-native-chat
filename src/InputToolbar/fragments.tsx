import React, { useCallback, useMemo } from 'react'

import { ReplyPreview, ReplyPreviewProps } from '../components/ReplyPreview'
import { Composer, ComposerProps } from '../Composer'
import { TextSelection } from '../emoji/textEditing'
import { IMessage } from '../Models'
import { Send } from '../Send'
import { renderComponentOrElement } from '../utils'
import { InputToolbarProps } from './types'

type TextInputProps = NonNullable<ComposerProps['textInputProps']>

/** The text field, built-in or `renderComposer`. */
export function useComposerFragment<TMessage extends IMessage> (
  props: InputToolbarProps<TMessage>,
  onComposerFocus: () => void,
  rememberSelection: (selection: TextSelection) => void
) {
  const renderComposer = props.renderComposer
  return useMemo(() => {
    const textInputProps = props.textInputProps
    // The composer reports its caret, so an emoji lands where it is, and its focus, which
    // brings the system keyboard back in the emoji panel's place.
    const composerProps = {
      ...props,
      textInputProps: {
        ...textInputProps,
        onFocus: (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
          onComposerFocus()
          textInputProps?.onFocus?.(event)
        },
        onSelectionChange: (event: Parameters<NonNullable<TextInputProps['onSelectionChange']>>[0]) => {
          rememberSelection(event.nativeEvent.selection)
          textInputProps?.onSelectionChange?.(event)
        },
      },
    } as ComposerProps

    if (renderComposer)
      return renderComponentOrElement(renderComposer, composerProps)

    return <Composer {...composerProps} />
  }, [renderComposer, props, onComposerFocus, rememberSelection])
}

/** The send button, built-in or `renderSend`. */
export function useSendFragment<TMessage extends IMessage> (props: InputToolbarProps<TMessage>) {
  const renderSend = props.renderSend
  return useMemo(() => {
    if (renderSend)
      return renderComponentOrElement(renderSend, props)

    return <Send {...props} />
  }, [renderSend, props])
}

/** Whatever `renderAccessory` draws under the island. */
export function useAccessoryFragment<TMessage extends IMessage> (props: InputToolbarProps<TMessage>) {
  const renderAccessory = props.renderAccessory
  return useMemo(() => {
    if (!renderAccessory)
      return null

    return renderComponentOrElement(renderAccessory, props)
  }, [renderAccessory, props])
}

/** The reply or editing banner on top of the island. */
export function useReplyPreviewFragment<TMessage extends IMessage> (props: InputToolbarProps<TMessage>) {
  const {
    replyMessage,
    onClearReply,
    editMessage,
    onCancelEdit,
    renderReplyPreview: renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  } = props

  const handleClearReply = useCallback(() => {
    onClearReply?.()
  }, [onClearReply])

  const handleCancelEdit = useCallback(() => {
    onCancelEdit?.()
  }, [onCancelEdit])

  return useMemo(() => {
    const isEditing = !!editMessage
    const previewMessage = editMessage ?? replyMessage
    if (!previewMessage)
      return null

    const replyPreviewProps: ReplyPreviewProps = {
      replyMessage: previewMessage,
      onClearReply: isEditing ? handleCancelEdit : handleClearReply,
      mode: isEditing ? 'edit' : 'reply',
      containerStyle: replyPreviewContainerStyle,
      textStyle: replyPreviewTextStyle,
    }

    if (renderReplyPreviewProp)
      return renderComponentOrElement(renderReplyPreviewProp, replyPreviewProps)

    // Keyed by mode, so switching between replying and editing plays the banner in again.
    return <ReplyPreview key={isEditing ? 'edit' : 'reply'} {...replyPreviewProps} />
  }, [
    replyMessage,
    editMessage,
    handleClearReply,
    handleCancelEdit,
    renderReplyPreviewProp,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  ])
}
