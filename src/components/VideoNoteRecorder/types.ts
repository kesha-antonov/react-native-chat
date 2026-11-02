import { IMessage, VideoRecordingProps } from '../../Models'

export interface VideoNoteRecorderProps<TMessage extends IMessage = IMessage> {
  config?: VideoRecordingProps
  onClose: () => void
  onSend?: (
    message: Partial<TMessage>,
    shouldResetInputToolbar: boolean
  ) => void
}
