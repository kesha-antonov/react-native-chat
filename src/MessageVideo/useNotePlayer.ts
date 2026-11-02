import { useEffect, useId, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { useMediaPlaybackController, useNotePlayerCache } from '../components/mediaPlayback'
import { expoVideo } from './videoPlayers'

/**
 * A round note's player: taken from the chat's note-player cache, so a playing note outlives its
 * row, and how much of it has buffered while it loads.
 */
export const useNotePlayer = (
  uri: string,
  messageId: string | number | undefined,
  isAutoplay: boolean,
  duration: number | undefined
) => {
  const controller = useMediaPlaybackController()
  const playerCache = useNotePlayerCache()
  const playerId = useId()
  // Keyed by message (and source) inside a chat, so a row that scrolled away
  // and back finds the player its note kept playing on.
  const playerKey = controller && messageId != null ? `${String(messageId)}\u0000${uri}` : playerId
  const [player] = useState(() => playerCache.get(playerKey, () => {
    const created = expoVideo.createVideoPlayer(uri)
    // Silent loop in the list, or a still first
    // frame when autoplay is off.
    created.muted = true
    created.loop = isAutoplay
    if (isAutoplay)
      created.play()
    return created
  }))
  useEffect(() => {
    playerCache.retain(playerKey)
    return () => playerCache.release(playerKey)
  }, [playerCache, playerKey])
  // The round note's button while the file is not here: the cancel ✕ with a ring as it
  // downloads, the arrow when it waits for a tap. expo-video
  // streams, so the ring follows how much of the clip is buffered until it can play.
  const [isPlayerLoading, setIsPlayerLoading] = useState(() => player.status === 'loading' || player.status === 'idle')
  const bufferProgress = useSharedValue(0)
  useEffect(() => {
    const subscription = player.addListener?.('statusChange', (event?: { status?: string }) => {
      setIsPlayerLoading(event?.status === 'loading' || event?.status === 'idle')
    })
    setIsPlayerLoading(player.status === 'loading' || player.status === 'idle')
    return () => subscription?.remove?.()
  }, [player])
  useEffect(() => {
    if (!isPlayerLoading)
      return
    const timer = setInterval(() => {
      const total = player.duration || duration || 0
      if (total > 0)
        bufferProgress.set(Math.min(1, (player.bufferedPosition || 0) / total))
    }, 200)
    return () => clearInterval(timer)
  }, [isPlayerLoading, player, duration, bufferProgress])

  return { controller, playerCache, playerId, playerKey, player, isPlayerLoading, bufferProgress }
}
