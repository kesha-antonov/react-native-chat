import { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../hooks/useTheme'

/**
 * The toolbar's bottom padding: the home indicator's inset, kept whatever covers it.
 *
 * The composer rides up on the system keyboard or the emoji panel with a transform (see
 * `keyboardLift`), which stops short by this inset, so they cover the padding and the island still
 * floats 9 above them. Giving the padding up as they rose changed the composer's height every
 * frame, and the list above it with it.
 */
export function useKeyboardInset (bottomInsetProp?: number) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const bottomInset = bottomInsetProp ?? insets.bottom
  const bottomGap = theme.spacing.inputToolbarPaddingV
  const insetStyle = useMemo(() => ({ paddingBottom: bottomGap + bottomInset }), [bottomGap, bottomInset])
  return { insetStyle, bottomInset }
}
