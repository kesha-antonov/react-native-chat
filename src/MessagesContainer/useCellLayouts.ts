import { useCallback, useEffect, useRef } from 'react'
import { makeMutable, SharedValue } from 'react-native-reanimated'

import { ListState } from './listState'

/**
 * Where each screen-gradient bubble's row sits, for `BubbleGradientContext`, fed by the list's
 * position listeners.
 */
export function useCellLayouts (listState: () => ListState | undefined, isListLaidOut: boolean) {
  // Where each screen-gradient bubble's row sits: one shared value per message, created when its
  // bubble asks, and fed by the list's own position listener for that row - so a row moving
  // re-runs its bubble's worklets and no other's. A row keeps its listener once subscribed:
  // dropping it on unmount and resubscribing on remount cost a fling on Android about 7 points
  // of janky frames (19.6% -> 26.5% on a Pixel 7), each remount rebuilding the list state and
  // rewriting the row's position.
  const cellValuesRef = useRef(new Map<string, { value: SharedValue<{ y: number, height: number } | undefined>, unsubscribe?: () => void }>())
  const subscribeCell = useCallback((id: string) => {
    const entry = cellValuesRef.current.get(id)
    const state = listState()
    if (!entry || entry.unsubscribe || !state)
      return
    const update = (y: number) => {
      entry.value.value = { y, height: state.sizes.get(id) ?? 0 }
    }
    const y = state.positionByKey(id)
    if (y != null)
      update(y)
    entry.unsubscribe = state.listenToPosition(id, update)
  }, [listState])
  const cellLayout = useCallback((id: string) => {
    let entry = cellValuesRef.current.get(id)
    if (!entry) {
      entry = { value: makeMutable<{ y: number, height: number } | undefined>(undefined) }
      cellValuesRef.current.set(id, entry)
      subscribeCell(id)
    }
    return entry.value
  }, [subscribeCell])
  useEffect(() => () => {
    cellValuesRef.current.forEach(entry => entry.unsubscribe?.())
    cellValuesRef.current.clear()
  }, [])

  // Gradient bubbles that asked for their row before the list could report positions.
  useEffect(() => {
    if (isListLaidOut)
      cellValuesRef.current.forEach((_, id) => subscribeCell(id))
  }, [isListLaidOut, subscribeCell])

  // A row that changes height (a reaction, a reply loaded) keeps its place but moves its
  // bottom edge, which the gradient bubbles paint from.
  const onItemSizeChanged = useCallback(({ itemKey, size }: { itemKey: string, size: number }) => {
    const entry = cellValuesRef.current.get(itemKey)
    const current = entry?.value.value
    if (entry && current)
      entry.value.value = { y: current.y, height: size }
  }, [])

  return { cellLayout, onItemSizeChanged }
}
