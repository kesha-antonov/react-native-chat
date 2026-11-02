import { Store } from '../../store'
import { RecordButtonPhase } from '../RecordButton'
import { ClosingTake, Phase, RingProgress } from './types'

export const withFileScheme = (path: string) =>
  path.startsWith('file://') || path.startsWith('http') ? path : `file://${path}`

/** The ring's progress for the session's phase, or for the take that is closing. */
export function ringProgressOf (
  phase: Phase,
  closing: ClosingTake | null,
  elapsedStore: Store<number>,
  maxMs: number
): RingProgress {
  // Closed: the ring holds the share it had when the take ended.
  const progressPhase = phase === 'idle' ? closing?.fromPhase ?? 'idle' : phase
  // While recording, the ring reads the running time itself.
  let progress: RingProgress = 0
  if (progressPhase === 'recording')
    progress = phase === 'idle'
      ? Math.min(1, (closing?.elapsed ?? 0) / maxMs)
      : { elapsed: elapsedStore, maxMs }
  else if (progressPhase !== 'preparing' && progressPhase !== 'idle')
    progress = 1
  return progress
}

/** Which view the overlay shows: the camera, the paused take's preview, or nothing. */
export const overlayKindOf = (phase: Phase, closing: ClosingTake | null, previewUri: string | null) =>
  phase === 'idle'
    ? closing?.kind ?? null
    : phase === 'preview' && previewUri ? 'preview' : 'capture'

export const buttonPhaseOf = (phase: Phase, isLocked: boolean): RecordButtonPhase =>
  phase === 'preview'
    ? 'preview'
    : phase === 'preparing' || phase === 'recording'
      ? (isLocked ? 'locked' : 'recording')
      : 'idle'
