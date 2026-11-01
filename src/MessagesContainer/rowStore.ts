import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import isEqual from 'lodash.isequal'

import { warning } from '../logging'
import { IMessage } from '../Models'
import { isSameDay, isSameGroup } from '../utils'

/** What a row renders: its message, and the neighbours its grouping is decided against. */
export interface RowEntry<TMessage extends IMessage = IMessage> {
  message: TMessage
  previousMessage: TMessage
  nextMessage: TMessage
}

// Stable stand-in for the missing neighbour at either end of the list.
const EMPTY_MESSAGE = Object.freeze({}) as IMessage

/**
 * Everything about a neighbour that changes how a row draws: whether there is one (quick
 * replies hide once answered), whether they group (the tail, the avatar, the gap below) and
 * whether they share a day (the date separator). A neighbour's own text, status or reactions
 * do not matter to this row, so they never re-render it.
 */
const neighbourSignature = (message: IMessage, neighbour: IMessage | undefined) => {
  if (!neighbour)
    return 0
  return 1 +
    (neighbour._id != null ? 2 : 0) +
    (isSameGroup(message, neighbour) ? 4 : 0) +
    (isSameDay(message, neighbour) ? 8 : 0)
}

interface StoredEntry<TMessage extends IMessage> {
  entry: RowEntry<TMessage>
  previousSignature: number
  nextSignature: number
}

/**
 * The messages, by id, for the rows to subscribe to one by one. A send, a status change, a
 * reaction or a streamed token re-renders the row it belongs to - plus a neighbour only when
 * its grouping actually changed - instead of every row the list has mounted.
 *
 * `sync` runs while the list renders, so rows mounting in that same render read the new
 * messages; `flush` notifies the rows already on screen once it has committed.
 */
export class MessageRowStore<TMessage extends IMessage = IMessage> {
  private entries = new Map<string, StoredEntry<TMessage>>()
  private listeners = new Map<string, Set<() => void>>()
  private changed = new Set<string>()
  private lastMessages: TMessage[] | undefined
  private lastIsInverted: boolean | undefined

  sync (messages: TMessage[], isInverted: boolean) {
    if (messages === this.lastMessages && isInverted === this.lastIsInverted)
      return
    this.lastMessages = messages
    this.lastIsInverted = isInverted

    const seen = new Set<string>()
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      if (message._id == null)
        warning('Chat: `_id` is missing for message', JSON.stringify(message))
      if (!message.user) {
        if (!message.system)
          warning('Chat: `user` is missing for message', JSON.stringify(message))
        message.user = { _id: 0 }
      }

      const id = String(message._id)
      seen.add(id)
      const previousMessage = isInverted ? messages[i + 1] : messages[i - 1]
      const nextMessage = isInverted ? messages[i - 1] : messages[i + 1]
      const previousSignature = neighbourSignature(message, previousMessage)
      const nextSignature = neighbourSignature(message, nextMessage)

      const stored = this.entries.get(id)
      if (
        stored &&
        stored.previousSignature === previousSignature &&
        stored.nextSignature === nextSignature &&
        // A store that rebuilds every message object on each update (a server snapshot)
        // still only re-renders what changed.
        (stored.entry.message === message || isEqual(stored.entry.message, message))
      )
        continue

      this.entries.set(id, {
        entry: {
          message,
          previousMessage: previousMessage ?? EMPTY_MESSAGE as TMessage,
          nextMessage: nextMessage ?? EMPTY_MESSAGE as TMessage,
        },
        previousSignature,
        nextSignature,
      })
      this.changed.add(id)
    }

    if (seen.size !== this.entries.size)
      for (const id of this.entries.keys())
        if (!seen.has(id)) {
          this.entries.delete(id)
          this.changed.add(id)
        }
  }

  flush () {
    if (this.changed.size === 0)
      return
    const ids = [...this.changed]
    this.changed.clear()
    for (const id of ids)
      this.listeners.get(id)?.forEach(listener => listener())
  }

  get (id: string): RowEntry<TMessage> | undefined {
    return this.entries.get(id)?.entry
  }

  getMessage (id: string | number): TMessage | undefined {
    return this.entries.get(String(id))?.entry.message
  }

  subscribe (id: string, listener: () => void) {
    let set = this.listeners.get(id)
    if (!set) {
      set = new Set()
      this.listeners.set(id, set)
    }
    set.add(listener)
    return () => {
      set!.delete(listener)
      if (set!.size === 0)
        this.listeners.delete(id)
    }
  }
}

export const MessageRowStoreContext = createContext<MessageRowStore | null>(null)

/** The entry for one row, re-rendering it only when that entry changes. */
export function useRowEntry<TMessage extends IMessage> (id: string): RowEntry<TMessage> | undefined {
  const store = useContext(MessageRowStoreContext) as MessageRowStore<TMessage> | null
  const subscribe = useCallback((listener: () => void) => store ? store.subscribe(id, listener) : () => {}, [store, id])
  const getSnapshot = useCallback(() => store?.get(id), [store, id])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * `messages`, or the previous array when it holds the same ids in the same order. The list is
 * then handed the same data when only a message's content changed, and does not touch its
 * cells at all - the store re-renders that one row.
 */
export function sameOrder<TMessage extends IMessage> (previous: TMessage[] | undefined, messages: TMessage[]) {
  if (!previous || previous.length !== messages.length)
    return messages
  for (let i = 0; i < messages.length; i++)
    if (previous[i]._id !== messages[i]._id)
      return messages
  return previous
}
