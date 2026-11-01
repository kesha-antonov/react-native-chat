import React, { ComponentProps } from 'react'
import {
  StyleProp,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native'

import { FetchLinkPreview, LinkPreviewProps } from '../components/LinkPreviewCard'
import { MessageReplyProps } from '../components/MessageReply'
import { MessageImageProps } from '../MessageImage'
import { MessageTextProps } from '../MessageText'
import {
  User,
  IMessage,
  LeftRightStyle,
  Reply,
  ReplyMessage,
  Omit,
  MessageVideoProps,
  MessageAudioProps,
  MessageFileProps,
  MessageLocationProps,
  MessageMenuItem,
  LinkPreview,
} from '../Models'
import { QuickRepliesProps } from '../QuickReplies'
import { ReactionsProps } from '../Reactions'
import { MessageReplyStyleProps } from '../Reply'
import { TimeProps } from '../Time'


export type RenderMessageImageProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageImageProps<TMessage>

export type RenderMessageVideoProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageVideoProps<TMessage>

export type RenderMessageAudioProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageAudioProps<TMessage>

export type RenderMessageLocationProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageLocationProps<TMessage>

export type RenderMessageFileProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageFileProps<TMessage>

export type RenderMessageTextProps<TMessage extends IMessage> = Omit<
  BubbleProps<TMessage>,
  'containerStyle' | 'wrapperStyle'
> &
  MessageTextProps<TMessage>

/** Props for message reply functionality in bubble */
export interface BubbleReplyProps<TMessage extends IMessage> extends MessageReplyStyleProps {
  /** Custom render for message reply; rendered on top of message content */
  renderMessageReply?: (props: MessageReplyProps<TMessage>) => React.ReactNode
  /** Callback when message reply is pressed */
  onPress?: (replyMessage: ReplyMessage, message: IMessage) => void
}

export interface BubbleProps<TMessage extends IMessage> {
  user?: User
  touchableProps?: ComponentProps<typeof Pressable>
  isUsernameVisible?: boolean
  isCustomViewBottom?: boolean
  isInverted?: boolean
  position: 'left' | 'right'
  currentMessage: TMessage
  nextMessage?: TMessage
  previousMessage?: TMessage
  containerStyle?: LeftRightStyle<ViewStyle>
  wrapperStyle?: LeftRightStyle<ViewStyle>
  textStyle?: LeftRightStyle<TextStyle>
  bottomContainerStyle?: LeftRightStyle<ViewStyle>
  tickStyle?: StyleProp<TextStyle>
  containerToNextStyle?: LeftRightStyle<ViewStyle>
  containerToPreviousStyle?: LeftRightStyle<ViewStyle>
  usernameStyle?: TextStyle
  quickReplyStyle?: StyleProp<ViewStyle>
  quickReplyTextStyle?: StyleProp<TextStyle>
  quickReplyContainerStyle?: StyleProp<ViewStyle>
  messageTextProps?: Partial<MessageTextProps<TMessage>>
  onPressMessage?: (context?: unknown, message?: unknown) => void
  onLongPressMessage?: (context?: unknown, message?: unknown) => void
  onQuickReply?: (replies: Reply[]) => void
  renderMessageImage?: (
    props: RenderMessageImageProps<TMessage>
  ) => React.ReactNode
  renderMessageVideo?: (
    props: RenderMessageVideoProps<TMessage>
  ) => React.ReactNode
  renderMessageAudio?: (
    props: RenderMessageAudioProps<TMessage>
  ) => React.ReactNode
  renderMessageLocation?: (
    props: RenderMessageLocationProps<TMessage>
  ) => React.ReactNode
  /** Custom file bubble for `IMessage.file`. */
  renderMessageFile?: (props: RenderMessageFileProps<TMessage>) => React.ReactNode
  renderMessageText?: (props: RenderMessageTextProps<TMessage>) => React.ReactNode
  renderCustomView?: (bubbleProps: BubbleProps<TMessage>) => React.ReactNode
  renderTime?: (timeProps: TimeProps<TMessage>) => React.ReactNode
  renderTicks?: (currentMessage: TMessage) => React.ReactNode
  renderUsername?: (user?: TMessage['user']) => React.ReactNode
  renderQuickReplySend?: () => React.ReactNode
  renderQuickReplies?: (
    quickReplies: QuickRepliesProps<TMessage>
  ) => React.ReactNode
  /** Message reply configuration */
  messageReply?: BubbleReplyProps<TMessage>
  /** Emoji reactions configuration */
  reactions?: ReactionsProps<TMessage>
  /** Long-press context menu actions (array or per-message function) */
  messageActions?: MessageMenuItem[] | ((message: TMessage) => MessageMenuItem[])
  /**
   * Controls whether the bubble attaches its tap / long-press gestures, which
   * `reactions` and `messageActions` rely on. Pass `false` (or a predicate
   * returning `false`) for messages that render natively interactive content -
   * a video player with its own controls, a map, a WebView - whose touches
   * must not compete with the bubble.
   * Note: with gestures off, that message can no longer open the reaction
   * picker or the context menu.
   * @default true
   */
  isMessageGestureEnabled?: boolean | ((message: TMessage) => boolean)
  /**
   * Fetches the web page preview for the first link in a message that has no
   * `linkPreview` of its own (e.g. from your server's Open Graph endpoint). Each URL is fetched
   * once per app run.
   */
  fetchLinkPreview?: FetchLinkPreview
  /** Custom web page preview under the text, or `null` to draw none. */
  renderLinkPreview?: ((props: LinkPreviewProps<TMessage>) => React.ReactNode) | null
  /** Called when a link preview is tapped, instead of opening its URL. */
  onPressLinkPreview?: (preview: LinkPreview & { url: string }, message: TMessage) => void
}
