import { RefObject, useCallback } from 'react'

import { AnimatedList } from './types'

/** The parts of Legend List's state the container reads. */
export interface ListState {
  positionByKey: (key: string) => number | undefined
  listenToPosition: (key: string, callback: (position: number) => void) => () => void
  listen: (type: 'totalSize', callback: (value: number) => void) => () => void
  sizes: Map<string, number>
  isFollowingEnd: boolean
  isNearEnd: boolean
}

/** The bottom padding of the list's content (`styles.messagesContainer`). */
export const CONTENT_PADDING_BOTTOM = 10

/** The list counts as at the newest message within 5pt. */
export const NEWEST_SLOP = 5

/** Reads Legend List's state through the list's ref, or `undefined` before it mounts. */
export function useListState (forwardRef: RefObject<AnimatedList | null> | undefined) {
  return useCallback((): ListState | undefined =>
    (forwardRef?.current as unknown as { getState?: () => ListState } | null)?.getState?.()
  , [forwardRef])
}
