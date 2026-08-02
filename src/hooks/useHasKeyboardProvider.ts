import { createContext, useContext } from 'react'
import { KeyboardContext } from 'react-native-keyboard-controller'

type MaybeKeyboardContextValue = {
  reanimated?: { progress?: unknown, height?: unknown }
} | undefined

// `react-native-keyboard-controller/jest` doesn't mock `KeyboardContext`, so fall back to
// an empty context to keep consumers' test suites running.
const Context =
  (KeyboardContext as unknown as React.Context<MaybeKeyboardContextValue> | undefined) ??
  createContext<MaybeKeyboardContextValue>(undefined)

const isReanimatedSharedValue = (value: unknown) =>
  typeof value === 'object' && value !== null && '_isReanimatedSharedValue' in value

/**
 * Whether a `KeyboardProvider` is already mounted above this component.
 *
 * Mounting a second one is not harmless. On Android every provider installs an
 * `OnApplyWindowInsetsListener` on the *activity's* root view and rewrites the content
 * view's margins from its own `statusBarTranslucent` / `navigationBarTranslucent` props,
 * so a nested provider relayouts the whole host app - and it never restores the listener
 * it replaced, leaving the app broken even after the chat screen is gone.
 * See https://github.com/kesha-antonov/react-native-chat/issues/11
 *
 * Detection: with no provider above, `react-native-keyboard-controller` hands out a
 * module-level fallback context. Two details give that fallback away, and neither can
 * hold for a real provider (which creates one shared value per field): both fields point
 * at the very same object, and that object is a hand-rolled stub rather than a Reanimated
 * shared value. Requiring both keeps the failure mode safe - if either detail ever
 * changes we simply mount our own provider, which is what we did before.
 */
export function useHasKeyboardProvider (): boolean {
  const context = useContext(Context)
  const progress = context?.reanimated?.progress
  const height = context?.reanimated?.height

  return progress !== height && isReanimatedSharedValue(progress)
}
