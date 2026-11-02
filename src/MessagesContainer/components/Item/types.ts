import { SharedValue } from 'react-native-reanimated'

import { IMessage } from '../../../Models'
import { MessagesContainerProps } from '../../types'

export interface ItemProps<TMessage extends IMessage> extends MessagesContainerProps<TMessage> {
  currentMessage: TMessage
  previousMessage?: TMessage
  nextMessage?: TMessage
  position: 'left' | 'right'
  // The list's own values, shared with the rows through the row config for the day rows.
  scrolledY?: SharedValue<number>
  listHeight?: SharedValue<number>
  floatingDayOpacity?: SharedValue<number>
  activeStickyIndex?: SharedValue<number>
  isDayAnimationEnabled?: boolean
}
