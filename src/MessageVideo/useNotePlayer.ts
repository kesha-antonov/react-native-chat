import { useEffect, useId, useState } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { useMediaPlaybackController, useNotePlayerCache } from '../components/mediaPlayback'
import { useVideoStatus } from './useVideoStatus'
import { expoVideo } from './videoPlayers'

/**
 * A round note's player: taken from the chat's note-player cache, so a playing note outlives its
 * row, and how much of it has buffered while it loads.
 */
export const useNotePlayer = (
  uri: string,
  messageId: string | number | undefined,
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
    created.muted = true
    return created
  }))
  useEffect(() => {
    playerCache.retain(playerKey)
    return () => playerCache.release(playerKey)
  }, [playerCache, playerKey])
  // The round note's button while the file is not here: the cancel ✕ with a ring as it
  // downloads, the arrow when it waits for a tap. expo-video
  // streams, so the ring follows how much of the clip is buffered until it can play.
  const status = useVideoStatus(player)
  const isPlayerLoading = status === 'loading' || status === 'idle'
  const isReady = status === 'readyToPlay'
  const bufferProgress = useSharedValue(0)
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

  return { controller, playerCache, playerId, playerKey, player, isReady, isPlayerLoading, bufferProgress }
}
