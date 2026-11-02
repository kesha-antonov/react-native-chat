import { DependencyList, useLayoutEffect, useRef } from 'react'

function areDepsEqual (a: DependencyList, b: DependencyList): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++)
    if (!Object.is(a[i], b[i]))
      return false
  return true
}

/**
 * A custom useEffect hook that only triggers on updates, not on initial mount
 * Idea stolen from: https://stackoverflow.com/a/55075818/1526448
 * @param {()=>void} effect the function to call
 * @param {DependencyList} dependencies the state(s) that fires the update
 */
export function useUpdateLayoutEffect (
  effect: () => void,
  dependencies: DependencyList = []
) {
  // `dependencies` is the caller's list, so it cannot be handed to useLayoutEffect as a
  // literal array (React Compiler would skip this hook). Compare it by hand instead, the way
  // React compares a dependency list; `null` marks the mount, which must not fire.
  const prevDependencies = useRef<DependencyList | null>(null)

  useLayoutEffect(() => {
    const prev = prevDependencies.current
    prevDependencies.current = dependencies
    if (prev !== null && !areDepsEqual(prev, dependencies))
      effect()
  })
}
