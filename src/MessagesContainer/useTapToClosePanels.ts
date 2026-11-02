import { useCallback, useRef } from 'react'
import { GestureResponderEvent } from 'react-native'

import { useComposerPanels } from '../components/composerPanels'

/** Touch handlers for the list's wrapper: a tap on the chat (not a scroll) closes the emoji keyboard. */
export function useTapToClosePanels () {
  // A tap on the chat (not a scroll) closes the emoji keyboard.
  const composerPanels = useComposerPanels()
  const touchStartRef = useRef<{ x: number, y: number } | null>(null)
  const onListTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
  }, [])
  const onListTouchEnd = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || !composerPanels)
      return
    const moved = Math.abs(event.nativeEvent.pageX - start.x) + Math.abs(event.nativeEvent.pageY - start.y)
    if (moved < 10)
      composerPanels.close()
  }, [composerPanels])

  return { onListTouchStart, onListTouchEnd }
}
