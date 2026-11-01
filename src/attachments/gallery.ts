import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { getExpoImage, getExpoMediaLibrary } from '../optional'
import { PickedAttachment } from './types'

/** A photo or video from the device library, for the attachment menu's grid. */
export interface GalleryAsset {
  id: string
  /** The library URI (`ph://` on iOS). */
  uri: string
  mediaType: 'photo' | 'video'
  width?: number
  height?: number
  /** Seconds, for videos. */
  duration?: number
  filename?: string
}

export type GalleryStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable'

const PAGE_SIZE = 60
const ASK_DELAY_MS = 450

const toGalleryAsset = (asset: any): GalleryAsset => ({
  id: asset.id,
  uri: asset.uri,
  mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
  width: asset.width,
  height: asset.height,
  duration: asset.duration || undefined,
  filename: asset.filename,
})

/**
 * The newest photos and videos from `expo-media-library`, a page at a time, once `isActive`.
 * Asks for photo access the first time.
 */
export function useGallery (isActive: boolean) {
  const [status, setStatus] = useState<GalleryStatus>('idle')
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const cursorRef = useRef<string | undefined>(undefined)
  const hasMoreRef = useRef(true)
  const isLoadingRef = useRef(false)

  const loadPage = useCallback(async () => {
    const library = getExpoMediaLibrary()
    if (!library?.getAssetsAsync) {
      setStatus('unavailable')
      return
    }
    if (isLoadingRef.current || !hasMoreRef.current)
      return
    isLoadingRef.current = true
    try {
      const page = await library.getAssetsAsync({
        first: PAGE_SIZE,
        after: cursorRef.current,
        mediaType: [library.MediaType?.photo ?? 'photo', library.MediaType?.video ?? 'video'],
        sortBy: [[library.SortBy?.creationTime ?? 'creationTime', false]],
      })
      cursorRef.current = page?.endCursor
      hasMoreRef.current = !!page?.hasNextPage
      const next = (page?.assets ?? []).map(toGalleryAsset)
      setAssets(previous => [...previous, ...next])
      setStatus('ready')
    } catch {
      // Most likely access was taken away; the panel then offers the system picker.
      setStatus(previous => (previous === 'loading' ? 'denied' : previous))
    } finally {
      isLoadingRef.current = false
    }
  }, [])

  const statusRef = useRef(status)
  statusRef.current = status
  const startedRef = useRef(false)
  useEffect(() => {
    // Access refused last time: ask again on the next open (the user may have changed it).
    if (!isActive) {
      if (statusRef.current === 'denied')
        startedRef.current = false
      return
    }
    if (startedRef.current)
      return
    startedRef.current = true
    const library = getExpoMediaLibrary()
    if (!library?.requestPermissionsAsync) {
      setStatus('unavailable')
      return
    }
    setStatus('loading')
    const ask = async () => {
      const current = await library.getPermissionsAsync?.(false, ['photo', 'video'])
      if (current?.granted || current?.canAskAgain === false)
        return current
      // iOS cannot present its permission alert while the sheet's Modal is still presenting,
      // so the first request waits for the sheet to settle.
      await new Promise<void>(resolve => setTimeout(resolve, ASK_DELAY_MS))
      return library.requestPermissionsAsync(false, ['photo', 'video'])
    }
    ask()
      .then(async permission => {
        if (!permission?.granted) {
          setStatus('denied')
          return
        }
        await loadPage()
      })
      .catch(() => setStatus('denied'))
  }, [isActive, loadPage])

  return { status, assets, loadMore: loadPage }
}

const localUris = new Map<string, string>()

/** A URI an image view can show: `ph://` needs `expo-image`; without it, the asset's local file. */
export function useAssetThumbnailUri (asset: GalleryAsset): string | null {
  const isDirect = Platform.OS !== 'ios' || !asset.uri.startsWith('ph://') || !!getExpoImage()?.Image
  const [uri, setUri] = useState<string | null>(() => isDirect ? asset.uri : localUris.get(asset.id) ?? null)

  useEffect(() => {
    if (isDirect || localUris.has(asset.id))
      return
    let isCurrent = true
    resolveLocalUri(asset)
      .then(local => {
        if (local)
          localUris.set(asset.id, local)
        if (isCurrent)
          setUri(local)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [asset, isDirect])

  return uri
}

const resolveLocalUri = async (asset: GalleryAsset): Promise<string | null> => {
  const library = getExpoMediaLibrary()
  const info = await library?.getAssetInfoAsync?.(asset.id, { shouldDownloadFromNetwork: true })
  return info?.localUri ?? info?.uri ?? null
}

/** The asset as an attachment, with a `file://` URI the app can upload. */
export async function toPickedAttachment (asset: GalleryAsset): Promise<PickedAttachment> {
  let uri = localUris.get(asset.id) ?? asset.uri
  if (Platform.OS === 'ios' && uri.startsWith('ph://'))
    uri = (await resolveLocalUri(asset).catch(() => null)) ?? asset.uri
  return asset.mediaType === 'video'
    ? { type: 'video', uri, width: asset.width, height: asset.height, duration: asset.duration, fileName: asset.filename }
    : { type: 'image', uri, width: asset.width, height: asset.height, fileName: asset.filename }
}
