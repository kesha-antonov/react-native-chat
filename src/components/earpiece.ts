import { useEffect, useRef } from 'react'

import { getAudioApi, getExpoAudio } from '../optional'
import { useIsNearEar } from './mediaPlayback'

/**
 * Telegram's raise to listen (`MediaController.setUseFrontSpeaker` and
 * `startAudioAgain`): with a voice or round note current, holding the phone to
 * the ear moves playback to the earpiece and plays it, restarting a note that
 * had played for under a second; lowering it goes back to the speaker and
 * pauses.
 */

// Both audio engines are optional peers, resolved like everywhere else.
const audioApi = getAudioApi()
const expoAudio = getExpoAudio()

/**
 * `startAudioAgain` seeks to 0 when `audioProgress * duration` is under a
 * second: a note just started is heard from its beginning at the ear.
 */
export const RAISE_RESTART_SECONDS = 1

/**
 * Points both engines at the earpiece or back at the speaker.
 *
 * iOS has one shared AVAudioSession: the `playAndRecord` category without
 * `defaultToSpeaker` plays through the receiver, which is what Telegram's
 * `STREAM_VOICE_CALL` does on Android. `playback` is the plain speaker route
 * the players start in. On Android, expo-audio's `shouldRouteThroughEarpiece`
 * switches the system to communication mode with the speakerphone off;
 * react-native-audio-api has no Android routing of its own.
 */
export const applyEarpieceRoute = (isEarpiece: boolean) => {
  try {
    audioApi?.AudioManager?.setAudioSessionOptions?.(
      isEarpiece
        ? { iosCategory: 'playAndRecord', iosMode: 'default', iosOptions: [] }
        : { iosCategory: 'playback', iosMode: 'default', iosOptions: [] }
    )
  } catch {
    // an engine that cannot route must not stop playback
  }

  try {
    const pending = expoAudio?.setAudioModeAsync?.({
      playsInSilentMode: true,
      allowsRecording: isEarpiece,
      shouldRouteThroughEarpiece: isEarpiece,
    })
    pending?.catch?.(() => {})
  } catch {
    // an engine that cannot route must not stop playback
  }
}

/*
 * Several players can want the earpiece across a hand-over (a note ends at the
 * ear and auto-play starts the next one), so the route is reference counted,
 * and going back to the speaker waits a tick: the next note's claim, made in
 * the same commit, cancels it instead of flipping the route twice.
 */
let holders = 0
let isRouted = false
let restoreTimer: ReturnType<typeof setTimeout> | null = null

/** Holds the earpiece route until the returned release is called. */
export const acquireEarpiece = () => {
  holders++
  if (restoreTimer != null) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
  if (!isRouted) {
    isRouted = true
    applyEarpieceRoute(true)
  }

  let isReleased = false
  return () => {
    if (isReleased)
      return
    isReleased = true
    holders--
    if (holders > 0 || restoreTimer != null)
      return

    restoreTimer = setTimeout(() => {
      restoreTimer = null
      if (holders > 0 || !isRouted)
        return
      isRouted = false
      applyEarpieceRoute(false)
    }, 0)
  }
}

/** Whether audio is currently routed to the earpiece. */
export const isEarpieceRouted = () => isRouted

export type RaiseToListenAction =
  | { type: 'listen', fromStart: boolean }
  | { type: 'pause' }
  | { type: 'release' }
  | null

/**
 * One step of raise to listen. `isListening`: this player holds the earpiece.
 * Raised with the note current: listen (from the start if under a second in).
 * Lowered while listening: back to the speaker and pause. No longer current
 * while listening (it ended or another note took over): drop the claim without
 * pausing, so the next note can keep the earpiece.
 */
export const raiseToListenStep = ({
  isListening,
  isNearEar,
  isCurrent,
  positionSeconds,
}: {
  isListening: boolean
  isNearEar: boolean
  isCurrent: boolean
  positionSeconds: number
}): RaiseToListenAction => {
  if (!isListening)
    return isNearEar && isCurrent
      ? { type: 'listen', fromStart: !(positionSeconds >= RAISE_RESTART_SECONDS) }
      : null

  if (!isNearEar)
    return { type: 'pause' }
  if (!isCurrent)
    return { type: 'release' }
  return null
}

export interface RaiseToListenOptions {
  /** The note is current: playing, or paused part-way. */
  isCurrent: boolean
  /** Seconds played so far. */
  getPositionSeconds: () => number
  /** Play at the ear; `fromStart` rewinds first. */
  listen: (fromStart: boolean) => void
  pause: () => void
}

/**
 * Raise to listen for one player, driven by `mediaPlayback.isNearEar`. Voice
 * and round notes use it. A no-op outside a `Chat`.
 */
export const useRaiseToListen = ({ isCurrent, getPositionSeconds, listen, pause }: RaiseToListenOptions) => {
  const isNearEar = useIsNearEar()
  const releaseRef = useRef<(() => void) | null>(null)
  const actionsRef = useRef({ getPositionSeconds, listen, pause })
  actionsRef.current = { getPositionSeconds, listen, pause }

  useEffect(() => {
    const action = raiseToListenStep({
      isListening: releaseRef.current != null,
      isNearEar,
      isCurrent,
      positionSeconds: actionsRef.current.getPositionSeconds(),
    })
    if (!action)
      return

    if (action.type === 'listen') {
      // Route first, so the first syllable is not heard on the speaker.
      releaseRef.current = acquireEarpiece()
      actionsRef.current.listen(action.fromStart)
      return
    }

    releaseRef.current?.()
    releaseRef.current = null
    if (action.type === 'pause')
      actionsRef.current.pause()
  }, [isNearEar, isCurrent])

  useEffect(() => () => {
    releaseRef.current?.()
    releaseRef.current = null
  }, [])
}
