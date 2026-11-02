import { StyleProp, ViewStyle } from 'react-native'
import { IMessage } from '../Models'

export interface InlinePlayerProps {
  uri: string
  style: StyleProp<ViewStyle>
  videoProps?: object
}

export interface RoundNotePlayerProps {
  uri: string
  videoProps?: object
  videoStyle?: StyleProp<ViewStyle>
  /** Length in seconds, shown under the note. */
  duration?: number
  noteSize: number
  playingNoteSize: number
  messageId?: string | number
  isIncoming: boolean
  isMediaUnread?: boolean
  /** Just sent from here: the camera circle flies into it. Read on mount only. */
  animateAppear?: boolean
  /** The message, handed to `mediaPlayback.onTranscribe` and `onViewOnceEnd`. */
  message?: IMessage
  /** Plays a single time (view once). */
  isViewOnce?: boolean
  transcription?: string
}
