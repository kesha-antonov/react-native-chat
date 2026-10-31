import { Easing } from 'react-native-reanimated'

/**
 * Telegram's send flights (`VoiceMessageEnterTransition` for a voice note,
 * the `instantCameraView` block in `ChatActivity` for a round one): the take's
 * circle in the composer flies into the message that has just been sent, and
 * that message's own button / note stays hidden until it lands.
 *
 * The composer and the message list never meet, so this tiny store hands the
 * landing spot from one to the other. The source (the record button, the
 * camera circle) expects a flight when it sends; the just-sent message lands
 * with its target in window coordinates; the source flies there and reports
 * back when it has arrived.
 */

export type SendFlightKind = 'voice' | 'round'

/** A voice note's play button: its centre, radius and fill. */
export interface VoiceFlightTarget {
  x: number
  y: number
  radius: number
  color: string
  /** The play glyph's colour, so the flight can draw it in as it lands. */
  iconColor?: string
}

/** A round note in the list: its top-left corner and diameter. */
export interface RoundFlightTarget {
  x: number
  y: number
  size: number
}

interface TargetFor {
  voice: VoiceFlightTarget
  round: RoundFlightTarget
}

/**
 * A message counts as the flight's target only this soon after the send:
 * the take still has to be written and the list has to lay the row out.
 */
export const SEND_FLIGHT_EXPECT_MS = 1500
/** The source waits this long for a target before playing its own exit. */
export const SEND_FLIGHT_WAIT_MS = 500
/**
 * A landed target shows itself anyway after this long, in case the source
 * went away mid-flight without reporting back.
 */
export const SEND_FLIGHT_SAFETY_MS = 1500

/** `VoiceMessageEnterTransition`: 220ms of linear progress. */
export const VOICE_FLIGHT_MS = 220
/** The record circle's blobs are gone by 60% of it (`step1Time`). */
export const VOICE_FLIGHT_BLOB_SHARE = 0.6
/** `ChatActivity`'s round note flight: 300ms, then a 100ms crossfade. */
export const ROUND_FLIGHT_MS = 300
export const ROUND_FLIGHT_FADE_MS = 100
/** The landed button fades in under the flight's disc, which then goes. */
export const SEND_FLIGHT_REVEAL_MS = 120

type Listener<T> = (value: T) => void

interface Slot<K extends SendFlightKind> {
  /** When the take was sent; null while no flight is expected. */
  expectedAt: number | null
  target: TargetFor[K] | null
  targetListeners: Set<Listener<TargetFor[K]>>
  finishedListeners: Set<() => void>
}

const createSlot = <K extends SendFlightKind>(): Slot<K> => ({
  expectedAt: null,
  target: null,
  targetListeners: new Set(),
  finishedListeners: new Set(),
})

const slots: { [K in SendFlightKind]: Slot<K> } = {
  voice: createSlot<'voice'>(),
  round: createSlot<'round'>(),
}

/** The source has sent a take and will fly its circle into the new message. */
export function expectSendFlight (kind: SendFlightKind, now = Date.now()) {
  const slot = slots[kind]
  slot.expectedAt = now
  slot.target = null
}

/**
 * A flight is on its way and nothing has landed yet, so a just-sent message
 * can start hidden instead of flashing for the frame its measure takes.
 */
export function isSendFlightExpected (kind: SendFlightKind, now = Date.now()) {
  const slot = slots[kind]
  return slot.expectedAt != null && !slot.target && now - slot.expectedAt <= SEND_FLIGHT_EXPECT_MS
}

/**
 * A just-sent message offers itself as the flight's target. Returns true when
 * a flight was expected: the caller then hides its button / note until
 * `onSendFlightFinished` fires. Only the first message to land is taken.
 */
export function landSendFlight<K extends SendFlightKind> (kind: K, target: TargetFor[K], now = Date.now()) {
  const slot = slots[kind] as unknown as Slot<K>
  if (slot.expectedAt == null || slot.target || now - slot.expectedAt > SEND_FLIGHT_EXPECT_MS)
    return false

  slot.target = target
  slot.targetListeners.forEach(listener => listener(target))
  return true
}

/**
 * The source listens for its target. Fires at once when one has already
 * landed (the row can lay out before the source subscribes).
 */
export function onSendFlightTarget<K extends SendFlightKind> (kind: K, listener: Listener<TargetFor[K]>) {
  const slot = slots[kind] as unknown as Slot<K>
  slot.targetListeners.add(listener)
  if (slot.target)
    listener(slot.target)
  return () => {
    slot.targetListeners.delete(listener)
  }
}

/**
 * The source gave up waiting and plays its own exit, so a message landing
 * late is not hidden for a flight that will never come.
 */
export function abandonSendFlight (kind: SendFlightKind) {
  const slot = slots[kind]
  slot.expectedAt = null
  slot.target = null
}

/** The flight has arrived: the target shows its own button / note again. */
export function finishSendFlight (kind: SendFlightKind) {
  const slot = slots[kind]
  slot.expectedAt = null
  slot.target = null
  const listeners = Array.from(slot.finishedListeners)
  slot.finishedListeners.clear()
  listeners.forEach(listener => listener())
}

/** The target listens for the flight's arrival. */
export function onSendFlightFinished (kind: SendFlightKind, listener: () => void) {
  const slot = slots[kind]
  slot.finishedListeners.add(listener)
  return () => {
    slot.finishedListeners.delete(listener)
  }
}

/** Test-only: forget every flight and listener. */
export function resetSendFlights () {
  (Object.keys(slots) as SendFlightKind[]).forEach(kind => {
    const slot = slots[kind]
    slot.expectedAt = null
    slot.target = null
    slot.targetListeners.clear()
    slot.finishedListeners.clear()
  })
}

// Reanimated's Jest mock returns a non-function from `bezierFn`, hence the
// linear stand-ins.
const bezierOr = (fn: unknown) =>
  typeof fn === 'function'
    ? fn as (t: number) => number
    : (t: number) => {
      'worklet'
      return t
    }

/** Telegram's `CubicBezierInterpolator.DEFAULT` (0.25, 0.1, 0.25, 1). */
export const easeDefault = bezierOr(Easing.bezierFn?.(0.25, 0.1, 0.25, 1))
/** Telegram's `CubicBezierInterpolator.EASE_OUT_QUINT` (0.23, 1, 0.32, 1). */
export const easeOutQuint = bezierOr(Easing.bezierFn?.(0.23, 1, 0.32, 1))
