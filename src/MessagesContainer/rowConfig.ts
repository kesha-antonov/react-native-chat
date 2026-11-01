import { createContext, useRef } from 'react'
import { isSharedValue } from 'react-native-reanimated'

/**
 * The props every message row shares (render functions, styles, actions, labels...), handed to
 * the rows through context rather than as row props, so a row's own props are just its id.
 *
 * Its identity is what decides whether every row re-renders, so it is kept stable across
 * renders that change nothing a row can see:
 *   - event handlers (`onPress`, `onLongPressAvatar`, `reply.onPress`, an action's `onPress`...)
 *     are replaced by permanent proxies that call the latest handler, so a consumer's inline
 *     `onPressMessage={() => ...}` costs nothing
 *   - plain objects and arrays (styles, `messageTextProps`, `reactions`, `labels`) are compared
 *     by content, so an inline style object is free too
 *   - everything else - render functions above all - is compared by reference, because a new
 *     render function may well draw something new; memoize those you pass
 */
export type RowConfig = Record<string, unknown>

export const MessageRowConfigContext = createContext<RowConfig>({})

const HANDLER = /^on[A-Z]/
const MAX_DEPTH = 6
const STABLE = Symbol('stableHandler')

/** Keys that are never walked: refs and list plumbing, compared by reference. */
const OPAQUE_KEYS = new Set(['forwardRef', 'messagesContainerRef', 'textInputRef', 'listProps'])

type Read = () => unknown

const isPlainObject = (value: unknown): value is Record<string, unknown> | unknown[] => {
  if (!value || typeof value !== 'object')
    return false
  if (Array.isArray(value))
    return true
  if ((value as { $$typeof?: unknown }).$$typeof !== undefined || isSharedValue(value))
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const makeHandler = (read: Read) => {
  const handler = (...args: unknown[]) => (read() as ((...a: unknown[]) => unknown) | undefined)?.(...args)
  ;(handler as unknown as Record<symbol, boolean>)[STABLE] = true
  return handler
}

const isStableHandler = (value: unknown) =>
  typeof value === 'function' && !!(value as unknown as Record<symbol, boolean>)[STABLE]

/**
 * `next`, reusing `prev` (or any part of it) wherever nothing a row can see has changed.
 * `read` reaches the same spot in the latest props, for the handler proxies.
 */
export function stabilize (prev: unknown, next: unknown, key: string, read: Read, depth = 0): unknown {
  if (typeof next === 'function' && HANDLER.test(key))
    return isStableHandler(prev) ? prev : makeHandler(read)

  if (depth >= MAX_DEPTH || OPAQUE_KEYS.has(key) || !isPlainObject(next))
    return next

  const isArray = Array.isArray(next)
  const prevIsComparable = isPlainObject(prev) && Array.isArray(prev) === isArray
  const prevRecord = prevIsComparable ? prev as Record<string, unknown> : undefined
  const nextRecord = next as Record<string, unknown>
  const keys = Object.keys(nextRecord)
  let isSame = !!prevRecord && Object.keys(prevRecord).length === keys.length
  const out: Record<string, unknown> = isArray ? [] as unknown as Record<string, unknown> : {}

  for (const k of keys) {
    const value = stabilize(
      prevRecord?.[k],
      nextRecord[k],
      // Array items are named after their parent, so the handlers in `messageActions[i]` are
      // still recognised by their own keys one level down.
      isArray ? key : k,
      () => (read() as Record<string, unknown> | undefined)?.[k],
      depth + 1
    )
    out[k] = value
    if (isSame && (!Object.prototype.hasOwnProperty.call(prevRecord, k) || prevRecord![k] !== value))
      isSame = false
  }

  return isSame ? prev : out
}

/** `config`, keeping the previous identity while nothing a row can see has changed. */
export function useStableRowConfig (config: RowConfig): RowConfig {
  const latestRef = useRef(config)
  latestRef.current = config
  const stableRef = useRef<RowConfig | undefined>(undefined)
  // Recomputed on every render on purpose: it is one walk over the props, done once for the
  // whole list, and it is what spares every row its own comparison.
  const next = stabilize(stableRef.current, config, '', () => latestRef.current) as RowConfig
  stableRef.current = next
  return next
}
