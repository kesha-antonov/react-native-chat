import React, { useMemo } from 'react'

import { MediaGallery, useOpenMediaId } from './gallery'
import { MediaViewer } from './MediaViewer'

/**
 * The chat's one media viewer. Nothing is mounted until a photo is opened; then the photos are
 * read once, so messages arriving while it is open do not shift the page under the finger.
 */
export function MediaViewerHost ({ gallery }: { gallery: MediaGallery }) {
  const openId = useOpenMediaId(gallery)
  const gallerySnapshot = useMemo(() => {
    if (openId == null)
      return null
    const items = gallery.getItems()
    const index = items.findIndex(item => item._id === openId)
    return index < 0 ? null : { items, index }
  }, [gallery, openId])

  if (!gallerySnapshot)
    return null

  return (
    <MediaViewer
      key={String(openId)}
      items={gallerySnapshot.items}
      initialIndex={gallerySnapshot.index}
      onClose={gallery.close}
    />
  )
}
