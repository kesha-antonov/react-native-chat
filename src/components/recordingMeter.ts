import { createContext } from 'react'

import { createStore, Store } from '../store'

/**
 * A take's running time and loudness, which tick ten times a second while recording. They live
 * in stores rather than in component state so that a tick re-renders only the timer that shows
 * it (and moves the record button's halo without a render), not the composer around them.
 *
 * `elapsed` keeps the last take's time after it ends, so the bar that lingers after a cancel
 * still shows when the take stopped; a new take resets it.
 */
export interface RecordingMeter {
  elapsed: Store<number>
  /** The latest metering level, 0..1. */
  level: Store<number>
}

export const createRecordingMeter = (): RecordingMeter => ({
  elapsed: createStore(0),
  level: createStore(0),
})

/** The composer's meter; a recorder outside a composer keeps its own. */
export const RecordingMeterContext = createContext<RecordingMeter | null>(null)

export const sameNumber = (value: number) => value
