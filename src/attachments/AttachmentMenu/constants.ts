import { Easing, ReduceMotion } from 'react-native-reanimated'

import { IconName } from '../../Icons'
import { AttachmentTab } from '../types'

export const REDUCE_MOTION = ReduceMotion.System
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
export const EASE_IN = Easing.bezier(0.42, 0, 1, 1)
export const EASE_BOTH = Easing.bezier(0.42, 0, 0.58, 1)
export const DECELERATE = Easing.out(Easing.quad)
// An overshoot with tension 0.7, the dim's way in.
export const overshoot07 = (t: number) => {
  'worklet'
  const s = t - 1
  return s * s * (1.7 * s + 0.7) + 1
}

// The sheet rises on a spring of damping ratio 0.75 and stiffness 350; the dim fades in over
// 400ms after 20; both leave over 180ms on EASE_OUT.
export const SHEET_SPRING = { stiffness: 350, damping: 2 * 0.75 * Math.sqrt(350), mass: 1, reduceMotion: REDUCE_MOTION }
export const DIM_IN = { duration: 400, easing: overshoot07, reduceMotion: REDUCE_MOTION }
export const CLOSE = { duration: 180, easing: EASE_OUT, reduceMotion: REDUCE_MOTION }
// Opens to about 2/5 down the screen and scrolls up to full height, with
// a 36 x 4 handle and 12 top corners.
export const OPEN_FRACTION = 0.4
export const SHEET_RADIUS = 12
export const HEADER = 22
// The grid: 3 columns, 2 padding and gap, the first row's outer corners at 16.
export const COLUMNS = 3
export const GRID_GAP = 2
export const GRID_RADIUS = 16
// Selection: a 24 disc 4 from the top-right corner, numbered in bold 14; the picked photo
// shrinks to 0.787; both over 200ms.
export const CHECK_SIZE = 24
export const CHECK_INSET = 4
export const SELECTED_SCALE = 0.787
export const SELECT_MS = 200
// The floating tab pill: 56 tall (radius 28) in a 70 row; tabs `width / min(4.5, count)`, at
// most 84; 24 icons, 11 bold labels; the selected one gets a 9% capsule growing from 0.6 over
// 320ms.
export const TABS_ROW = 70
export const TAB_PILL = 56
export const TAB_MAX_WIDTH = 84
export const TAB_ICON = 24
export const TAB_SELECT_MS = 320
// On open the tabs pop in one after another, 32ms apart from the fourth leftwards: 0 -> 1.1 over
// 200ms, then 1.1 -> 1 over 100ms.
export const TAB_STAGGER_MS = 32
// The first pick swaps the tabs for the caption and the send button: the tabs drop 36 and fade,
// the send button grows from 0.2, over 180ms.
export const CAPTION_SWAP_MS = 180
export const TAB_DROP = 36
export const SEND_SIZE = 48
// A new tab's content slides up from 78 and springs into place.
export const TAB_CONTENT_SHIFT = 78
export const TAB_CONTENT_SPRING = { stiffness: 500, damping: 2 * 0.75 * Math.sqrt(500), mass: 1, reduceMotion: REDUCE_MOTION }

export const PANEL_HEIGHT = 150

export const TAB_ICONS: Record<AttachmentTab, IconName> = {
  gallery: 'gallery',
  camera: 'camera',
  file: 'file',
  location: 'location',
}
