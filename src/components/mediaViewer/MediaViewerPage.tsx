import React, { RefObject, useEffect, useState } from 'react'
import { Image, ImageProps, StyleSheet, View } from 'react-native'
import Zoom from 'react-native-zoom-reanimated'

import { IMessage } from '../../Models'

// Sizes are read once per photo for the life of the app: paging back to a photo must not wait
// on another round trip before it can lay out.
const sizes = new Map<string, { width: number, height: number }>()

function useImageSize (uri: string | undefined) {
  const [size, setSize] = useState(() => (uri ? sizes.get(uri) : undefined))
  useEffect(() => {
    if (!uri || sizes.has(uri))
      return
    let isCurrent = true
    Image.getSize(uri, (width, height) => {
      sizes.set(uri, { width, height })
      if (isCurrent)
        setSize({ width, height })
    }, () => {})
    return () => {
      isCurrent = false
    }
  }, [uri])
  return uri ? size ?? sizes.get(uri) : undefined
}

export interface MediaViewerPageProps {
  message: IMessage
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
export function MediaViewerPage ({ message, index, width, height, pageWidth, listRef, imageProps, onZoomStateChange }: MediaViewerPageProps) {
  const uri = message.image
  const size = useImageSize(uri)
  const scale = size ? Math.min(width / size.width, height / size.height) : 1
  const imageStyle = size
    ? { width: size.width * scale, height: size.height * scale }
    : { width, height }

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <View style={[styles.center, { width, height }]}>
        <Zoom
          enableGallerySwipe
          parentScrollRef={listRef}
          currentIndex={index}
          itemWidth={pageWidth}
          onZoomStateChange={isZoomed => onZoomStateChange(index, isZoomed)}
        >
          <Image source={{ uri }} style={imageStyle} resizeMode='contain' {...imageProps} />
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
