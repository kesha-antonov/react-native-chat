import { useContext } from 'react'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

/**
 * Whether a `SafeAreaProvider` is already mounted above this component.
 *
 * Mounting a second one causes a visible layout jump on every mount. A nested
 * provider is *seeded* from its parent's metrics and only afterwards measures
 * its own frame, so the first frame renders with the window's insets and the
 * second with the provider's real ones. For a chat inside a navigator that is
 * bottom 34 -> 0 on an iPhone: the input toolbar draws a home-indicator-sized
 * gap, then snaps flush, and the whole conversation shifts with it.
 *
 * Detection is simply whether the context has a value: with no provider above,
 * react-native-safe-area-context hands out `null`.
 *
 * When the app has one we reuse it - its values are already correct for the
 * screen and never change underneath us. We still mount our own when there is
 * none, so a bare `<Chat>` keeps working with no setup.
 */
export function useHasSafeAreaProvider (): boolean {
  return useContext(SafeAreaInsetsContext) != null
}
