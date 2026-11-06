import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../hooks/useTheme'

/**
 * The toolbar's bottom padding: the home indicator's inset, given up as the keyboard or the
 * emoji panel (`emojiOpen`) covers it.
 */
export function useKeyboardInset (emojiOpen: SharedValue<number>, bottomInsetProp?: number) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  // The island floats 9 above the home indicator (`INPUT_BUBBLE_BOTTOM`), and 9 above the
  // keyboard once it covers the indicator: the inset fades out with the keyboard's progress.
  const keyboard = useReanimatedKeyboardAnimation()
  const noKeyboard = useSharedValue(0)
  // Guarded for mocks that return nothing.
  const keyboardHeight = keyboard?.height ?? noKeyboard
  const bottomInset = bottomInsetProp ?? insets.bottom
  const bottomGap = theme.spacing.inputToolbarPaddingV
  // Driven by how much of the inset the keyboard actually covers, not by its progress: a
  // floating or split keyboard on Android (or a hardware keyboard's suggestion strip) reports
  // full progress at a height of 0-ish, and the toolbar then dropped onto the gesture bar.
  return useAnimatedStyle(() => {
    const covered = bottomInset > 0 ? Math.min(1, Math.max(0, -keyboardHeight.value / bottomInset)) : 1
    return {
      paddingBottom: bottomGap + bottomInset * (1 - Math.min(1, Math.max(covered, emojiOpen.value))),
    }
  })
}
