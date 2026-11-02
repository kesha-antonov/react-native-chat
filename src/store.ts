import { useCallback, useSyncExternalStore } from 'react'

/**
 * The one state container behind the chat's shared state (docs/ARCHITECTURE.md, rule 4).
 *
 * A store holds a value outside React; components read slices of it with `useStore`, and only
 * a component whose slice changed re-renders. A keyed store holds one value per key (a message
 * id) and wakes only that key's readers, so flipping one message's state costs one row, not a
 * selector run in every mounted row.
 */

type Listener = () => void

export interface Store<T> {
  get: () => T
  /** Replaces the value; readers are notified only if it changed (`Object.is`). */
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T> (initial: T): Store<T> {
  let value = initial
  const listeners = new Set<Listener>()

  return {
    get: () => value,
    set: next => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      if (Object.is(resolved, value))
        return
      value = resolved
      listeners.forEach(listener => listener())
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export interface KeyedStore<K, V> {
  get: (key: K) => V | undefined
  has: (key: K) => boolean
  /** Sets one key; only that key's readers (and whole-store subscribers) are notified. */
  set: (key: K, value: V) => void
  delete: (key: K) => void
  /** Removes every key, notifying the readers of each key that had a value. */
  clear: () => void
  keys: () => K[]
  subscribeKey: (key: K, listener: Listener) => () => void
  /** Notified on any change, for the few readers that need the whole map. */
  subscribe: (listener: Listener) => () => void
}

export function createKeyedStore<K, V> (): KeyedStore<K, V> {
  const values = new Map<K, V>()
  const keyListeners = new Map<K, Set<Listener>>()
  const listeners = new Set<Listener>()

  const notify = (key: K) => {
    keyListeners.get(key)?.forEach(listener => listener())
    listeners.forEach(listener => listener())
  }

  return {
    get: key => values.get(key),
    has: key => values.has(key),
    set: (key, value) => {
      if (values.has(key) && Object.is(values.get(key), value))
        return
      values.set(key, value)
      notify(key)
    },
    delete: key => {
      if (!values.delete(key))
        return
      notify(key)
    },
    clear: () => {
      const keys = [...values.keys()]
      values.clear()
      keys.forEach(key => keyListeners.get(key)?.forEach(listener => listener()))
      if (keys.length)
        listeners.forEach(listener => listener())
    },
    keys: () => [...values.keys()],
    subscribeKey: (key, listener) => {
      let set = keyListeners.get(key)
      if (!set) {
        set = new Set()
        keyListeners.set(key, set)
      }
      set.add(listener)
      return () => {
        set.delete(listener)
        if (set.size === 0 && keyListeners.get(key) === set)
          keyListeners.delete(key)
      }
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const noopSubscribe = () => () => {}

/**
 * A slice of a store. The selector should return a primitive or a reference the store keeps
 * (not a new object per call), or the component re-renders on every change of the store.
 * `fallback` is returned when there is no store (a component rendered outside a `Chat`).
 */
export function useStore<T, S> (store: Store<T> | null | undefined, selector: (value: T) => S, fallback: S): S {
  const getSnapshot = () => (store ? selector(store.get()) : fallback)
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot, getSnapshot)
}

/** One key's value; re-renders only when that key changes. */
export function useKeyedValue<K, V> (store: KeyedStore<K, V> | null | undefined, key: K | undefined): V | undefined {
  const subscribe = useCallback(
    (listener: Listener) => (store && key !== undefined ? store.subscribeKey(key, listener) : noopSubscribe()),
    [store, key]
  )
  const getSnapshot = () => (store && key !== undefined ? store.get(key) : undefined)
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
