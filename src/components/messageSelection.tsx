import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

/**
 * Multi-select mode: which messages are checked. Rows read it through
 * `useSyncExternalStore` with a per-row snapshot, so checking one message re-renders that row
 * only, and entering or leaving the mode re-renders each row once.
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
}

export function createMessageSelectionStore (): MessageSelectionStore {
  let selected: (string | number)[] = []
  let active = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())

  return {
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isActive: () => active,
    isSelected: messageId => active && selected.includes(messageId),
    getSelectedIds: () => selected,
    start: messageId => {
      active = true
      selected = [messageId]
      emit()
    },
    toggle: messageId => {
      if (!active)
        return
      selected = selected.includes(messageId)
        ? selected.filter(id => id !== messageId)
        : [...selected, messageId]
      if (selected.length === 0)
        active = false
      emit()
    },
    retain: messageIds => {
      if (!active)
        return
      const next = selected.filter(id => messageIds.has(id))
      if (next.length === selected.length)
        return
      selected = next
      if (selected.length === 0)
        active = false
      emit()
    },
    clear: () => {
      if (!active && selected.length === 0)
        return
      active = false
      selected = []
      emit()
    },
  }
}

export const MessageSelectionContext = createContext<MessageSelectionStore | null>(null)

const noopSubscribe = () => () => {}
const inactive = () => 0

/** 0 outside the mode, 1 in it, 2 when this message is checked. */
const NOT_ACTIVE = 0
const ACTIVE = 1
const SELECTED = 2

export interface MessageSelectionState {
  isActive: boolean
  isSelected: boolean
  toggle: () => void
}

/** Whether the chat is selecting messages and whether this one is checked. */
export function useMessageSelection (messageId: string | number | undefined): MessageSelectionState {
  const store = useContext(MessageSelectionContext)
  const state = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store && messageId != null
      ? () => (store.isActive() ? (store.isSelected(messageId) ? SELECTED : ACTIVE) : NOT_ACTIVE)
      : inactive,
    inactive
  )
  const toggle = useCallback(() => {
    if (store && messageId != null)
      store.toggle(messageId)
  }, [store, messageId])

  return { isActive: state !== NOT_ACTIVE, isSelected: state === SELECTED, toggle }
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
