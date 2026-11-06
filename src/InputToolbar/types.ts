import React from 'react'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { ActionsProps } from '../Actions'
import { AttachmentsProps } from '../attachments/types'
import { AttachmentAction } from '../components/AttachmentSheet'
import { ReplyPreviewProps } from '../components/ReplyPreview'
import { ComposerProps } from '../Composer'
import { EmojiKeyboardProps } from '../emoji/EmojiKeyboard'
import { AudioRecordingProps, IMessage, ReplyMessage, VideoRecordingProps } from '../Models'
import { SendProps } from '../Send'

export interface InputToolbarProps<TMessage extends IMessage> {
  /**
   * The space the composer keeps below itself for the home indicator. Measured by default; pass it
   * when the host already knows it, e.g. a chat inside a panel whose own inset arrives late. It is
   * still given up as the keyboard or the emoji panel covers it.
   */
  bottomInset?: number
  actions?: AttachmentAction[]
  actionSheetOptionTintColor?: string
  containerStyle?: StyleProp<ViewStyle>
  primaryStyle?: StyleProp<ViewStyle>
  renderAccessory?: (props: InputToolbarProps<TMessage>) => React.ReactNode
  renderActions?: (props: ActionsProps) => React.ReactNode
  renderSend?: (props: SendProps<TMessage>) => React.ReactNode
  renderComposer?: (props: ComposerProps) => React.ReactNode
  onPressActionButton?: () => void
  icon?: () => React.ReactNode
  wrapperStyle?: StyleProp<ViewStyle>
  /** Reply message to show in preview */
  replyMessage?: ReplyMessage | null
  /** Callback to clear reply */
  onClearReply?: () => void
  /** The message being edited; shows the "Editing" banner instead of the reply one. */
  editMessage?: ReplyMessage | null
  /** Called when the editing banner is closed. */
  onCancelEdit?: () => void
  /** Custom render for reply preview */
  renderReplyPreview?: (props: ReplyPreviewProps) => React.ReactNode
  /** Style for reply preview container */
  replyPreviewContainerStyle?: StyleProp<ViewStyle>
  /** Style for reply preview text */
  replyPreviewTextStyle?: StyleProp<TextStyle>
  /**
   * Hold-to-record voice notes. On by default when the optional `expo-audio` is
   * installed; `false` turns them off, an object configures them.
   */
  audioRecording?: boolean | AudioRecordingProps
  /**
   * Round video notes. On by default when `react-native-vision-camera` is installed; `false`
   * turns them off. `{ isEnabled: true }` also offers the system camera (`expo-image-picker`)
   * when vision-camera is missing.
   */
  videoRecording?: boolean | VideoRecordingProps
  /** Force-show the send button even when the composer is empty */
  isSendButtonAlwaysVisible?: boolean
  /** Current composer text (used to swap the send button for the mic button) */
  text?: string
  /** Props for the composer's `TextInput`, forwarded from `Chat`. */
  textInputProps?: ComposerProps['textInputProps']
  /**
   * Called when the emoji button is pressed, instead of opening the built-in emoji keyboard.
   * Passing it shows the button even with `emojiKeyboard={false}`.
   */
  onPressEmoji?: () => void
  /**
   * The built-in emoji keyboard the emoji button opens in the system keyboard's place. On by
   * default; `false` hides the button (unless `onPressEmoji` is set).
   */
  emojiKeyboard?: boolean | EmojiKeyboardProps
  /**
   * The built-in attachment menu behind the paperclip. On by default (each tab shows when its
   * optional peer is installed); `false` hides the paperclip. `actions`, `onPressActionButton`
   * and `renderActions` take precedence.
   */
  attachments?: boolean | AttachmentsProps<TMessage>
  /**
   * Whether the composer accepts multiple lines. `true` (default) keeps the
   * return key inserting a newline; `false` turns it into Send.
   */
  isMultiline?: boolean
}

export type OnSend<TMessage extends IMessage> = (
  message: Partial<TMessage> | Partial<TMessage>[],
  shouldResetInputToolbar: boolean
) => void
