import { IMessage } from '../../Models'

export interface WaveformPlayerProps {
  uri: string
  position?: 'left' | 'right'
  /**
   * Length in seconds from the message, shown before the file has decoded so a
   * note is labelled immediately instead of reading 00:00.
   */
  duration?: number
  /**
   * Id of the message this note belongs to. Lets the chat start this note
   * when the one above it finishes, so a run of notes plays as one.
   */
  messageId?: string | number
  /** Not played by its recipient yet: draws the unread dot. */
  isMediaUnread?: boolean
  /**
   * Grow the bars in once the waveform is ready, for a note
   * that has just been sent. Read on mount only.
   */
  animateAppear?: boolean
  /**
   * The message itself, handed to `mediaPlayback.onTranscribe` and
   * `onViewOnceEnd`.
   */
  message?: IMessage
  /** A view-once voice note: plays a single time, cannot be seeked. */
  isViewOnce?: boolean
  /** Text shown under the waveform once transcribed. */
  transcription?: string
}
