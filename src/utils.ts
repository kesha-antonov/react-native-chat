import React, { useCallback, useEffect, useRef } from 'react'
import { IMessage } from './Models'

export function renderComponentOrElement<TProps extends Record<string, any>>(
  component: React.ComponentType<TProps> | React.ReactElement | ((props: TProps) => React.ReactNode) | null | undefined,
  props: TProps
): React.ReactNode {
  if (!component)
    return null

  if (React.isValidElement(component))
    // If it's already a React element, clone it with props
    return React.cloneElement(component, props as any)

  if (typeof component === 'function') {
    // Check if it's a class component (has prototype.isReactComponent)
    // Class components must use React.createElement
    const isClassComponent = component.prototype && component.prototype.isReactComponent

    if (isClassComponent)
      return React.createElement(component as React.ComponentType<TProps>, props as any)

    // For function components and render functions, call directly
    // Using createElement with inline arrow functions causes unmount/remount
    // when function reference changes, this matches v2.x behavior
    return (component as (props: TProps) => React.ReactNode)(props)
  }

  // Check for React.memo or React.forwardRef wrapped components
  // These have $$typeof property and should be rendered with createElement
  if (typeof component === 'object' && component !== null && '$$typeof' in component)
    return React.createElement(component as React.ComponentType<TProps>, props as any)

  // If it's neither, return it as-is
  return component
}

export function isSameDay (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  if (!diffMessage || !diffMessage.createdAt)
    return false

  const current = localDayKey(currentMessage.createdAt)
  return !Number.isNaN(current) && current === localDayKey(diffMessage.createdAt)
}

/**
 * The local calendar day of a timestamp as one number (20261102), NaN when it is not a date.
 * Grouping and the date separators compare neighbours' days for every message on each change
 * to the list (a send, a status tick, every frame of a streamed reply); two dayjs objects and
 * an `isSame('day')` per comparison made that the costliest part of a list update.
 */
export function localDayKey (value: Date | number | string | undefined) {
  if (value == null)
    return NaN
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (Number.isNaN(time))
    return NaN
  return date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate()
}

export function isSameUser (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  return !!(
    diffMessage &&
    diffMessage.user &&
    currentMessage.user &&
    diffMessage.user._id === currentMessage.user._id
  )
}

/** Bubbles sent within five minutes of each other are grouped into one run. */
export const GROUP_MAX_GAP_MS = 5 * 60 * 1000

const toTime = (value: Date | number | undefined) => {
  if (value == null)
    return NaN

  return typeof value === 'number' ? value : new Date(value).getTime()
}

/**
 * Whether two adjacent messages belong to one run of bubbles: the same sender, the same day,
 * at most five minutes apart, and neither a system message. A run shares one tail, one
 * avatar and one sender name, with 2pt between its bubbles instead of 6.
 */
export function isSameGroup (
  currentMessage: IMessage | null | undefined,
  diffMessage: IMessage | null | undefined
) {
  if (!currentMessage || !diffMessage)
    return false

  if (currentMessage.system || diffMessage.system)
    return false

  if (!isSameUser(currentMessage, diffMessage) || !isSameDay(currentMessage, diffMessage))
    return false

  const gap = Math.abs(toTime(currentMessage.createdAt) - toTime(diffMessage.createdAt))
  return Number.isFinite(gap) && gap <= GROUP_MAX_GAP_MS
}

function processCallbackArguments (args: unknown[]): unknown[] {
  const [e, ...rest] = args
  const { nativeEvent } = (e as { nativeEvent?: unknown }) || {}
  let params: unknown[] = []
  if (e) {
    if (nativeEvent)
      params.push({ nativeEvent })
    else
      params.push(e)
    if (rest)
      params = params.concat(rest)
  }

  return params
}

export function useCallbackDebounced<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)
    if (timeoutId.current)
      clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      callbackFunc(...params as Parameters<T>)
    }, time)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      if (timeoutId.current)
        clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}

export function useCallbackThrottled<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const lastExecution = useRef<number>(0)
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  // we use function instead of arrow to access arguments object
  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)

    const now = Date.now()
    const timeSinceLastExecution = now - lastExecution.current

    if (timeSinceLastExecution >= time) {
      // Execute immediately if enough time has passed
      lastExecution.current = now
      callbackFunc(...params as Parameters<T>)
    } else {
      // Schedule execution for the remaining time
      clearTimeout(timeoutId.current)
      timeoutId.current = setTimeout(() => {
        lastExecution.current = Date.now()
        callbackFunc(...params as Parameters<T>)
      }, time - timeSinceLastExecution)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}
