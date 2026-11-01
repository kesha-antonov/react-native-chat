import React from 'react'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { IMessage, MessageReaction } from '../Models'

/** Props passed to the reactions display: the built-in one draws pills inside the bubble, a custom `renderReactions` one renders below it */
export interface MessageReactionsDisplayProps<TMessage extends IMessage> {
  message: TMessage
  reactions: MessageReaction[]
  currentUserId?: string | number
  position: 'left' | 'right'
  onReactionPress?: (emoji: string) => void
  containerStyle?: StyleProp<ViewStyle>
  reactionStyle?: StyleProp<ViewStyle>
  reactionActiveStyle?: StyleProp<ViewStyle>
  reactionTextStyle?: StyleProp<TextStyle>
  reactionCountStyle?: StyleProp<TextStyle>
  /**
   * Inline content after the last pill: `Bubble` passes an invisible copy of the message
   * time, so the time sits on the last row of pills when it fits.
   */
  trailing?: React.ReactNode
  /** Text sits above the pills, so they need no top inset of their own. */
  hasContentAbove?: boolean
}

/** Props passed to the default (or custom) reaction-picker component shown on long-press */
export interface ReactionPickerProps<TMessage extends IMessage> {
  visible: boolean
  message: TMessage
  emojis: string[]
  onSelect: (emoji: string) => void
  onDismiss: () => void
  position: 'left' | 'right'
  /** Horizontal screen-coordinate of the bubble's top-left corner */
  pageX?: number
  /** Vertical screen-coordinate of the bubble's top edge */
  pageY?: number
  /** Measured width of the bubble container */
  bubbleWidth?: number
  /** Measured height of the bubble container */
  bubbleHeight?: number
  pickerContainerStyle?: StyleProp<ViewStyle>
  pickerEmojiStyle?: StyleProp<TextStyle>
  /**
   * A copy of the pressed bubble to draw "lifted" above the picker's backdrop,
   * at `pageX` / `pageY` and `bubbleWidth` wide. While it is mounted the
   * original bubble is hidden, so the message appears to rise out of the list.
   * A custom picker can pass it to `ContextMenu`'s `messagePreview`, render it
   * itself, or ignore it - the original bubble then simply stays in place.
   */
  messagePreview?: React.ReactNode
  /** `ReactionsProps.renderExpandedPicker`, passed through. */
  renderExpandedPicker?: (props: ExpandedReactionPickerProps) => React.ReactNode
}

/** Props for the content of the expanded reactions panel. */
export interface ExpandedReactionPickerProps {
  /** Pick a reaction: the overlay closes and `onReactionPress` is called. */
  onSelect: (emoji: string) => void
}

/**
 * Top-level emoji-reactions configuration.
 * Pass this as the `reactions` prop to `<Chat />`.
 */
export interface ReactionsProps<TMessage extends IMessage> {
  /**
   * Enable emoji reactions on messages.
   * @default false
   */
  isEnabled?: boolean
  /**
   * Emoji options shown in the quick picker.
   * @default ['👍', '❤️', '😂', '😮', '😢', '👎']
   */
  emojis?: string[]
  /**
   * Called when the user selects an emoji in the picker or taps an existing
   * reaction pill.  Toggle logic is left to the consumer.
   */
  onReactionPress?: (message: TMessage, emoji: string) => void
  /** Override the reactions-display component rendered below the bubble */
  renderReactions?: (props: MessageReactionsDisplayProps<TMessage>) => React.ReactNode
  /**
   * Override the emoji-picker component shown on long-press.
   * Use this to provide a richer picker (e.g. a full emoji browser).
   * See the example app for a `react-native-emoji-chooser` integration.
   */
  renderReactionPicker?: (props: ReactionPickerProps<TMessage>) => React.ReactNode
  /**
   * Telegram's expand button. When set, the reactions bar ends in a chevron
   * that grows the bar into a panel (up to 300pt tall) showing what this
   * returns - typically a full emoji grid. Call `onSelect` with the pick.
   */
  renderExpandedPicker?: (props: ExpandedReactionPickerProps) => React.ReactNode
  /** Style for the container wrapping all reaction pills */
  containerStyle?: StyleProp<ViewStyle>
  /** Style applied to every inactive reaction pill */
  reactionStyle?: StyleProp<ViewStyle>
  /** Style applied to the current-user's active reaction pill */
  reactionActiveStyle?: StyleProp<ViewStyle>
  /** Style for the emoji text inside each pill */
  reactionTextStyle?: StyleProp<TextStyle>
  /** Style for the count label inside each pill */
  reactionCountStyle?: StyleProp<TextStyle>
  /** Style for the floating quick-picker panel */
  pickerContainerStyle?: StyleProp<ViewStyle>
  /** Style for each emoji button inside the quick picker */
  pickerEmojiStyle?: StyleProp<TextStyle>
}
