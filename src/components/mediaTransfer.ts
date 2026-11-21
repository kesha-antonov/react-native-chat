import { createContext, useContext } from 'react'

import { IMessage, MediaTransferProps } from '../Models'
import { createStore, Store, useStore } from '../store'

/**
 * The app's download and cancel handlers, read at press time so a new handler
 * on every render of `Chat` never re-renders a bubble.
 */
export type MediaTransferController = Store<MediaTransferProps | undefined>

export const createMediaTransferController = () => createStore<MediaTransferProps | undefined>(undefined)

export const MediaTransferContext = createContext<MediaTransferController | null>(null)

/** The handlers `Chat` was given; empty outside a `Chat`. */
export const useMediaTransfer = () => {
  const controller = useContext(MediaTransferContext)
  return {
    onDownload: (message: IMessage) => controller?.get()?.onDownload?.(message),
    onCancel: (message: IMessage) => controller?.get()?.onCancel?.(message),
    hasCancelHandler: () => !!controller?.get()?.onCancel,
    hasDownloadHandler: () => !!controller?.get()?.onDownload,
  }
}

const hasDownload = (props: MediaTransferProps | undefined) => !!props?.onDownload
const hasCancel = (props: MediaTransferProps | undefined) => !!props?.onCancel

export const useCanTransfer = (action: 'cancel' | 'download' | undefined) => {
  const controller = useContext(MediaTransferContext)
  return useStore(action ? controller ?? undefined : undefined, action === 'cancel' ? hasCancel : hasDownload, false)
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
