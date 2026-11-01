import { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native'
import { SharedValue } from 'react-native-reanimated'

import { MessageReplyProps } from '../components/MessageReply'
import { ReplyPreviewProps } from '../components/ReplyPreview'
import { IMessage, ReplyMessage } from '../Models'

/**
 * Props for swipe-to-reply gesture behavior
 */
export interface SwipeToReplyProps<TMessage extends IMessage> {
  /**
   * Swipe a message to reply to it. Inside `Chat` this defaults to `true` whenever replying is
   * on (`reply.isEnabled`); a `Message` rendered on its own keeps it off unless set.
   */
  isEnabled?: boolean
  /** Direction to swipe for reply; default is 'left' (swipe left, icon appears on right, as in Telegram iOS) */
  direction?: 'left' | 'right'
  /** Callback when swipe to reply is triggered */
  onSwipe?: (message: TMessage) => void
  /** Custom render for swipe action indicator */
  renderAction?: (
    progress: SharedValue<number>,
    translation: SharedValue<number>,
    position: 'left' | 'right'
  ) => React.ReactNode
  /** Style for the swipe action container */
  actionContainerStyle?: StyleProp<ViewStyle>
}

/**
 * Props for reply preview shown above input toolbar
 */
export interface ReplyPreviewStyleProps {
  /** Style for reply preview container */
  containerStyle?: StyleProp<ViewStyle>
  /** Style for reply preview text */
  textStyle?: StyleProp<TextStyle>
  /** Style for reply preview image */
  imageStyle?: StyleProp<ImageStyle>
}

/**
 * Props for message reply display inside bubble
 */
export interface MessageReplyStyleProps {
  /** Style for message reply container */
  containerStyle?: StyleProp<ViewStyle>
  /** Style for message reply container on left side */
  containerStyleLeft?: StyleProp<ViewStyle>
  /** Style for message reply container on right side */
  containerStyleRight?: StyleProp<ViewStyle>
  /** Style for message reply image */
  imageStyle?: StyleProp<ImageStyle>
  /** Style for message reply text */
  textStyle?: StyleProp<TextStyle>
  /** Style for message reply text on left side */
  textStyleLeft?: StyleProp<TextStyle>
  /** Style for message reply text on right side */
  textStyleRight?: StyleProp<TextStyle>
}

/**
 * Grouped props for reply functionality
 */
export interface ReplyProps<TMessage extends IMessage> {
  /**
   * Replying as a whole: the "Reply" menu action and swipe-to-reply. Default `true`; `false`
   * removes both.
   */
  isEnabled?: boolean
  /**
   * Called when the user starts a reply, from the menu's "Reply" or a swipe. Use it with a
   * controlled `message` to set your own reply state.
   */
  onReply?: (message: TMessage) => void
  /** Reply message to show in input toolbar preview */
  message?: ReplyMessage | null
  /** Callback when reply is cleared */
  onClear?: () => void
  /**
   * Callback when the reply quote inside a bubble is pressed. Default: scroll to the quoted
   * message and flash it, as Telegram does.
   */
  onPress?: (replyMessage: ReplyMessage, message: IMessage) => void
  /** Custom render for reply preview in input toolbar */
  renderPreview?: (props: ReplyPreviewProps) => React.ReactNode
  /** Custom render for message reply inside bubble */
  renderMessageReply?: (props: MessageReplyProps<TMessage>) => React.ReactNode
  /** Swipe-to-reply configuration */
  swipe?: SwipeToReplyProps<TMessage>
  /** Reply preview styling */
  previewStyle?: ReplyPreviewStyleProps
  /** Message reply styling */
  messageStyle?: MessageReplyStyleProps
}
