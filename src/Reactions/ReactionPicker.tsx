import React, { useMemo } from 'react'

import { ContextMenu } from '../components/ContextMenu'
import { IMessage } from '../Models'
import { ReactionPickerProps } from './types'

const NO_ITEMS: never[] = []

/**
 * Lightweight quick-picker shown on long-press: the chat dims while the pressed
 * message stays lit in place, and the reactions bar pops out
 * beside the finger. It is the context menu without actions, so both feel the same. Its expand
 * button opens the built-in emoji grid unless `reactions.renderExpandedPicker` says
 * otherwise.
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
    touchX,
    touchY,
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
    renderExpandedPicker: renderExpandedPicker ?? undefined,
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
      touchX={touchX}
      touchY={touchY}
      reactions={reactions}
      messagePreview={messagePreview}
    />
  )
}
