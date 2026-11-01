import { useContext } from 'react'
import { Platform } from 'react-native'
import * as SafeArea from 'react-native-safe-area-context'

// Without a provider (or before it measured) keep clear of the notch and the home indicator.
const FALLBACK_INSETS = Platform.OS === 'ios'
  ? { top: 47, bottom: 34 }
  : { top: 24, bottom: 0 }

/**
 * Insets for an overlay that covers the whole window (a `Modal`). The nearest provider's are
 * often smaller - a navigator hands its screens what the header and tab bar left over, so a
 * stack screen reads a bottom inset of 0 - so keep whichever is larger of those and the
 * window's at launch.
 */
export const useWindowInsets = () => {
  const context = useContext(SafeArea.SafeAreaInsetsContext)
  const initial = SafeArea.initialWindowMetrics?.insets
  if (!context && !initial)
    return FALLBACK_INSETS

  return {
    top: Math.max(context?.top ?? 0, initial?.top ?? 0),
    bottom: Math.max(context?.bottom ?? 0, initial?.bottom ?? 0),
  }
}
