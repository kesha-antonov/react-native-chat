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
  /**
   * Length of `audio` / `video` in seconds. Set by the built-in recorders and
   * used to label a voice note before its file has been decoded, so a bubble can
   * render its duration without downloading the whole clip first.
   */
  duration?: number
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
  /**
   * Maximum recording length (ms); the take is sent automatically when reached.
   * Matters most for a locked recording, which otherwise runs until the user
   * sends it. Default 600000 (10 minutes).
   */
  maxDurationMs?: number
  /**
   * Called when the microphone permission is refused. iOS never re-prompts, so
   * this is the hook for pointing the user at Settings - without it a denied
   * permission leaves the mic button silently dead.
   */
  onPermissionDenied?: () => void
  /** Called when a take is dropped for being shorter than `minDurationMs`. */
  onTooShort?: () => void
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
  /** Minimum video length (ms) below which the take is discarded. Default 800. */
  minDurationMs?: number
  /**
   * Called when the camera (or microphone) permission is refused, so the app can
   * point the user at Settings instead of leaving a dead button.
   */
  onPermissionDenied?: () => void
  onError?: (error: unknown) => void
}
