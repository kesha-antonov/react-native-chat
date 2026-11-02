import { Easing, FadeIn, Keyframe, withDelay, withTiming } from 'react-native-reanimated'

// Pausing a take morphs the record circle into the preview pill
// (`RecordCircle.transformToSeekbar`): over 580ms (voice) or 490ms (video) it
// swells for 38% of the time, shrinks to a dot for 25%, then stretches into
// the pill for the last 37%. The circle plays the first two steps; the pill
// plays the stretch out of the button's corner, and the reverse on resume.
const easeBoth = Easing.bezier(0.42, 0, 0.58, 1)
const STRETCH_FROM_SCALE_X = 0.06
const STRETCH_FROM_SCALE_Y = 0.45

const makeStretchIn = (totalMs: number) => () => {
  'worklet'
  const delay = totalMs * 0.63
  const duration = totalMs * 0.37
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scaleX: STRETCH_FROM_SCALE_X }, { scaleY: STRETCH_FROM_SCALE_Y }],
    },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: duration * 0.4 })),
      transform: [
        { scaleX: withDelay(delay, withTiming(1, { duration, easing: easeBoth })) },
        { scaleY: withDelay(delay, withTiming(1, { duration, easing: easeBoth })) },
      ],
    },
  }
}
export const voiceStretchIn = makeStretchIn(580)
export const videoStretchIn = makeStretchIn(490)

/** Resuming folds the pill back into the button before the circle returns. */
const STRETCH_OUT_MS = 200
export const stretchOut = () => {
  'worklet'
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scaleX: 1 }, { scaleY: 1 }],
    },
    animations: {
      opacity: withDelay(STRETCH_OUT_MS * 0.6, withTiming(0, { duration: STRETCH_OUT_MS * 0.4 })),
      transform: [
        { scaleX: withTiming(STRETCH_FROM_SCALE_X, { duration: STRETCH_OUT_MS, easing: easeBoth }) },
        { scaleY: withTiming(STRETCH_FROM_SCALE_Y, { duration: STRETCH_OUT_MS, easing: easeBoth }) },
      ],
    },
  }
}

// The composer's controls leave as a take starts and come back after it:
// over 150ms decelerate the
// emoji button scales to nothing, the attach button shrinks to half while it
// slides 30 towards the record button, and the text slides 20 the same way,
// all fading. Coming back, the icons grow back in over 150ms and the text
// fades in over 200ms - 200 / 150ms after a send, 700 / 300ms after a cancel.
const DECELERATE = Easing.out(Easing.quad)
export const CONTROLS_MS = 150
const TEXT_IN_MS = 200
export const ATTACH_SHIFT = 30
const TEXT_SHIFT = 20
export const RETURN_DELAYS = {
  send: { icons: 200, text: 150 },
  cancel: { icons: 700, text: 300 },
}

export const emojiOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0 }], easing: DECELERATE },
}).duration(CONTROLS_MS)
const makeAttachOut = (shift: number) => new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateX: shift }, { scale: 0.5 }], easing: DECELERATE },
}).duration(CONTROLS_MS)
export const attachOut = makeAttachOut(ATTACH_SHIFT)
export const attachOutRTL = makeAttachOut(-ATTACH_SHIFT)
const makeTextOut = (shift: number) => new Keyframe({
  0: { opacity: 1, transform: [{ translateX: 0 }] },
  100: { opacity: 0, transform: [{ translateX: shift }], easing: DECELERATE },
}).duration(CONTROLS_MS)
export const textOut = makeTextOut(TEXT_SHIFT)
export const textOutRTL = makeTextOut(-TEXT_SHIFT)

/** The way back in, waiting out whatever of the delay has not passed yet. */
// Read once, as the field comes back, and kept in state from then on: the delays are only
// read when the field's parts mount.
export const elapsedSince = (at: number) => Date.now() - at

export const makeReturn = (delays: { icons: number, text: number }, attachShift: number) => ({
  emoji: new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: DECELERATE },
  }).duration(CONTROLS_MS).delay(delays.icons),
  attach: new Keyframe({
    0: { opacity: 0, transform: [{ translateX: attachShift }, { scale: 0.5 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }], easing: DECELERATE },
  }).duration(CONTROLS_MS).delay(delays.icons),
  text: FadeIn.duration(TEXT_IN_MS).delay(delays.text),
})

export type ReturnAnimations = ReturnType<typeof makeReturn>

// The mic and the send button swap by scaling one to 0.1 while the other grows from it,
// over 220ms on EASE_OUT_QUINT.
const EASE_OUT_QUINT = Easing.bezier(0.23, 1, 0.32, 1)
const SWAP_MS = 220
export const swapIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.1 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT_QUINT },
}).duration(SWAP_MS)
export const swapOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.1 }], easing: EASE_OUT_QUINT },
}).duration(SWAP_MS)
// The emoji button's smile <-> keyboard morph, a short crossfade standing in for a ~300ms Lottie.
export const EMOJI_ICON_SWAP = { duration: 200, easing: Easing.out(Easing.quad) }
// The paperclip steps aside while there is text: half size and transparent over 100ms.
export const ATTACH_HIDE = { duration: 100 }
