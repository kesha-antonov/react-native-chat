import React, { useEffect } from 'react'
import { useReattachAfterLift } from './liftedMedia'
import { InlinePlayerProps } from './types'
import { expoVideo, inlineVideoPlayers } from './videoPlayers'

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
export const ExpoVideoPlayer = ({ uri, style, videoProps, playerKey }: InlinePlayerProps & { playerKey?: string }) => {
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    p.loop = false
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
