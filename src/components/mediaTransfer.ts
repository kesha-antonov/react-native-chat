import { createContext, useContext } from 'react'

import { IMessage, MediaTransferProps } from '../Models'

/**
 * The app's download and cancel handlers, read at press time so a new handler
 * on every render of `Chat` never re-renders a bubble.
 */
export interface MediaTransferController {
  get: () => MediaTransferProps | undefined
}

export const createMediaTransferController = () => {
  let props: MediaTransferProps | undefined
  return {
    get: () => props,
    set: (next: MediaTransferProps | undefined) => {
      props = next
    },
  }
}

export const MediaTransferContext = createContext<MediaTransferController | null>(null)

/** The handlers `Chat` was given; empty outside a `Chat`. */
export const useMediaTransfer = () => {
  const controller = useContext(MediaTransferContext)
  return {
    onDownload: (message: IMessage) => controller?.get()?.onDownload?.(message),
    onCancel: (message: IMessage) => controller?.get()?.onCancel?.(message),
    hasDownloadHandler: () => !!controller?.get()?.onDownload,
  }
}

/** What a media button shows for a message's `transfer` / `isDownloadRequired`. */
export const transferState = (message: IMessage | undefined) => {
  if (message?.transfer)
    return { icon: 'cancel' as const, progress: clampProgress(message.transfer.progress) }
  if (message?.isDownloadRequired)
    return { icon: 'download' as const, progress: 0 }
  return null
}

export const clampProgress = (value: number | undefined) =>
  value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(1, value))
