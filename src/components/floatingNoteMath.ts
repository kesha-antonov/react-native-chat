/*
 * Geometry of the floating round note, after Telegram's `PipRoundVideoView`:
 * where it docks, how far a drag may take it, and where it settles - or
 * whether it slides out and closes - when the finger lifts. Kept free of React
 * so it runs on the UI thread inside the drag gesture and under Jest alike.
 */

/** Telegram's PiP circle is 120dp. */
export const FLOATING_NOTE_SIZE = 120
/** Distance kept from the edges it docks to (`getSideCoord`). */
export const FLOATING_NOTE_MARGIN = 10
/** Released this close to an edge, it snaps onto it (`animateToBoundsMaybe`). */
export const FLOATING_NOTE_SNAP = 20
/** Show, hide and settle all run 150ms with a decelerate curve. */
export const FLOATING_NOTE_MS = 150
/** It appears from, and shrinks back to, 80% of its size. */
export const FLOATING_NOTE_HIDDEN_SCALE = 0.8
/**
 * How far ahead a release's velocity carries it, in seconds. Telegram decides
 * on the lift position alone; projecting a little lets a flick reach an edge
 * (or fly off it) the way a flick does everywhere else on the platform.
 */
export const FLOATING_NOTE_FLING_S = 0.1

/** Which edge it is docked to on one axis, or `free` in between. */
export type DockSide = 'start' | 'end' | 'free'

/**
 * A remembered position that survives the area resizing: Telegram stores the
 * side per axis, or the fraction across it (`pipconfig` `sidex`/`px`).
 */
export interface FloatingDock {
  sideX: DockSide
  px: number
  sideY: DockSide
  py: number
}

/** Telegram's first position: the top right corner (`sidex` 1, `sidey` 0). */
export const DEFAULT_FLOATING_DOCK: FloatingDock = { sideX: 'end', px: 0, sideY: 'start', py: 0 }

export interface FloatingArea {
  width: number
  height: number
}

/** One axis of `getSideCoord`: `room` is the area's length less the note's. */
export const sideCoord = (side: DockSide, fraction: number, room: number) => {
  'worklet'
  if (side === 'start')
    return FLOATING_NOTE_MARGIN
  if (side === 'end')
    return room - FLOATING_NOTE_MARGIN
  return Math.round((room - FLOATING_NOTE_MARGIN * 2) * fraction) + FLOATING_NOTE_MARGIN
}

export const dockPoint = (dock: FloatingDock, area: FloatingArea, size = FLOATING_NOTE_SIZE) => {
  'worklet'
  return {
    x: sideCoord(dock.sideX, dock.px, area.width - size),
    y: sideCoord(dock.sideY, dock.py, area.height - size),
  }
}

/**
 * Where a drag may take it: up to half its width past either side, which is
 * how it gets thrown away, but never past the top or bottom.
 */
export const clampDrag = (x: number, y: number, area: FloatingArea, size = FLOATING_NOTE_SIZE) => {
  'worklet'
  const overshoot = size / 2
  return {
    x: Math.min(Math.max(x, -overshoot), area.width - size + overshoot),
    y: Math.min(Math.max(y, 0), Math.max(0, area.height - size)),
  }
}

/** Past a side it fades, down to half at the furthest it may go. */
export const dragAlpha = (x: number, width: number, size = FLOATING_NOTE_SIZE) => {
  'worklet'
  const overshoot = size / 2
  if (x < 0)
    return 1 + (x / overshoot) * 0.5
  if (x > width - size)
    return 1 - ((x - width + size) / overshoot) * 0.5
  return 1
}

export interface FloatingSettle {
  x: number
  y: number
  /** It slides out past a side; playback stops once it is gone. */
  isClosing: boolean
  /** The position to remember, unchanged when closing (Telegram skips the commit). */
  dock: FloatingDock
}

const fraction = (value: number, from: number, to: number) => {
  'worklet'
  return to === from ? 0 : Math.min(1, Math.max(0, (value - from) / (to - from)))
}

/**
 * Where it goes when the finger lifts (`animateToBoundsMaybe`): onto a side
 * when within 20dp of its docked spot or less than a quarter past the edge;
 * out and closed when dragged further past it; otherwise it stays where it was
 * put. Vertically it snaps to the top or bottom spot within 20dp, or stays.
 */
export const settleFloatingNote = (
  x: number,
  y: number,
  velocityX: number,
  area: FloatingArea,
  dock: FloatingDock,
  size = FLOATING_NOTE_SIZE
): FloatingSettle => {
  'worklet'
  const flung = clampDrag(x + velocityX * FLOATING_NOTE_FLING_S, y, area, size).x
  const startX = sideCoord('start', 0, area.width - size)
  const endX = sideCoord('end', 0, area.width - size)
  const startY = sideCoord('start', 0, area.height - size)
  const endY = sideCoord('end', 0, area.height - size)
  const quarter = size / 4

  let nextX = flung
  let sideX: DockSide = 'free'
  let px = fraction(flung, startX, endX)
  if (Math.abs(startX - flung) <= FLOATING_NOTE_SNAP || (flung < 0 && flung > -quarter)) {
    nextX = startX
    sideX = 'start'
    px = 0
  } else if (
    Math.abs(endX - flung) <= FLOATING_NOTE_SNAP ||
    (flung > area.width - size && flung < area.width - size + quarter)
  ) {
    nextX = endX
    sideX = 'end'
    px = 0
  } else if (dragAlpha(flung, area.width, size) !== 1) {
    return { x: flung < 0 ? -size : area.width, y, isClosing: true, dock }
  }

  let nextY = y
  let sideY: DockSide = 'free'
  let py = fraction(y, startY, endY)
  if (Math.abs(startY - y) <= FLOATING_NOTE_SNAP || y <= startY) {
    nextY = startY
    sideY = 'start'
    py = 0
  } else if (Math.abs(endY - y) <= FLOATING_NOTE_SNAP || y >= endY) {
    nextY = endY
    sideY = 'end'
    py = 0
  }

  return { x: nextX, y: nextY, isClosing: false, dock: { sideX, px, sideY, py } }
}
