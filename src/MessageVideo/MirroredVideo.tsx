import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { MediaPlaybackController, noteGrowShifts, useIsNoteGrown } from '../components/mediaPlayback'
import { ExpoVideoPlayer } from './ExpoVideoPlayer'
import { useMarkLifted } from './liftedMedia'
import { styles } from './styles'
import { InlinePlayerProps, RoundNotePlayerProps } from './types'
import { expoVideo, inlineVideoPlayers, videoPlayerKey } from './videoPlayers'

/**
 * A round note inside the long-press copy of its message: the original's own player, at the size
 * and place the original has, still playing - as Telegram's lifted message is. It only shows the
 * player; it never claims playback or changes it, so the original carries on as if nothing
 * happened when the menu closes.
 */
export const MirroredRoundNote = ({
  uri,
  videoProps,
  videoStyle,
  noteSize,
  playingNoteSize,
  messageId,
  isIncoming,
  controller,
}: Pick<RoundNotePlayerProps, 'uri' | 'videoProps' | 'videoStyle' | 'noteSize' | 'playingNoteSize' | 'messageId' | 'isIncoming'> & {
  controller: MediaPlaybackController
}) => {
  const playerKey = videoPlayerKey(messageId, uri)!
  const cache = controller.notePlayers
  const [player] = useState(() => cache.get(playerKey, () => {
    const created = expoVideo.createVideoPlayer(uri)
    created.muted = true
    return created
  }))
  useEffect(() => {
    cache.retain(playerKey)
    return () => cache.release(playerKey)
  }, [cache, playerKey])
  useMarkLifted(playerKey, true)

  const isGrown = useIsNoteGrown(messageId)
  const size = isGrown ? playingNoteSize : noteSize
  const shift = isGrown ? noteGrowShifts.get(playerKey) ?? 0 : 0
  const VideoView = expoVideo.VideoView

  return (
    <View style={isIncoming ? styles.noteColumnLeft : styles.noteColumnRight}>
      <View style={[styles.noteWrapper, { transform: [{ translateX: shift }] }]}>
        <View style={[styles.note, { width: size, height: size, borderRadius: size / 2 }, videoStyle]}>
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
            nativeControls={false}
            contentFit='cover'
            {...videoProps}
          />
        </View>
      </View>
    </View>
  )
}

/** An inline video inside the long-press copy of its message: the original's player, if mounted. */
export const MirroredInlineVideo = ({ uri, style, videoProps, playerKey }: InlinePlayerProps & { playerKey: string }) => {
  const player = inlineVideoPlayers.get(playerKey)
  useMarkLifted(playerKey, !!player)

  if (!player)
    return <ExpoVideoPlayer uri={uri} style={style} videoProps={videoProps} />

  const VideoView = expoVideo.VideoView
  return (
    <VideoView
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
