import React, { useEffect, useId } from 'react'
import { claimPlayback, releasePlayback } from '../components/mediaPlayback'
import { useAutoPlay } from '../components/useAutoPlay'
import { useReattachAfterLift } from './liftedMedia'
import { InlinePlayerProps } from './types'
import { useVideoStatus } from './useVideoStatus'
import { expoVideo, inlineVideoPlayers } from './videoPlayers'

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
export const ExpoVideoPlayer = ({ uri, style, videoProps, playerKey, autoPlay }: InlinePlayerProps & { playerKey?: string }) => {
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    p.loop = false
  })
  const status = useVideoStatus(player)
  const playbackId = useId()
  useEffect(() => {
    const subscription = player.addListener?.('playToEnd', () => releasePlayback(playbackId))
    return () => {
      subscription?.remove?.()
      releasePlayback(playbackId)
    }
  }, [player, playbackId])
  useAutoPlay(autoPlay, status === 'readyToPlay', () => {
    if (!player.playing) {
      player.play()
      claimPlayback(playbackId, () => player.pause())
    }
  })
  const VideoView = expoVideo.VideoView
  useEffect(() => {
    if (!playerKey)
      return
    inlineVideoPlayers.set(playerKey, player)
    return () => {
      if (inlineVideoPlayers.get(playerKey) === player)
        inlineVideoPlayers.delete(playerKey)
    }
  }, [playerKey, player])
  const liftEpoch = useReattachAfterLift(playerKey ?? '')

  return (
    <VideoView
      key={liftEpoch}
      style={style}
      player={player}
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      nativeControls
      contentFit='cover'
      {...videoProps}
    />
  )
}
