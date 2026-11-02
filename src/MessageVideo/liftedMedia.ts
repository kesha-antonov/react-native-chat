import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { noteGrowShifts, setMediaLifted, useIsMediaLifted } from '../components/mediaPlayback'

/** A lifted copy marks its media as shown while it is up (see `useReattachAfterLift`). */
export const useMarkLifted = (playerKey: string, isEnabled: boolean) => {
  useEffect(() => {
    if (!isEnabled)
      return
    setMediaLifted(playerKey, true)
    return () => setMediaLifted(playerKey, false)
  }, [playerKey, isEnabled])
}

/**
 * On Android a player draws into one view at a time, the last one attached: the lifted copy takes
 * the picture from the hidden original simply by attaching. The original must not let go of it by
 * setting its player to null - expo-video then throws, as the player still reports a view - so it
 * keeps its prop, and once the copy is gone it mounts its video view again (a new key), which
 * attaches the player back. iOS shows one player in several views and needs none of this.
 */
export const useReattachAfterLift = (playerKey: string) => {
  const isLifted = useIsMediaLifted(playerKey)
  const [epoch, setEpoch] = useState(0)
  const wasLiftedRef = useRef(false)
  useEffect(() => {
    if (wasLiftedRef.current && !isLifted && Platform.OS === 'android')
      setEpoch(value => value + 1)
    wasLiftedRef.current = isLifted
  }, [isLifted])
  return epoch
}

/** Where the grown circle sits, for the long-press copy to sit exactly over it. */
export const useReportGrowShift = (playerKey: string, growShift: number) => {
  useEffect(() => {
    if (growShift)
      noteGrowShifts.set(playerKey, growShift)
    else
      noteGrowShifts.delete(playerKey)
  }, [growShift, playerKey])
  useEffect(() => () => {
    noteGrowShifts.delete(playerKey)
  }, [playerKey])
}
