import { useCallback, useState } from 'react'
import { LayoutChangeEvent } from 'react-native'

import { MAX_ROUND_SIZE, RING_GAP, RING_STROKE } from './constants'

/** Lays out the circle as large as the space above the composer allows. */
export function useRoundLayout () {
  const [area, setArea] = useState({ width: 0, height: 0 })
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setArea({ width, height })
  }, [])

  // The preview fills most of the chat.
  const roundSize = Math.max(0, Math.min(area.width * 0.82, area.height - 96, MAX_ROUND_SIZE))
  const ringRadius = roundSize / 2 + RING_GAP
  return {
    area,
    onLayout,
    roundSize,
    ringRadius,
    ringCircumference: 2 * Math.PI * ringRadius,
    ringBox: (ringRadius + RING_STROKE) * 2,
  }
}
