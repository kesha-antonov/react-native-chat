import { useCallback, useEffect, useState } from 'react'
import { KeyboardEvents } from 'react-native-keyboard-controller'

/**
 * Whether the list's scroll bar should stay hidden: from the moment the keyboard starts to move
 * until the user next drags the list. The keyboard lifts the list's content with a native scroll,
 * and Android shows the scroll bar for it; turned back on as the keyboard settled, the bar flashed
 * once more. Back on with the user's own drag, it shows only when they scroll, as before.
 *
 * Returns the flag and the handler to call when the user starts a drag. `isEnabled` exists because
 * this re-renders its consumer: pass `false` and no listener is registered at all.
 */
export function useScrollIndicatorHiddenByKeyboard (isEnabled: boolean = true): [boolean, () => void] {
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    if (!isEnabled) {
      setIsHidden(false)
      return
    }

    const hide = () => setIsHidden(true)
    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', hide),
      KeyboardEvents.addListener('keyboardWillHide', hide),
    ]

    // Guarded for mocks whose `addListener` returns nothing.
    return () => subscriptions.forEach(subscription => subscription?.remove?.())
  }, [isEnabled])

  const onUserScroll = useCallback(() => setIsHidden(false), [])

  return [isHidden, onUserScroll]
}
