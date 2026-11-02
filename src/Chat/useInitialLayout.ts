import { useCallback, useState } from 'react'
import { LayoutChangeEvent } from 'react-native'
import { KeyboardVerticalOffset, useKeyboardVerticalOffset } from '../hooks/useKeyboardVerticalOffset'
import { Store } from '../store'

/**
 * The chat's first layout: it seeds the composer's text and measures where the chat starts in the
 * window, and the chat stays hidden until both have happened.
 */
export function useInitialLayout ({
  initialText,
  textStore,
  getTextFromProp,
  notifyInputTextReset,
}: {
  initialText: string
  textStore: Store<string>
  getTextFromProp: (fallback: string) => string
  notifyInputTextReset: () => void
}): {
  isReady: boolean
  keyboardOffsetRef: KeyboardVerticalOffset['ref']
  keyboardVerticalOffset: number
  onInitialLayoutViewLayout: (e: LayoutChangeEvent) => void
} {
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  // Measures where the chat starts in the window, which is what the
  // KeyboardAvoidingView needs to keep the toolbar on the keyboard.
  const {
    ref: keyboardOffsetRef,
    onLayout: measureKeyboardOffset,
    keyboardVerticalOffset,
    isMeasured: isKeyboardOffsetMeasured,
  } = useKeyboardVerticalOffset()

  // Reveal only once the real offset has been measured, not just once the layout
  // event that kicked off measuring it has fired - `isInitialized` alone let the
  // toolbar paint for a frame at the pre-measurement seed, which is offset 0 for
  // any chat that isn't full-screen. See `useKeyboardVerticalOffset` (#12).
  const isReady = isInitialized && isKeyboardOffsetMeasured

  const onInitialLayoutViewLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // Runs on every layout, not just the first: a header appearing or the
      // device rotating moves the chat's top edge.
      measureKeyboardOffset()

      if (isInitialized)
        return

      const { layout } = e.nativeEvent

      if (layout.height <= 0)
        return

      notifyInputTextReset()

      setIsInitialized(true)
      textStore.set(getTextFromProp(initialText ?? ''))
    },
    [isInitialized, initialText, notifyInputTextReset, getTextFromProp, measureKeyboardOffset, textStore]
  )

  return { isReady, keyboardOffsetRef, keyboardVerticalOffset, onInitialLayoutViewLayout }
}
