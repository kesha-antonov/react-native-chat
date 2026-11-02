import { useEffect, useMemo } from 'react'
import { SharedValue } from 'react-native-reanimated'

import { IMessage } from '../Models'
import { isSameDay } from '../utils'
import { ListState } from './listState'
import { MessageRowStore } from './rowStore'
import { DaysPositions } from './types'

interface DaysPositionsOptions<TMessage extends IMessage> {
  messages: TMessage[]
  isInverted: boolean
  isListLaidOut: boolean
  isDayAnimationEnabled: boolean
  listState: () => ListState | undefined
  daysPositions: SharedValue<DaysPositions>
  rowStore: MessageRowStore<TMessage>
}

/** Feeds `daysPositions`, the floating day header's map of where each day starts. */
export function useDaysPositions<TMessage extends IMessage> ({
  messages,
  isInverted,
  isListLaidOut,
  isDayAnimationEnabled,
  listState,
  daysPositions,
  rowStore,
}: DaysPositionsOptions<TMessage>) {
  // Where each day's opening message sits, for the floating day header: the list reports a
  // row's position whenever it changes, so only the rows that open a day are followed, and
  // their moves reach the UI thread once a frame.
  const dayStartIds = useMemo(() => {
    const ids: string[] = []
    for (let i = 0; i < messages.length; i++) {
      const previous = isInverted ? messages[i + 1] : messages[i - 1]
      if (!previous || !isSameDay(messages[i], previous))
        ids.push(messages[i]._id.toString())
    }
    return ids
  }, [messages, isInverted])

  useEffect(() => {
    const state = isListLaidOut && isDayAnimationEnabled ? listState() : undefined
    if (!state)
      return

    let pending: Record<string, DaysPositions[string]> | null = null
    let frame: number | null = null
    const flush = () => {
      frame = null
      const batch = pending
      pending = null
      if (batch)
        daysPositions.modify(value => {
          'worklet'

          for (const key in batch)
            value[key] = batch[key]
          return value
        })
    }

    const initial: DaysPositions = {}
    const unsubscribes = dayStartIds.map(id => {
      const message = rowStore.getMessage(id)
      const date = new Date(message?.createdAt ?? 0)
      const entry = (y: number): DaysPositions[string] => ({
        x: 0,
        width: 0,
        y,
        height: state.sizes.get(id) ?? 0,
        createdAt: date.getTime(),
        dayKey: date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate(),
      })
      const y = state.positionByKey(id)
      if (y != null)
        initial[id] = entry(y)
      return state.listenToPosition(id, position => {
        if (pending == null)
          pending = {}
        pending[id] = entry(position)
        if (frame == null)
          frame = requestAnimationFrame(flush)
      })
    })
    // The days this list shows now, replacing any that went with a deleted or earlier message.
    daysPositions.set(initial)

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
      if (frame != null)
        cancelAnimationFrame(frame)
    }
  }, [dayStartIds, isListLaidOut, isDayAnimationEnabled, listState, daysPositions, rowStore])
}
