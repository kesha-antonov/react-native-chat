import { IMessage } from '../Models'
import { localDayKey } from '../utils'

/**
 * A day's date pill, as an item of the list itself. Being an item is what lets the list pin
 * it natively (`stickyHeaderIndices`): it sticks at the top while its day scrolls under it
 * and is pushed off by the next day's, on the UI thread, with no overlay to keep in step.
 */
export interface DayItem {
  _id: string
  kind: 'day'
  /** The first message of the day's `createdAt`: what the pill formats. */
  createdAt: Date | number
}

export type ListItem<TMessage extends IMessage> = TMessage | DayItem

export const isDayItem = (item: unknown): item is DayItem => (item as DayItem | undefined)?.kind === 'day'

/** A day item's key: never a message id, and the same for the day whatever its messages. */
export const dayItemId = (dayKey: number) => `__day:${dayKey}`

/**
 * The list's items, oldest first: each day's pill right before its first message, and where
 * the pills are (for `stickyHeaderIndices`). A message without a date opens no day, as before.
 */
export function withDayItems<TMessage extends IMessage> (messages: readonly TMessage[]) {
  const items: ListItem<TMessage>[] = []
  const dayIndices: number[] = []
  let previousKey: number | undefined
  for (const message of messages) {
    const key = message.createdAt != null ? localDayKey(message.createdAt) : NaN
    if (!Number.isNaN(key) && key !== previousKey) {
      dayIndices.push(items.length)
      items.push({ _id: dayItemId(key), kind: 'day', createdAt: message.createdAt })
    }
    if (!Number.isNaN(key))
      previousKey = key
    items.push(message)
  }
  return { items, dayIndices }
}
