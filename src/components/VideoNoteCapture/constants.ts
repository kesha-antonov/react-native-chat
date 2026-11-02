import { Easing } from 'react-native-reanimated'

import { ROUND_FLIGHT_FADE_MS, ROUND_FLIGHT_MS, SEND_FLIGHT_WAIT_MS } from '../sendFlight'

export const MAX_ROUND_SIZE = 360
export const RING_GAP = 8
export const RING_STROKE = 3
/** If the capture never reports back after a stop, give up and close. */
export const FINISH_TIMEOUT_MS = 5000
/**
 * How long to wait for a camera to show up before giving up. On Android the
 * device list arrives asynchronously, so it can be empty on the first render.
 */
export const NO_CAMERA_TIMEOUT_MS = 2000
/** A round take shorter than 800ms is dropped. */
export const DEFAULT_MIN_DURATION_MS = 800
/**
 * A round take stops 0.5s before its 60s limit, into the preview rather than sending it.
 */
export const LIMIT_LEAD_MS = 500
/** The pause button is hidden in the last second (`millisecondsRecorded >= 59_000`). */
export const PAUSE_HIDE_LEAD_MS = 1000
/** How long the pinch zoom takes to spring back (`finishZoom`). */
export const ZOOM_RESET_MS = 200
/** The circle opens and closes in 180ms. */
export const ROUND_ANIMATION_MS = 180
/**
 * The blurred layer behind it fades over 520ms, EASE_OUT_QUINT.
 */
export const DIM_ANIMATION_MS = 520
/** That layer is drawn at alpha 232 of 255. */
export const BLUR_LAYER_ALPHA = 232 / 255
/**
 * The layer is the navbar background: the chat blurred under the
 * navbar's own colour. A strong blur with the bar colour washed over it gets
 * closest to that.
 */
export const BLUR_INTENSITY = 60
export const BLUR_WASH_ALPHA = 0.55
/**
 * A sent take's overlay waits for its message, flies there and crossfades, so
 * it stays up for all of that, with room to spare.
 */
export const FLIGHT_CLOSE_MS = SEND_FLIGHT_WAIT_MS + ROUND_FLIGHT_MS + ROUND_FLIGHT_FADE_MS + 200
/** A take longer than this flies off towards the left edge as it closes (`recordedTime > 300`). */
export const SLIDE_OUT_MIN_MS = 300
/** The closed circle ends 24dp from the left edge. */
export const SLIDE_OUT_INSET = 24
/** The camera flip: rotate out to 90deg, switch, rotate back in from -90deg. */
export const FLIP_MS = 580

/** Decelerate and ease-out-quint curves. */
export const DECELERATE = Easing.out(Easing.quad)
export const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
