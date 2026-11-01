import React from 'react'

import { IMessage } from '../Models'

/**
 * The attachment menu's tabs, in their default order. Each shows only when its optional peer is
 * installed: `gallery` (`expo-media-library` for the in-sheet grid, or `expo-image-picker` for
 * the system picker), `camera` (`expo-image-picker`), `file` (`expo-document-picker`) and
 * `location` (`expo-location`).
 */
export type AttachmentTab = 'gallery' | 'camera' | 'file' | 'location'

/** Something the user picked in the attachment menu, before it becomes a message. */
export type PickedAttachment =
  | { type: 'image', uri: string, width?: number, height?: number, mimeType?: string, fileName?: string }
  | { type: 'video', uri: string, width?: number, height?: number, duration?: number, mimeType?: string, fileName?: string }
  | { type: 'file', uri: string, name: string, size?: number, mimeType?: string }
  | { type: 'location', latitude: number, longitude: number, accuracy?: number }

/** What `attachments.onPick` can return. */
export type AttachmentPickResult<TMessage extends IMessage> =
  | Partial<TMessage>[]
  | null
  | undefined
  | void

/** Props for a custom `attachments.renderAttachmentMenu`. */
export interface AttachmentMenuRenderProps {
  visible: boolean
  onClose: () => void
  /** The tabs this install can offer. */
  tabs: AttachmentTab[]
  /** Send picked attachments the way the built-in menu does (`onPick`, then `onSend`). */
  onSend: (attachments: PickedAttachment[], caption?: string) => void
}

/**
 * The built-in attachment menu (`Chat`'s `attachments` prop) behind the composer's
 * paperclip. On by default.
 */
export interface AttachmentsProps<TMessage extends IMessage = IMessage> {
  /** Show the paperclip and its menu. Default true (hidden when no tab's peer is installed). */
  isEnabled?: boolean
  /** Which tabs to offer, in order. Default: Gallery, File, Location (+ Camera without a grid). */
  tabs?: AttachmentTab[]
  /**
   * Intercept picked attachments, e.g. to upload them first. Return the messages to send, `null`
   * to send nothing (you handle it), or nothing for the default: one message per image, video
   * and file, and one for a location, with the caption on the first.
   */
  onPick?: (
    attachments: PickedAttachment[],
    context: { caption: string }
  ) => AttachmentPickResult<TMessage> | Promise<AttachmentPickResult<TMessage>>
  /** Draw your own menu instead of the built-in sheet. */
  renderAttachmentMenu?: (props: AttachmentMenuRenderProps) => React.ReactNode
}
