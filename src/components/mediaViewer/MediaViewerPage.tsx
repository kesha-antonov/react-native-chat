import React, { RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Image, ImageProps, ImageSourcePropType, StyleSheet, View } from 'react-native'
import Zoom from 'react-native-zoom-reanimated'

import { IMessage } from '../../Models'

const IMAGE_SIZE_CACHE_LIMIT = 96
type ImageSize = { width: number, height: number }
const sizes = new Map<string, ImageSize>()

function useImageSize (uri: string | undefined) {
  const [result, setResult] = useState<{ uri: string, size: ImageSize }>()
  useEffect(() => {
    if (!uri)
      return
    const cached = sizes.get(uri)
    if (cached) {
      setResult({ uri, size: cached })
      return
    }

    let isCurrent = true
    Image.getSize(uri, (width, height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return

      if (!sizes.has(uri) && sizes.size >= IMAGE_SIZE_CACHE_LIMIT) {
        const oldest = sizes.keys().next().value
        if (oldest !== undefined)
          sizes.delete(oldest)
      }
      const size = { width, height }
      sizes.set(uri, size)
      if (isCurrent)
        setResult({ uri, size })
    }, () => {})
    return () => {
      isCurrent = false
    }
  }, [uri])
  if (!uri)
    return undefined
  return result?.uri === uri ? result.size : sizes.get(uri)
}

export interface MediaViewerPageProps<TMessage extends IMessage = IMessage> {
  message: TMessage
  index: number
  width: number
  height: number
  /** The page's full width, gap included: what the pager scrolls by. */
  pageWidth: number
  listRef: RefObject<{ scrollToOffset: (params: { offset: number, animated?: boolean }) => void } | null>
  imageProps?: Partial<ImageProps>
  onZoomStateChange: (index: number, isZoomed: boolean) => void
}

/**
 * One photo in the viewer, fitted to the screen and zoomable. Panned to its edge while zoomed,
 * it hands the swipe on to the pager, as Telegram's viewer does.
 */
export function MediaViewerPage<TMessage extends IMessage = IMessage> ({ message, index, width, height, pageWidth, listRef, imageProps, onZoomStateChange }: MediaViewerPageProps<TMessage>) {
  const source: ImageSourcePropType = imageProps?.source ?? { uri: message.image }
  const uri = Array.isArray(source) ? undefined : Image.resolveAssetSource(source)?.uri
  const size = useImageSize(uri)
  const sourceKey = Array.isArray(source) ? JSON.stringify(source.map(candidate => candidate.uri)) : uri
  const zoomSession = useMemo(() => ({ index, sourceKey }), [index, sourceKey])
  const activeZoom = useRef<{ session: typeof zoomSession, isZoomed: boolean } | null>(null)
  const onZoomRef = useRef(onZoomStateChange)
  useLayoutEffect(() => {
    onZoomRef.current = onZoomStateChange
  })
  useLayoutEffect(() => {
    const zoom = { session: zoomSession, isZoomed: false }
    activeZoom.current = zoom
    return () => {
      activeZoom.current = null
      if (zoom.isZoomed)
        onZoomRef.current(zoomSession.index, false)
    }
  }, [zoomSession])
  const scale = size ? Math.min(width / size.width, height / size.height) : 1
  const imageStyle = size
    ? { width: size.width * scale, height: size.height * scale }
    : { width, height }

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <View style={[styles.center, { width, height }]}>
        <Zoom
          key={`${index}:${sourceKey ?? ''}`}
          enableGallerySwipe
          parentScrollRef={listRef}
          currentIndex={index}
          itemWidth={pageWidth}
          onZoomStateChange={isZoomed => {
            const zoom = activeZoom.current
            if (zoom?.session === zoomSession) {
              zoom.isZoomed = isZoomed
              onZoomRef.current(index, isZoomed)
            }
          }}
        >
          <Image style={imageStyle} resizeMode='contain' {...imageProps} source={source} />
        </Zoom>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
