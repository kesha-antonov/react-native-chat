import React from 'react'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { MessageMenuItem } from '../../Models'

export interface ContextMenuReactions {
  emojis: string[]
  onSelect: (emoji: string) => void
  /** Reactions the current user has already picked; drawn smaller, in a circle. */
  selected?: string[]
  /** Style for the reactions bar. */
  containerStyle?: StyleProp<ViewStyle>
  /** Style for each emoji in the bar. */
  emojiStyle?: StyleProp<TextStyle>
  /** Extra content at the end of the bar. */
  renderAccessory?: () => React.ReactNode
  /**
   * The expand button: when set, the bar ends in a chevron that grows the bar into a
   * panel holding what this returns (a full emoji grid, say). Call `onSelect` with the pick.
   */
  renderExpandedPicker?: (props: { onSelect: (emoji: string) => void }) => React.ReactNode
}

export interface ContextMenuProps {
  visible: boolean
  items: MessageMenuItem[]
  /**
   * Called once the menu has closed itself (backdrop tap, a picked action or reaction) and its
   * exit animation has finished.
   */
  onDismiss: () => void
  position?: 'left' | 'right'
  pageX?: number
  pageY?: number
  bubbleWidth?: number
  bubbleHeight?: number
  /**
   * Where the finger was, in window coordinates. The menu opens beside it; without it
   * the menu opens beside the bubble's middle.
   */
  touchX?: number
  touchY?: number
  /** Optional reactions bar rendered above the menu. */
  reactions?: ContextMenuReactions
  /**
   * A copy of the pressed message, drawn above the scrim exactly where the message is (`pageX` /
   * `pageY`, `bubbleWidth` wide), so it stays lit above the scrim while the chat dims.
   * It follows the anchor if the message moves underneath.
   */
  messagePreview?: React.ReactNode
  /** Drawn above everything else in the overlay, e.g. a full emoji sheet. */
  children?: React.ReactNode
}

export interface Flight {
  emoji: string
  fromX: number
  fromY: number
}

export interface FlightTarget {
  toX: number
  toY: number
}
