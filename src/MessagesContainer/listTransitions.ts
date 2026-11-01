import { Easing, EntryAnimationsValues, LinearTransition, withTiming } from 'react-native-reanimated'

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

/**
 * The newest message rises into its place from just below it, in step with the rows above
 * it moving up to make room. The list is inverted, so "below" is a smaller `originY`.
 */
export const newestCellEntering = (values: EntryAnimationsValues) => {
  'worklet'
  return {
    initialValues: {
      originY: values.targetOriginY - values.targetHeight,
    },
    animations: {
      originY: withTiming(values.targetOriginY, { duration: LIST_ITEM_DURATION, easing: LIST_ITEM_EASING }),
    },
  }
}

/**
 * Whether the row for `id` at `index` is a message that has just arrived at the newest end:
 * not one that was already in the list on the last commit, and not part of the first batch
 * of messages a chat is opened with (that one appears at once).
 */
export function isArrivingMessage (
  id: string | number,
  index: number,
  knownIds: ReadonlySet<string | number>
): boolean {
  return index === 0 && knownIds.size > 0 && !knownIds.has(id)
}
