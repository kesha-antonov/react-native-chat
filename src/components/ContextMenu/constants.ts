import {
  Easing,
  EasingFunction,
  EasingFunctionFactory,
  ReduceMotion,
} from 'react-native-reanimated'

export const REDUCE_MOTION = ReduceMotion.System
export const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
export const DEFAULT_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1)
export const DECELERATE = Easing.out(Easing.quad)
export const timing = (duration: number, easing: EasingFunction | EasingFunctionFactory = Easing.linear) =>
  ({ duration, easing, reduceMotion: REDUCE_MOTION })

// `OvershootInterpolator(tension)`.
const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const s = t - 1
  return s * s * ((tension + 1) * s + tension) + 1
}

// The scrim: black at 0.2 (`theme.contextMenu.scrim`), in and out over 320ms on
// EASE_OUT_QUINT, with the pressed message redrawn above it in place.
export const SCRIM_MS = 320

// The menu card: rows 48 tall, 18 side padding, a 24 icon with the title 43 after
// it, 16sp text, 12 corners, at least 200 wide.
export const ROW_HEIGHT = 48
export const ROW_PADDING = 18
export const ICON_SIZE = 24
export const TITLE_GAP = 43
export const MENU_RADIUS = 12
export const MENU_MIN_WIDTH = 200
// It unrolls from the top over 150 + 16 x rows ms, each row fading in and dropping 6 into place
// over 180ms as the card passes it; it leaves by shrinking to 0.8 and
// fading over 220ms.
export const ROW_IN_MS = 180
export const ROW_SHIFT = 6
export const CLOSE_MS = 220
/** The bar and card glide after a message the list moved under them (the keyboard leaving). */
export const FOLLOW_MS = 250
export const CLOSE_SCALE = 0.8

// Placement: the popup's right edge 28 left of the finger (20 with the card's
// shadow inset), 6 from the screen sides; its top at the finger, at least 24 below the top and
// clear of the bottom by its height + 48 + 8, and moved up past 240 tall.
export const FINGER_GAP = 20
export const SIDE_INSET = 6
export const TOP_INSET = 24
export const BOTTOM_CLEARANCE = 48 + 8
export const TALL_POPUP = 240
/** Space kept between the lit message and a card moved off it. */
export const MESSAGE_GAP = 8

// The reactions bar: 50 above it in the popup, 4 + 48 + 22 for its
// padding, the pill and the tail; the menu starts 20 into that bottom padding. The pill is 48
// tall with 24 corners, holding 36-wide cells with an 8 inset at each end, at most 7 emojis
// before the expand button. Its "thought bubble" tail: an 8 circle on the pill's bottom edge 32
// in from its end, and a 4 one below it.
export const BAR_OFFSET = 50
export const BAR_PAD_TOP = 4
export const BAR_HEIGHT = 48
export const BAR_PAD_BOTTOM = 22
export const BAR_TO_MENU = BAR_PAD_TOP + BAR_HEIGHT + BAR_PAD_BOTTOM - 20
export const BAR_CELL = 36
export const BAR_INSET = 8
export const BAR_EMOJI = 26
export const BAR_EMOJI_BOX = 34
export const MAX_QUICK_REACTIONS = 7
export const TAIL_BIG = 8
export const TAIL_SMALL = 4
export const TAIL_OFFSET = 32
// Appears over 250ms on Overshoot(0.5), growing from 87.5% across and clipped from the far side
// down to a quarter; each emoji pops in over 150ms, later the farther
// it is from 80% across. A reaction you already chose sits at 0.76 in a circle.
export const BAR_IN = { duration: 250, easing: overshoot(0.5), reduceMotion: REDUCE_MOTION }
export const BAR_CLIP = 0.25
export const BAR_PIVOT = 0.875
export const ITEM_IN_MS = 150
export const ITEM_DELAY_SPREAD = 200
export const SELECTED_SCALE = 0.76
// The expand button grows the bar into the full picker over 350ms, its corners
// going from the bar's 24 to 12.
export const EXPAND = { duration: 350, easing: DEFAULT_CURVE, reduceMotion: REDUCE_MOTION }
export const PANEL_RADIUS = 12
export const PANEL_MAX_HEIGHT = 340
export const PANEL_COLUMNS = 8

// A picked reaction grows where it is, then flies to the message's reaction pill over 220ms,
// EASE_OUT_QUINT across and DEFAULT down, shrinking to the pill's size.
export const FLIGHT_GROW_MS = 150
export const FLIGHT_GROW_SCALE = 1.6
export const FLIGHT_MS = 220
export const PILL_EMOJI = 16
// Where a new pill's emoji lands: the first pill, inside the bubble at its bottom-left (the
// bubble's 9 inset + the pill's 8 padding + half its 20 emoji; 7 + half of 26 up).
export const PILL_X = 9 + 8 + 10
export const PILL_Y = 7 + 13
