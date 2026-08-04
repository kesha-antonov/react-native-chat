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
 * The `SafeAreaProvider` that `ChatWrapper` mounts right around us reports exactly
 * this: its frame is measured natively against the root view
 * (`offsetDescendantRectToMyCoords` on Android, `convertRect:toView:` on iOS) and
 * refreshed on every layout change. That provider is what makes this work - it is
 * mounted unconditionally on purpose, and every wrapper between it and the
 * `KeyboardAvoidingView` is a zero-offset fill view so that its top edge and the
 * chat's top edge are the same line.
 */
export function useKeyboardVerticalOffset (): number {
  return useSafeAreaFrame().y
}
