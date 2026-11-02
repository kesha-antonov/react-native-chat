import { IMessage } from '../../../Models'
import { MessagesContainerProps, DaysPositions } from '../../types'

export interface ItemProps<TMessage extends IMessage> extends MessagesContainerProps<TMessage> {
  currentMessage: TMessage
  previousMessage?: TMessage
  nextMessage?: TMessage
  position: 'left' | 'right'
  scrolledY: { value: number }
  daysPositions: { value: DaysPositions }
  listHeight: { value: number }
  // The date currently rendered by the floating header (createdAt ms). Lets the
  // inline separator stay visible until the header has actually rendered that day,
  // covering the ~1-frame JS-thread lag on the floating header's text.
  floatingRenderedDate?: { value: number | undefined }
  // The floating header's scroll-gated opacity: the inline separator it covers comes
  // back as it fades out at rest.
  floatingDayOpacity?: { value: number }
  isDayAnimationEnabled?: boolean
  /** The unread bar goes right above this row (`firstUnreadMessageId` is this message). */
  isFirstUnread?: boolean
}
