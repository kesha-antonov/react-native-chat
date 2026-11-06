import { IMessage } from '../Models'
import {
  getExpoDocumentPicker,
  getExpoImagePicker,
  getExpoLocation,
  hasDocumentPicker,
  hasImagePicker,
  hasImagePickerCamera,
  hasLocation,
  hasMediaLibrary,
} from '../optional'
import { AttachmentPickers, AttachmentTab, AttachmentsProps, PickedAttachment } from './types'

/**
 * The messages the built-in menu sends: one per image, video and file (there are no albums
 * yet), one per location, with the caption as the first pick's text. Returned newest first,
 * the order `onSend` and `Chat.append` use, so the picks read top to bottom in pick order.
 */
export function buildAttachmentMessages<TMessage extends IMessage = IMessage> (
  attachments: PickedAttachment[],
  caption = ''
): Partial<TMessage>[] {
  const text = caption.trim()
  const messages = attachments.map((attachment, index) => {
    const base = { text: index === 0 ? text : '' } as Partial<TMessage>
    switch (attachment.type) {
      case 'image':
        return { ...base, image: attachment.uri }
      case 'video':
        return { ...base, video: attachment.uri, ...(attachment.duration ? { duration: attachment.duration } : null) }
      case 'file':
        return {
          ...base,
          file: {
            uri: attachment.uri,
            name: attachment.name,
            ...(attachment.size != null ? { size: attachment.size } : null),
            ...(attachment.mimeType ? { mimeType: attachment.mimeType } : null),
          },
        }
      case 'location':
        return { ...base, location: { latitude: attachment.latitude, longitude: attachment.longitude } }
    }
    return base
  })
  return messages.reverse()
}

/** Runs `onPick` (if any) and resolves the messages to send. */
export async function resolveAttachmentMessages<TMessage extends IMessage = IMessage> (
  attachments: PickedAttachment[],
  caption: string,
  onPick?: AttachmentsProps<TMessage>['onPick']
): Promise<Partial<TMessage>[]> {
  if (attachments.length === 0)
    return []
  if (onPick) {
    const result = await onPick(attachments, { caption })
    if (result === null)
      return []
    if (Array.isArray(result))
      return result
  }
  return buildAttachmentMessages<TMessage>(attachments, caption)
}

const DEFAULT_ORDER: AttachmentTab[] = ['gallery', 'camera', 'file', 'location']

/** Whether a tab can work with the installed peers or a picker the app gave. */
export const isAttachmentTabAvailable = (
  tab: AttachmentTab,
  pickers?: Partial<Record<keyof AttachmentPickers, unknown>>,
  isGalleryGridEnabled = true
): boolean => {
  switch (tab) {
    case 'gallery':
      return (isGalleryGridEnabled && hasMediaLibrary()) || hasImagePicker() || !!pickers?.gallery
    case 'camera':
      return hasImagePickerCamera() || !!pickers?.camera
    case 'file':
      return hasDocumentPicker() || !!pickers?.file
    case 'location':
      return hasLocation()
  }
  return false
}

/**
 * The tabs to show: the requested ones (or Gallery, File, Location) that have their
 * peer. Camera gets a tab of its own only when there is no in-sheet grid to hold its tile.
 */
export const getAttachmentTabs = (
  requested?: AttachmentTab[],
  pickers?: Partial<Record<keyof AttachmentPickers, unknown>>,
  isGalleryGridEnabled = true
): AttachmentTab[] => {
  const hasGrid = isGalleryGridEnabled && hasMediaLibrary()
  const tabs = requested ?? DEFAULT_ORDER.filter(tab => tab !== 'camera' || !hasGrid)
  return tabs.filter((tab, index) => tabs.indexOf(tab) === index && isAttachmentTabAvailable(tab, pickers, isGalleryGridEnabled))
}

/* ------------------------------------------------------------------------------------------ */
/* System pickers                                                                              */
/* ------------------------------------------------------------------------------------------ */

const fromImagePickerAssets = (assets: any[] | null | undefined): PickedAttachment[] =>
  (assets ?? []).map(asset => asset.type === 'video'
    ? {
      type: 'video' as const,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      // expo-image-picker reports milliseconds.
      duration: asset.duration ? asset.duration / 1000 : undefined,
      mimeType: asset.mimeType ?? undefined,
      fileName: asset.fileName ?? undefined,
    }
    : {
      type: 'image' as const,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? undefined,
      fileName: asset.fileName ?? undefined,
    })

/** The system photo picker (`expo-image-picker`), several at once. */
export async function pickFromSystemGallery (): Promise<PickedAttachment[]> {
  const picker = getExpoImagePicker()
  if (!picker?.launchImageLibraryAsync)
    return []
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.8,
  })
  return result?.canceled ? [] : fromImagePickerAssets(result?.assets)
}

/** The system camera (`expo-image-picker`). Throws on a device without one (the simulator). */
export async function takePhoto (): Promise<PickedAttachment[]> {
  const picker = getExpoImagePicker()
  if (!picker?.launchCameraAsync)
    return []
  const permission = await picker.requestCameraPermissionsAsync?.()
  if (permission && permission.granted === false)
    return []
  const result = await picker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 })
  return result?.canceled ? [] : fromImagePickerAssets(result?.assets)
}

/** The system document picker (`expo-document-picker`), several at once. */
export async function pickDocuments (): Promise<PickedAttachment[]> {
  const picker = getExpoDocumentPicker()
  if (!picker?.getDocumentAsync)
    return []
  const result = await picker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
  if (result?.canceled || !result?.assets)
    return []
  return result.assets.map((asset: any) => ({
    type: 'file' as const,
    uri: asset.uri,
    name: asset.name ?? asset.uri.split('/').pop() ?? 'file',
    size: asset.size ?? undefined,
    mimeType: asset.mimeType ?? undefined,
  }))
}

export type CurrentLocation =
  | { status: 'located', latitude: number, longitude: number, accuracy?: number }
  | { status: 'denied' }
  | { status: 'failed' }

const LOCATION_TIMEOUT_MS = 8000

/** The current position (`expo-location`), asking for permission first. */
export async function getCurrentLocation (): Promise<CurrentLocation> {
  const location = getExpoLocation()
  if (!location?.getCurrentPositionAsync)
    return { status: 'failed' }
  try {
    const permission = await location.requestForegroundPermissionsAsync()
    if (permission?.status !== 'granted')
      return { status: 'denied' }
    // A fix can take a while (or never come, on a simulator with no location set), so the
    // last known one stands in after a few seconds.
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS))
    const position = await Promise.race([
      location.getCurrentPositionAsync({ accuracy: location.Accuracy?.Balanced ?? 3 }),
      timeout,
    ]) ?? await location.getLastKnownPositionAsync?.()
    if (!position?.coords)
      return { status: 'failed' }
    return {
      status: 'located',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
    }
  } catch {
    return { status: 'failed' }
  }
}
