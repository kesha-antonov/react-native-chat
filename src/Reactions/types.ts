import React from 'react'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { IMessage, MessageReaction, User } from '../Models'

/**
 * Where a reaction is drawn: `'pill'` in the message's reactions, `'picker'` in the reactions
 * bar of the long-press overlay, `'flight'` the pick flying from the bar to the message.
 */
export type ReactionIconPlace = 'pill' | 'picker' | 'flight'

/**
 * Where a picked reaction lands: the center of its pill's emoji, relative to the bubble's box
 * (`pageX`, `pageY`).
 */
export interface ReactionTarget {
  x: number
  y: number
}

/** What `ReactionsProps.renderReactionIcon` is called with. */
export interface ReactionIconProps {
  /** The reaction's key: an entry of `emojis`, and `MessageReaction.emoji` on a message. */
  emoji: string
  place: ReactionIconPlace
  /**
   * The emoji's font size at that place (16 in a pill, 26 in the bar): an icon this size stands
   * in for the emoji. Scale it to taste; the box around it stays the emoji's.
   */
  size: number
  /** The text color at that place: the pill's count color, the menu's icon color in the bar. */
  color: string
  /** The current user reacted with it: their own pill, or a reaction they already picked in the bar. */
  isChosen: boolean
}

/**
 * Draws a reaction in place of its emoji text; `null` or `undefined` keeps the text for that key.
 * See `ReactionsProps.renderReactionIcon`.
 */
export type RenderReactionIcon = (props: ReactionIconProps) => React.ReactNode

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
  /** Who a user id is, for the avatars a pill shows in place of its count (see `ReactionsProps.getUser`). */
  getUser?: (userId: string | number) => User | undefined
  /** A group chat shows reactors' avatars only while a message has three reactions or fewer. */
  isGroupChat?: boolean
  /** `ReactionsProps.renderReactionIcon`, passed through so a custom display draws reactions the same way. */
  renderReactionIcon?: RenderReactionIcon
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
  /** Where the finger was, in window coordinates; the bar opens beside it. */
  touchX?: number
  touchY?: number
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
  /** `ReactionsProps.renderExpandedPicker`, passed through (the built-in grid by default). */
  renderExpandedPicker?: ((props: ExpandedReactionPickerProps) => React.ReactNode) | null
  /** `ReactionsProps.renderReactionIcon`, passed through. */
  renderReactionIcon?: RenderReactionIcon
  /**
   * Where the picked reaction's pill is, once the pick has been applied and the pill drawn;
   * pass it to `ContextMenu` so the pick flies there. Undefined until then.
   */
  reactionTarget?: ReactionTarget
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
  /**
   * Who reacted, by user id. As in Telegram, a pill shows the reactors' avatars instead of a count
   * in a one-to-one chat, and in a group while the message has three reactions or fewer - when
   * every reactor is known. Defaults to the senders of the loaded messages (and you); pass your
   * own to resolve people who have not written in them.
   */
  getUser?: (userId: string | number) => User | undefined
  /** @internal Set by `Chat`. */
  isGroupChat?: boolean
  /** Override the reactions-display component rendered below the bubble */
  renderReactions?: (props: MessageReactionsDisplayProps<TMessage>) => React.ReactNode
  /**
   * Override the emoji-picker component shown on long-press. The built-in one is a
   * reactions bar over the long-press menu, with the full emoji grid behind its chevron
   * (`renderExpandedPicker`); `ContextMenu` is exported to build your own on.
   */
  renderReactionPicker?: (props: ReactionPickerProps<TMessage>) => React.ReactNode
  /**
   * The expand button: the reactions bar ends in a chevron that grows the bar into a
   * panel showing this. Defaults to the built-in emoji grid (search, tabs, recents); pass your
   * own to replace it, or `null` to drop the expand button. Call `onSelect` with the pick.
   */
  renderExpandedPicker?: ((props: ExpandedReactionPickerProps) => React.ReactNode) | null
  /**
   * Draws a reaction as an icon instead of its emoji text, everywhere a reaction shows: the
   * pills on a message, the reactions bar of the long-press overlay and the pick flying from
   * one to the other. Called with the reaction's key (`emoji`), the place, the emoji's size and
   * text color there, and whether it is the current user's own (`isChosen`); return `null` to
   * keep the text for a key. Lets `emojis` hold keys of your own (`'like'`, `'question'`) drawn
   * with an icon set. The full emoji grid behind the chevron still shows emoji.
   */
  renderReactionIcon?: RenderReactionIcon
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
