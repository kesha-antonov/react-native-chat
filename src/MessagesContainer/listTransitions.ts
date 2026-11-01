import { Easing, LinearTransition } from 'react-native-reanimated'

/**
 * Every row that moves (a message arriving, the typing
 * bubble coming or going, a row growing a reaction) slides to its new place over
 * 250ms on `bezier(0.199, 0.011, 0.279, 0.910)`, instead of jumping there in one frame.
 */
export const LIST_ITEM_DURATION = 250
export const LIST_ITEM_EASING = Easing.bezier(0.199, 0.011, 0.279, 0.91)

export const listCellTransition = LinearTransition
  .duration(LIST_ITEM_DURATION)
  .easing(LIST_ITEM_EASING)
