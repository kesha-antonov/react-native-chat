import { LayoutAnimationsValues, SharedValue, withTiming } from 'react-native-reanimated'
import { EASE_LAYOUT } from '../motion'

/**
 * Every row that moves (a message arriving, the typing
 * bubble coming or going, a row growing a reaction) slides to its new place over
 * 250ms on `bezier(0.199, 0.011, 0.279, 0.910)`, instead of jumping there in one frame.
 */
export const LIST_ITEM_DURATION = 250
export const LIST_ITEM_EASING = EASE_LAYOUT

/**
 * `LinearTransition` with that duration and easing, while `isAnimated` is on; with it off, a row
 * jumps. The list keeps this one transition for its whole life and flips the shared value
 * instead: setting the list's `itemLayoutAnimation` later swaps the component Legend List wraps
 * each row in, and every row then remounted the next time its container rendered - the first
 * reaction in a chat blinked the rows on screen and reloaded their images.
 */
export const createListCellTransition = (isAnimated: SharedValue<boolean>) => (values: LayoutAnimationsValues) => {
  'worklet'
  const config = { duration: isAnimated.get() ? LIST_ITEM_DURATION : 0, easing: LIST_ITEM_EASING }
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
      width: values.currentWidth,
      height: values.currentHeight,
    },
    animations: {
      originX: withTiming(values.targetOriginX, config),
      originY: withTiming(values.targetOriginY, config),
      width: withTiming(values.targetWidth, config),
      height: withTiming(values.targetHeight, config),
    },
  }
}
