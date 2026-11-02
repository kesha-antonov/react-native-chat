import { useState } from 'react'

import { ATTACH_SHIFT, RETURN_DELAYS, ReturnAnimations, elapsedSince, makeReturn } from './animations'

interface UseReturnAnimationsOptions {
  isFieldShown: boolean
  /** How and when the last take ended. */
  lastExit: { reason: 'send' | 'cancel', at: number }
  hasHadTake: boolean
  isRTL: boolean
}

/** How the field's parts come back after a take; null until there has been one. */
export function useReturnAnimations ({ isFieldShown, lastExit, hasHadTake, isRTL }: UseReturnAnimationsOptions) {
  // Computed as the field comes back; `entering` is only read on mount. A
  // cancel has usually spent most of its delay on the lingering bar already.
  const [returnAnimations, setReturnAnimations] = useState<ReturnAnimations | null>(null)
  const [wasFieldShown, setWasFieldShown] = useState(true)
  if (isFieldShown !== wasFieldShown) {
    setWasFieldShown(isFieldShown)
    if (isFieldShown) {
      const { reason, at } = lastExit
      const passed = elapsedSince(at)
      const delays = RETURN_DELAYS[reason]
      setReturnAnimations(makeReturn({
        icons: Math.max(0, delays.icons - passed),
        text: Math.max(0, delays.text - passed),
      }, reason === 'cancel' ? (isRTL ? -ATTACH_SHIFT : ATTACH_SHIFT) : 0))
    }
  }
  return hasHadTake ? returnAnimations : null
}
