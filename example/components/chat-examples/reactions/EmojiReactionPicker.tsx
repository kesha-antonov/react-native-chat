import React, { useCallback, useMemo } from 'react'
import {
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native'
import { ContextMenu, ExpandedReactionPickerProps, IMessage, ReactionPickerProps } from '@kesha-antonov/react-native-chat'

import {
  EmojiPickerSearchBarProps,
  FullEmojiPicker,
  FullEmojiPickerTheme,
} from './FullEmojiPicker'

const NO_ITEMS: never[] = []

/**
 * Example picker that adds a full emoji browser (react-native-emoji-chooser)
 * to the quick picker. Wire it through `reactions.renderReactionPicker`. This
 * lives in the example - the core library ships only the quick picker.
 *
 * It is built on the library's `ContextMenu` with no actions, so it gets the
 * same Telegram feel as the default picker: the chat blurs and dims,
 * `messagePreview` lifts the pressed bubble above it, the bar grows out of the
 * bubble's corner with its emojis rippling in, and a picked emoji flies to the
 * message. Its expand button grows the bar into a panel holding the full
 * browser, as Telegram's does.
 */
export interface EmojiReactionPickerProps<TMessage extends IMessage>
  extends ReactionPickerProps<TMessage> {
  pickerContainerStyle?: StyleProp<ViewStyle>
  pickerEmojiStyle?: StyleProp<TextStyle>
  isFullPickerEnabled?: boolean
  mode?: 'light' | 'dark'
  fullPickerLang?: string
  fullPickerColumnCount?: number
  fullPickerTheme?: FullEmojiPickerTheme
  fullPickerSearchBarProps?: EmojiPickerSearchBarProps
}

export const EmojiReactionPicker = <TMessage extends IMessage = IMessage>(
  props: EmojiReactionPickerProps<TMessage>
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
    isFullPickerEnabled,
    mode = 'light',
    fullPickerLang,
    fullPickerColumnCount,
    fullPickerTheme,
    fullPickerSearchBarProps,
  } = props

  const isDark = mode === 'dark'

  const renderExpandedPicker = useCallback(({ onSelect: onPick }: ExpandedReactionPickerProps) => (
    <FullEmojiPicker
      onSelect={onPick}
      mode={mode}
      lang={fullPickerLang}
      columnCount={fullPickerColumnCount}
      theme={fullPickerTheme}
      searchBarProps={fullPickerSearchBarProps}
    />
  ), [mode, fullPickerLang, fullPickerColumnCount, fullPickerTheme, fullPickerSearchBarProps])

  const reactions = useMemo(() => ({
    emojis,
    onSelect,
    containerStyle: [styles.picker, isDark && styles.pickerDark, pickerContainerStyle],
    emojiStyle: pickerEmojiStyle,
    renderExpandedPicker: isFullPickerEnabled ? renderExpandedPicker : undefined,
  }), [emojis, onSelect, isDark, pickerContainerStyle, pickerEmojiStyle, isFullPickerEnabled, renderExpandedPicker])

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

const styles = StyleSheet.create({
  picker: {
    backgroundColor: '#ffffff',
  },
  pickerDark: {
    backgroundColor: '#1f2937',
  },
})
