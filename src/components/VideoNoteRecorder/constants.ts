import { getSvg } from '../../optional'

// Optional SVG, used to draw the circular progress ring around the note. When
// absent the recorder still works, just without the ring.
const svg = getSvg()
export const Svg: any = svg ? svg.Svg ?? svg.default : null
export const SvgCircle: any = svg?.Circle ?? null

// The preview fills most of the screen width.
export const NOTE_WIDTH_RATIO = 0.88
export const MAX_ROUND_SIZE = 360
/** Gap between the circle's edge and the progress arc. */
export const RING_GAP = 10
export const RING_STROKE = 3
/** Vertical space the bottom controls occupy, kept clear of the preview. */
export const CONTROLS_HEIGHT = 170

export const withFileScheme = (path: string) =>
  path.startsWith('file://') || path.startsWith('http') ? path : `file://${path}`

/**
 * `m:ss,t` with tenths, like the recording bar - the moving decimal is
 * what tells you the recorder is actually live.
 */
export const formatElapsedTenths = (ms: number) => {
  const tenthsTotal = Math.floor(ms / 100)
  const tenths = tenthsTotal % 10
  const secs = Math.floor(tenthsTotal / 10) % 60
  const mins = Math.floor(tenthsTotal / 600)
  return `${mins}:${secs.toString().padStart(2, '0')},${tenths}`
}
