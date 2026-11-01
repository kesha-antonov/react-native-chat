import { RefObject } from 'react'
import {
  FlatListProps,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import Animated, { ScrollEvent } from 'react-native-reanimated'

import { DayProps } from '../Day'
import { LoadEarlierMessagesProps } from '../LoadEarlierMessages'
import { MessageProps } from '../Message'
import { User, IMessage, Reply } from '../Models'
import { ReactionsProps } from '../Reactions'
import { ReplyProps } from '../Reply'
import { TypingIndicatorProps } from '../TypingIndicator/types'

/** Animated FlatList created from react-native-gesture-handler's FlatList */
const RNGHAnimatedFlatList = Animated.createAnimatedComponent(FlatList)

/**
 * Typed AnimatedFlatList component that preserves generic type parameter.
 * Uses react-native-gesture-handler's FlatList which respects keyboardShouldPersistTaps.
 */
export const AnimatedFlatList = RNGHAnimatedFlatList as <TMessage>(
  props: FlatListProps<TMessage> & {
    ref?: RefObject<FlatList<TMessage>>
  }
) => React.ReactElement

export type AnimatedListProps<TMessage extends IMessage = IMessage> = Partial<
  Omit<FlatListProps<TMessage>, 'onScroll'> & {
    onScroll?: (event: ScrollEvent) => void
  }
>

export type AnimatedList<TMessage> = FlatList<TMessage>

export interface MessagesContainerProps<TMessage extends IMessage = IMessage>
  extends Omit<TypingIndicatorProps, 'style'> {
  /** Ref for the FlatList message container */
  forwardRef?: RefObject<AnimatedList<TMessage>>
  /** Messages to display */
  messages?: TMessage[]
  /** Format to use for rendering dates; default is 'll' */
  dateFormat?: string
  /** Format to use for rendering relative times */
  dateFormatCalendar?: object
  /** User sending the messages: { _id, name, avatar } */
  user?: User
  /** Additional props for FlatList */
  listProps?: AnimatedListProps<TMessage>
  /**
   * Render messages with `@shopify/flash-list` (v2) instead of `FlatList`.
   * Requires the optional `@shopify/flash-list` peer dependency and the New
   * Architecture; falls back to `FlatList` with a warning when it is missing.
   * FlashList recycles rows, which removes the `VirtualizedList: You have a
   * large list that is slow to update` warning on long histories.
   * @default false
   */
  isFlashListEnabled?: boolean
  /** Reverses display order of messages; default is true */
  isInverted?: boolean
  /**
   * Where the bubbles sit while the whole conversation fits on screen. Once it is taller
   * than the list this has no effect - the messages fill it either way.
   *
   * - `false` (default) - bottom, the usual chat look.
   * - `true` - top.
   * - `'auto'` - top while the keyboard is closed, bottom while it is open, so a short
   *   conversation starts under the header and re-anchors above the keyboard when the
   *   composer is focused.
   *
   * Works with both `isInverted` settings. Ignored when `isFlashListEnabled` is set.
   */
  isAlignedTop?: boolean | 'auto'
  /** Show the scroll-to-bottom button once scrolled away from the newest message; default is true */
  isScrollToBottomEnabled?: boolean
  /**
   * Count incoming messages that arrive while scrolled up, in a badge on the scroll-to-bottom
   * button; default is true
   */
  isScrollToBottomBadgeEnabled?: boolean
  /** Scroll to bottom wrapper style */
  scrollToBottomStyle?: StyleProp<ViewStyle>
  /** Scroll to bottom content style */
  scrollToBottomContentStyle?: StyleProp<ViewStyle>
  /** Distance from bottom before showing scroll to bottom button */
  scrollToBottomOffset?: number
  /**
   * What to show while there are no messages. `Chat` shows a greeting card by default
   * ("No messages here yet..." and a 👋 that sends itself); pass your own render function to
   * replace it, or `null` for nothing.
   */
  renderChatEmpty?: (() => React.ReactNode) | null
  /**
   * The first message the user has not read yet. An "Unread Messages" bar is drawn above
   * it, and the chat opens scrolled so the bar is at the top. Keep it fixed while the chat is
   * open (the bar stays until you leave), e.g. from the unread count when it opened.
   */
  firstUnreadMessageId?: string | number | null
  /** Custom "Unread Messages" bar, or `null` to only scroll to the first unread message. */
  renderUnreadSeparator?: (() => React.ReactNode) | null
  /** Custom footer component on the ListView, e.g. 'User is typing...' */
  renderFooter?: (props: MessagesContainerProps<TMessage>) => React.ReactNode
  /** Custom message container */
  renderMessage?: (props: MessageProps<TMessage>) => React.ReactElement
  /** Custom day above a message */
  renderDay?: (props: DayProps) => React.ReactNode
  /** Custom "Load earlier messages" button */
  renderLoadEarlier?: (props: LoadEarlierMessagesProps) => React.ReactNode
  /** Custom typing indicator */
  renderTypingIndicator?: () => React.ReactNode
  /** Scroll to bottom custom component */
  scrollToBottomComponent?: () => React.ReactNode
  /** Callback when quick reply is sent */
  onQuickReply?: (replies: Reply[]) => void
  /** Props to pass to the LoadEarlierMessages component. The LoadEarlierMessages button is only visible when isAvailable is true. Includes isAvailable (controls button visibility), isInfiniteScrollEnabled (infinite scroll up when reach the top of messages container, automatically call onPress function if it exists - not yet supported for web), onPress (callback when button is pressed), isLoading (display loading indicator), label (override default "Load earlier messages" text), and styling props (containerStyle, wrapperStyle, textStyle, activityIndicatorStyle, activityIndicatorColor, activityIndicatorSize). */
  loadEarlierMessagesProps?: LoadEarlierMessagesProps
  /** Style for TypingIndicator component */
  typingIndicatorStyle?: StyleProp<ViewStyle>
  /** Whether incoming messages leave room for an avatar; the typing bubble lines up with them */
  isAvatarVisible?: boolean
  /** Enable animated day label that appears on scroll; default is true */
  isDayAnimationEnabled?: boolean
  /** Reply functionality configuration */
  reply?: ReplyProps<TMessage>
  /** Emoji reactions configuration */
  reactions?: ReactionsProps<TMessage>
}

export interface State {
  showScrollBottom: boolean
  hasScrolled: boolean
}

interface ViewLayout {
  x: number
  y: number
  width: number
  height: number
}

// `dayKey` is the local calendar day as a sortable integer (YYYYMMDD-ish). It is
// computed once, on the JS side, where a Date is already in hand - the worklet that
// compares entries runs on every cell layout, and constructing Dates there to compare
// them allocated two objects per entry per layout.
export type DaysPositions = { [key: string]: ViewLayout & { createdAt: number, dayKey: number } }
