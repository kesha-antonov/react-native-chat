import React, { useMemo } from 'react'

import { ContextMenu } from '../components/ContextMenu'
import { IMessage } from '../Models'
import { ReactionPickerProps } from './types'

const NO_ITEMS: never[] = []

/**
 * Lightweight quick-picker shown on long-press: the chat dims, the pressed
 * message is lifted above it, and a row of emojis springs out of the bubble's
 * edge. It is the context menu without actions, so both feel the same. For a
 * full emoji browser, pass a custom component via
 * `reactions.renderReactionPicker` (see the example app).
 */
export const ReactionPicker = <TMessage extends IMessage = IMessage>(
  props: ReactionPickerProps<TMessage>
): React.ReactElement | null => {
  const {
    visible,
    emojis,
    onSelect,
    onDismiss,
    position,
    pageX,
    pageY,
    bubbleWidth,
    bubbleHeight,
    pickerContainerStyle,
    pickerEmojiStyle,
    messagePreview,
    renderExpandedPicker,
  } = props

  const reactions = useMemo(() => ({
    emojis,
    onSelect,
    containerStyle: pickerContainerStyle,
    emojiStyle: pickerEmojiStyle,
    renderExpandedPicker,
  }), [emojis, onSelect, pickerContainerStyle, pickerEmojiStyle, renderExpandedPicker])

  return (
    <ContextMenu
      visible={visible}
      items={NO_ITEMS}
      onDismiss={onDismiss}
      position={position}
      pageX={pageX}
      pageY={pageY}
      bubbleWidth={bubbleWidth}
      bubbleHeight={bubbleHeight}
      reactions={reactions}
      messagePreview={messagePreview}
    />
  )
}
