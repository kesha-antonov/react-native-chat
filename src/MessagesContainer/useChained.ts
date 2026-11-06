import { useMemo } from 'react'

/**
 * One handler that calls the list's own and then the app's, keeping its identity while neither
 * changes. Without the app's handler it is the list's own.
 */
 
export function useChained<TArgs extends any[]> (
  own: ((...args: NoInfer<TArgs>) => void) | undefined,
  user: ((...args: TArgs) => void) | undefined
): ((...args: TArgs) => void) | undefined {
  return useMemo(() => {
    if (!user)
      return own
    if (!own)
      return user
    return (...args: TArgs) => {
      own(...args)
      user(...args)
    }
  }, [own, user])
}
