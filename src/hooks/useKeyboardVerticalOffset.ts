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
 *
 * `isMeasured` reports whether that real measurement has landed yet, as opposed
 * to `keyboardVerticalOffset` still being the seed. It exists because the seed
 * can be wrong, not just imprecise: Chat mounts its own `SafeAreaProvider`
 * seeded with the *window's* frame (`y = 0`), so a chat nested below a header
 * briefly reports offset 0 - correct for a full-screen chat, wrong for this one -
 * until `measureInWindow`'s native round trip resolves. Reveal the toolbar only
 * once `isMeasured` is true so it never paints at that wrong offset, which
 * otherwise showed as the toolbar sitting under the keyboard for a frame when
 * the keyboard was already up as the chat mounted.
 * See https://github.com/kesha-antonov/react-native-chat/issues/12
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
    isMeasured: measured !== null,
  }
}
