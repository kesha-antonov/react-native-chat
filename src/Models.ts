import { StyleProp, ViewStyle } from 'react-native'
import { IconRenderer } from './Icons'

export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

/**
 * The actions the chat can put in the long-press menu by itself, in Telegram's order:
 * `reply`, `copy`, `forward`, `pin`, `edit`, `delete`.
 */
export type MessageActionKey = 'reply' | 'copy' | 'forward' | 'pin' | 'edit' | 'delete'

/** An action shown in the message long-press context menu (Telegram style). */
export interface MessageMenuItem {
  /**
   * Identifies the action. The built-in ones carry their `MessageActionKey`, so a
   * `messageActions` function can find, drop or reorder them.
   */
  key?: MessageActionKey | string
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

/** A document attached to a message (`IMessage.file`), drawn as Telegram's file bubble. */
export interface IMessageFile {
  /** Where the file is: a local `file://` path or a remote URL. */
  uri: string
  /** The file name shown in the bubble, with its extension. */
  name: string
  /** Size in bytes, shown under the name. */
  size?: number
  /** MIME type, used when the file is opened or shared. */
  mimeType?: string
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
   * The voice or round note has not been played by its recipient yet. Draws
   * Telegram's unread dot: on an incoming note until you play it, on an
   * outgoing one until the recipient does.
   */
  isMediaUnread?: boolean
  /**
   * A view-once voice or round note (Telegram's TTL "view once"): it plays a
   * single time, then `mediaPlayback.onViewOnceEnd` lets the app remove it.
   */
  isViewOnce?: boolean
  /** Text of a transcribed voice or round note, shown under it. */
  transcription?: string
  /**
   * Length of `audio` / `video` in seconds. Set by the built-in recorders and
   * used to label a voice note before its file has been decoded, so a bubble can
   * render its duration without downloading the whole clip first.
   */
  duration?: number
  system?: boolean
  /** The message is pinned; the menu's pin action then reads "Unpin". */
  isPinned?: boolean
  sent?: boolean
  received?: boolean
  pending?: boolean
  /** Sending failed: the ticks give way to Telegram's red error badge. */
  isFailed?: boolean
  /** The message was edited; its time reads "edited 14:05". Set by `useChatMessages`'s edit. */
  isEdited?: boolean
  /** When the message was last edited; any value also shows the "edited" mark. */
  editedAt?: Date | number
  /** True while this message's text is still being streamed in (shows a typing cursor) */
  streaming?: boolean
  quickReplies?: QuickReplies
  replyMessage?: ReplyMessage
  reactions?: MessageReaction[]
  location?: {
    latitude: number
    longitude: number
  }
  /** A document: Telegram's file bubble (icon, name, size); a tap opens it. */
  file?: IMessageFile
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

export interface MessageFileProps<TMessage extends IMessage> {
  currentMessage: TMessage
  position?: 'left' | 'right'
  containerStyle?: StyleProp<ViewStyle>
  /** Override opening the file (the system share sheet with `expo-sharing`, else `Linking`). */
  onPress?: (file: IMessageFile) => void
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
  /**
   * Show Telegram's "view once" toggle above the lock while a take is locked.
   * A take sent with it on arrives in `onSend` with `isViewOnce: true`.
   */
  isViewOnceEnabled?: boolean
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
  /** As `audioRecording.isViewOnceEnabled`, for round video takes. */
  isViewOnceEnabled?: boolean
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
  /** Called when a take is dropped for being shorter than `minDurationMs`. */
  onTooShort?: () => void
  onError?: (error: unknown) => void
}

/**
 * How voice notes and round video notes play back in the chat, following
 * Telegram: one speed shared by every note, and a run of notes playing one
 * after another.
 */
export interface MediaPlaybackProps {
  /**
   * When a voice or round video note plays to its end, start the next newer
   * one in the chat. Default true.
   */
  isAutoPlayNextEnabled?: boolean
  /**
   * Playback speed to start with (1, 1.5 or 2). The speed is shared by every
   * note; pair this with `onPlaybackRateChange` to keep it across launches.
   */
  playbackRate?: number
  /** Called when the user changes the playback speed on any note. */
  onPlaybackRateChange?: (rate: number) => void
  /**
   * Round video notes loop silently in the list until tapped, Telegram's
   * "Autoplay videos". Default false: a note holds its first frame with a play
   * button, and grows when tapped.
   */
  isRoundVideoAutoplayEnabled?: boolean
  /**
   * Telegram's "now playing" bar at the top of the chat while a voice or round
   * note plays or is paused: play/pause, sender, speed and close. Default true.
   */
  isNowPlayingBarEnabled?: boolean
  /**
   * Telegram's floating round note (`PipRoundVideoView`): a round note still
   * playing or paused when its row scrolls out of view keeps going in a small
   * draggable circle over the list. Default true; when false, the note stops
   * with its row instead, as a voice note does.
   */
  isFloatingRoundNoteEnabled?: boolean
  /**
   * Called when an incoming voice or round note marked `isMediaUnread` starts
   * playing, so the app can mark it listened (Telegram's `media_unread`).
   */
  onMediaRead?: (message: IMessage) => void
  /**
   * The phone is held to the ear, from the app's proximity sensor. Telegram's
   * raise to listen: playback moves to the earpiece, a note under a second in
   * restarts, and lowering the phone pauses it.
   */
  isNearEar?: boolean
  /**
   * Shows a transcribe button on voice and round notes. Called on tap; the app
   * transcribes and sets `IMessage.transcription`, which is then shown.
   */
  onTranscribe?: (message: IMessage) => void
  /** A view-once note finished playing; the app should remove it. */
  onViewOnceEnd?: (message: IMessage) => void
}
