import { Dispatch, SetStateAction, useCallback, useRef } from 'react'
import { SharedValue, runOnJS, withTiming } from 'react-native-reanimated'

import { selectionHaptic } from '../haptics'
import { EXPAND, timing } from './constants'

/**
 * The reactions bar growing into the full picker panel, and folding back. `setIsExpanded` keeps
 * the panel's content mounted from the expand until the fold has finished.
 */
export const useExpandPanel = (
  expand: SharedValue<number>,
  menuFade: SharedValue<number>,
  setIsExpanded: Dispatch<SetStateAction<boolean>>
) => {
  const isCollapsingRef = useRef(false)
  const handleExpand = useCallback(() => {
    selectionHaptic()
    isCollapsingRef.current = false
    setIsExpanded(true)
    expand.set(withTiming(1, EXPAND))
    // The actions make way for the panel.
    menuFade.set(withTiming(0, timing(150)))
  }, [expand, menuFade, setIsExpanded])

  // A tap outside the expanded panel (or Android's back) folds it back into the bar and keeps
  // the menu up, as Telegram's emoji window does on Android; only a second tap closes the menu.
  // The panel stays mounted until it has folded away.
  const finishCollapse = useCallback(() => {
    if (isCollapsingRef.current)
      setIsExpanded(false)
    isCollapsingRef.current = false
  }, [setIsExpanded])
  const handleCollapse = useCallback(() => {
    if (isCollapsingRef.current)
      return
    isCollapsingRef.current = true
    expand.set(withTiming(0, EXPAND, finished => {
      if (finished)
        runOnJS(finishCollapse)()
    }))
    menuFade.set(withTiming(1, timing(150)))
  }, [expand, menuFade, finishCollapse])

  return { handleExpand, handleCollapse }
}
