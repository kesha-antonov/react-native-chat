import { useContext, useInsertionEffect, useState } from 'react'
import type { ViewabilityConfigCallbackPair } from '@legendapp/list/react-native'

import { MediaPlaybackContext, MediaPlaybackController } from '../components/mediaPlayback'
import { IMessage } from '../Models'
import { AnimatedListProps } from './types'

// Any pixel of a row on screen counts: the playing round note floats only once
// its row has left the list entirely.
const ROW_ON_SCREEN_CONFIG = { itemVisiblePercentThreshold: 0 }

type ViewableItemsChanged = NonNullable<ViewabilityConfigCallbackPair['onViewableItemsChanged']>

/**
 * The list reads its viewability callbacks once, at mount, so they are permanent and forward to
 * what the latest commit handed over (the list only reports after a commit). A plain object
 * rather than refs: the callbacks are built while rendering, and React Compiler rejects a
 * render-time closure over a ref even when nothing calls it until later.
 */
function createViewabilityRelay (
  initialMediaController: MediaPlaybackController | null,
  initialConsumer: ViewableItemsChanged | null | undefined
) {
  let mediaController = initialMediaController
  let markRowsSeen: (ids: (string | number)[]) => void = () => {}
  let consumer = initialConsumer
  const onRowsViewable: ViewableItemsChanged = ({ viewableItems }) => {
    const ids: (string | number)[] = []
    for (const token of viewableItems) {
      const id = (token.item as IMessage | undefined)?._id
      if (id != null)
        ids.push(id)
    }
    mediaController?.setViewableMessages(ids)
    markRowsSeen(ids)
  }
  const onConsumerViewable: ViewableItemsChanged = info => consumer?.(info)
  const update = (next: {
    mediaController: MediaPlaybackController | null
    markRowsSeen: (ids: (string | number)[]) => void
    consumer: ViewableItemsChanged | null | undefined
  }) => {
    mediaController = next.mediaController
    markRowsSeen = next.markRowsSeen
    consumer = next.consumer
  }
  return { onRowsViewable, onConsumerViewable, update }
}

/**
 * The list's `viewabilityConfigCallbackPairs`: which rows are on screen, for the floating round
 * note and the page-down counter, with a consumer's own handler folded in.
 */
export function useViewabilityPairs<TMessage extends IMessage> (
  listProps: AnimatedListProps<TMessage> | undefined,
  markRowsSeen: (ids: (string | number)[]) => void
) {
  // Which rows are on screen, for the floating round note. The list reads viewability
  // callbacks once, at mount, and FlatList refuses
  // `onViewableItemsChanged` alongside `viewabilityConfigCallbackPairs`, so a
  // consumer's own handler is folded into the pairs here, read through a relay.
  const mediaController = useContext(MediaPlaybackContext)
  const [viewabilityRelay] = useState(() => createViewabilityRelay(mediaController, listProps?.onViewableItemsChanged))
  const [viewabilityPairs] = useState(() => {
    const pairs: ViewabilityConfigCallbackPair[] = [{
      viewabilityConfig: ROW_ON_SCREEN_CONFIG,
      onViewableItemsChanged: viewabilityRelay.onRowsViewable,
    }]
    if (listProps?.viewabilityConfigCallbackPairs)
      pairs.push(...listProps.viewabilityConfigCallbackPairs)
    else if (listProps?.onViewableItemsChanged)
      pairs.push({
        // FlatList's own default when a handler comes without a config.
        viewabilityConfig: listProps.viewabilityConfig ?? { viewAreaCoveragePercentThreshold: 0 },
        onViewableItemsChanged: viewabilityRelay.onConsumerViewable,
      })
    return pairs
  })

  const consumerOnViewableItemsChanged = listProps?.onViewableItemsChanged
  // An insertion effect runs before any layout effect, the list's own included, so a report
  // made while the list commits already reaches this render's handlers.
  useInsertionEffect(() => {
    viewabilityRelay.update({ mediaController, markRowsSeen, consumer: consumerOnViewableItemsChanged })
  })

  return viewabilityPairs
}
