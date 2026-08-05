import { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaFrame } from 'react-native-safe-area-context'

/**
 * How far down the window the chat container starts - the value
 * `KeyboardAvoidingView` needs to keep the input toolbar on top of the keyboard.
 *
 * It cannot come from insets: a navigation header draws above the chat and insets
 * cannot see it, so `insets.top` (the old default) placed a chat below a header
 * roughly a header-height too low, i.e. behind the keyboard.
 * See https://github.com/kesha-antonov/react-native-chat/issues/11
 *
 * It cannot come from `useSafeAreaFrame()` alone either. That reads the nearest
 * `SafeAreaProvider`, and react-native-safe-area-context (v5) seeds a nested
 * provider from its *parent's* metrics - so when the host app already mounts one
 * at the root (the documented setup, and what expo-router does), the provider
 * `ChatWrapper` mounts reports the root frame and `y` stays 0 no matter where the
 * chat actually sits. A chat under a navigation header then got offset 0 and its
 * toolbar landed a header-height too low: back behind the keyboard.
 *
 * So the offset is measured from the chat container itself, in window
 * coordinates, and the safe-area frame is kept only as the pre-measurement
 * seed. Attach `onLayout`/`ref` to the view that wraps the chat.
 */
export function useKeyboardVerticalOffset () {
  const frameY = useSafeAreaFrame().y
  const ref = useRef<View>(null)
  const [measured, setMeasured] = useState<number | null>(null)

  const onLayout = useCallback(() => {
    // measureInWindow, not the layout event: the event reports the position
    // within the parent, which is 0 for a fill view and tells us nothing about
    // where the chat sits on screen.
    ref.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y))
        setMeasured(previous => (previous === y ? previous : y))
    })
  }, [])

  return {
    ref,
    onLayout,
    keyboardVerticalOffset: measured ?? frameY,
  }
}
