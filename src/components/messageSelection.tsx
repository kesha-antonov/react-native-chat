import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

import { createKeyedStore, createStore, KeyedStore, useKeyedValue } from '../store'

/**
 * Multi-select mode: which messages are checked. A row reads the mode flag and its own checked
 * state, so checking a message wakes that row alone, and entering or leaving the mode
 * re-renders each row once.
 */
export interface MessageSelectionStore {
  subscribe: (listener: () => void) => () => void
  isActive: () => boolean
  isSelected: (messageId: string | number) => boolean
  /** The checked ids, in the order they were checked. */
  getSelectedIds: () => (string | number)[]
  /** Enters the mode with this message checked. */
  start: (messageId: string | number) => void
  /** Checks or unchecks a message; unchecking the last one leaves the mode. */
  toggle: (messageId: string | number) => void
  /** Drops ids that are no longer in the chat (deleted messages). */
  retain: (messageIds: Set<string | number>) => void
  clear: () => void
  /** @internal Per-message checked flags, read by each row. */
  checked: KeyedStore<string | number, true>
}

interface SelectionState {
  active: boolean
  ids: (string | number)[]
}

const IDLE: SelectionState = { active: false, ids: [] }

export function createMessageSelectionStore (): MessageSelectionStore {
  const state = createStore<SelectionState>(IDLE)
  const checked = createKeyedStore<string | number, true>()

  // The per-message flags change before the mode flag, so a row woken by either sees both new.
  const apply = (ids: (string | number)[]) => {
    const next = new Set(ids)
    checked.keys().forEach(id => {
      if (!next.has(id))
        checked.delete(id)
    })
    ids.forEach(id => checked.set(id, true))
    state.set(ids.length ? { active: true, ids } : IDLE)
  }

  return {
    subscribe: state.subscribe,
    isActive: () => state.get().active,
    isSelected: messageId => checked.has(messageId),
    getSelectedIds: () => state.get().ids,
    start: messageId => apply([messageId]),
    toggle: messageId => {
      const { active, ids } = state.get()
      if (!active)
        return
      apply(ids.includes(messageId) ? ids.filter(id => id !== messageId) : [...ids, messageId])
    },
    retain: messageIds => {
      const { active, ids } = state.get()
      if (!active)
        return
      const next = ids.filter(id => messageIds.has(id))
      if (next.length !== ids.length)
        apply(next)
    },
    clear: () => apply([]),
    checked,
  }
}

export const MessageSelectionContext = createContext<MessageSelectionStore | null>(null)

const noopSubscribe = () => () => {}

export interface MessageSelectionState {
  isActive: boolean
  isSelected: boolean
  toggle: () => void
}

/** Whether the chat is selecting messages and whether this one is checked. */
export function useMessageSelection (messageId: string | number | undefined): MessageSelectionState {
  const store = useContext(MessageSelectionContext)
  const isActive = useIsSelectionActive(store)
  const isChecked = useKeyedValue(store?.checked, messageId) === true
  const toggle = useCallback(() => {
    if (store && messageId != null)
      store.toggle(messageId)
  }, [store, messageId])

  return { isActive, isSelected: isActive && isChecked, toggle }
}

/** Whether the chat is selecting messages; re-renders only when that flips. */
export function useIsSelectionActive (store: MessageSelectionStore | null): boolean {
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => !!store?.isActive(),
    () => false
  )
}

const NO_IDS: (string | number)[] = []

/**
 * The checked ids; re-renders on every change. The store swaps in a new array on each change,
 * so the array itself is the snapshot (a compiler that memoizes on inputs sees it change).
 */
export function useSelectedIds (store: MessageSelectionStore | null): (string | number)[] {
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => store?.getSelectedIds() ?? NO_IDS,
    () => NO_IDS
  )
}
