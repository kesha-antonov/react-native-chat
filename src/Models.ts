import { StyleProp, ViewStyle } from 'react-native'
import { IconRenderer } from './Icons'

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

/** An action shown in the message long-press context menu (Telegram style). */
export interface MessageMenuItem {
  label: string
  /** Optional leading icon, e.g. a lucide-react-native component. */
  icon?: IconRenderer
  onPress: () => void
  /** Render the label in the destructive (error) color. */
  destructive?: boolean
}

export interface LeftRightStyle<T> {
  left?: StyleProp<T>
  right?: StyleProp<T>
}

type renderFunction = (x: unknown) => React.ReactNode

export interface User {
  _id: string | number
  name?: string
  avatar?: string | number | renderFunction
}

export interface Reply {
  title: string
  value: string
  messageId?: number | string
}

export interface QuickReplies {
  type: 'radio' | 'checkbox'
  values: Reply[]
  keepIt?: boolean
}

export interface ReplyMessage extends Pick<IMessage, '_id' | 'text' | 'user' | 'audio' | 'image'> {}

export interface MessageReaction {
  /** The emoji character (e.g. '👍') */
  emoji: string
  /** IDs of the users who reacted with this emoji */
  userIds: (string | number)[]
}

export interface IMessage {
  _id: string | number
  text: string
  createdAt: Date | number
  user: User
  image?: string
  video?: string
  /** Render `video` as a Telegram-style round video note (circular, autoplay/muted) instead of a rectangular player. */
  videoNote?: boolean
  audio?: string
  system?: boolean
  sent?: boolean
  received?: boolean
  pending?: boolean
  /** True while this message's text is still being streamed in (shows a typing cursor) */
  streaming?: boolean
  quickReplies?: QuickReplies
  replyMessage?: ReplyMessage
  reactions?: MessageReaction[]
  location?: {
    latitude: number
    longitude: number
  }
}

export type IChatMessage = IMessage

export interface MessageVideoProps<TMessage extends IMessage> {
  currentMessage: TMessage
  position?: 'left' | 'right'
  containerStyle?: StyleProp<ViewStyle>
  videoStyle?: StyleProp<ViewStyle>
  videoProps?: object
}

export interface MessageAudioProps<TMessage extends IMessage> {
  currentMessage: TMessage
  position?: 'left' | 'right'
  containerStyle?: StyleProp<ViewStyle>
  audioStyle?: StyleProp<ViewStyle>
  audioProps?: object
}

export interface MessageLocationProps<TMessage extends IMessage> {
  currentMessage: TMessage
  position?: 'left' | 'right'
  containerStyle?: StyleProp<ViewStyle>
  locationStyle?: StyleProp<ViewStyle>
  /** Override the default behavior (opening the system maps app) when tapped. */
  onPress?: (location: { latitude: number, longitude: number }) => void
}

/**
 * Telegram-style hold-to-record voice messages. Requires the optional
 * `expo-audio` peer dependency; when it is absent the mic button is hidden.
 */
export interface AudioRecordingProps {
  isEnabled?: boolean
  /** Minimum recording length (ms) below which the take is discarded. Default 800. */
  minDurationMs?: number
  onError?: (error: unknown) => void
}

/**
 * Record-and-send video messages from the camera. Requires the optional
 * `expo-image-picker` peer dependency; when it is absent the button is hidden.
 */
export interface VideoRecordingProps {
  isEnabled?: boolean
  /** Max video length in seconds. Default 60. */
  maxDuration?: number
  onError?: (error: unknown) => void
}
