import { ViewStyle, LayoutChangeEvent } from 'react-native'

import { AvatarProps } from '../Avatar'
import { BubbleProps } from '../Bubble'
import { DayProps } from '../Day'
import { IMessage, User, LeftRightStyle } from '../Models'
import { ReactionsProps } from '../Reactions'
import { SwipeToReplyProps } from '../Reply'
import { SystemMessageProps } from '../SystemMessage'

export interface MessageProps<TMessage extends IMessage> {
  isUserAvatarVisible?: boolean
  /**
   * Whether incoming messages carry an avatar. `Chat` turns them on for group chats only
   * (see `isGroupChat`); a `Message` rendered on its own shows them unless this is `false`.
   */
  isAvatarVisible?: boolean
  position: 'left' | 'right'
  currentMessage: TMessage
  nextMessage?: TMessage
  previousMessage?: TMessage
  user: User
  isInverted?: boolean
  containerStyle?: LeftRightStyle<ViewStyle>
  renderBubble?: (props: BubbleProps<TMessage>) => React.ReactNode
  renderDay?: (props: DayProps) => React.ReactNode
  renderSystemMessage?: (props: SystemMessageProps<TMessage>) => React.ReactNode
  renderAvatar?: (props: AvatarProps<TMessage>) => React.ReactNode
  onMessageLayout?: (event: LayoutChangeEvent) => void
  /** Swipe to reply configuration */
  swipeToReply?: SwipeToReplyProps<TMessage>
  /** Emoji reactions configuration */
  reactions?: ReactionsProps<TMessage>
}
