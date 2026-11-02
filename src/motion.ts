import { Easing } from 'react-native-reanimated'

/**
 * The library's motion vocabulary (docs/ARCHITECTURE.md, rule 7). The curves are the
 * platform's own, so a component names the curve it means instead of copying its numbers.
 */

/** `cubic-bezier(0.25, 0.1, 0.25, 1)`: the default ease. */
export const EASE_DEFAULT = Easing.bezier(0.25, 0.1, 0.25, 1)
/** `cubic-bezier(0.23, 1, 0.32, 1)`: a fast start that settles softly, for things arriving. */
export const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
/** `cubic-bezier(0, 0, 0.58, 1)`: ease-out. */
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
/** `cubic-bezier(0.42, 0, 1, 1)`: ease-in, for things leaving. */
export const EASE_IN = Easing.bezier(0.42, 0, 1, 1)
/** `cubic-bezier(0.42, 0, 0.58, 1)`: ease-in-out. */
export const EASE_BOTH = Easing.bezier(0.42, 0, 0.58, 1)
/** `cubic-bezier(0.199, 0.011, 0.279, 0.91)`: list items making way and layout changes. */
export const EASE_LAYOUT = Easing.bezier(0.199, 0.011, 0.279, 0.91)
/** A quadratic ease-out, the platform's `DecelerateInterpolator`. */
export const DECELERATE = Easing.out(Easing.quad)

/** The platform's `OvershootInterpolator(tension)`: runs past the end and settles back. */
export const overshoot = (tension: number) => (t: number) => {
  'worklet'
  const s = t - 1
  return s * s * ((tension + 1) * s + tension) + 1
}
