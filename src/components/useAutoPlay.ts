import { RefObject, useEffect, useRef } from 'react'

export function useAutoPlay (
  enabled: boolean | undefined,
  isReady: boolean,
  play: () => void,
  hasStarted?: RefObject<boolean>
) {
  const attempted = useRef(false)
  useEffect(() => {
    if (!enabled || !isReady || attempted.current || hasStarted?.current)
      return

    attempted.current = true
    play()
  }, [enabled, isReady, play, hasStarted])
}
