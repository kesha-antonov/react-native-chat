import React, { useContext } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { MediaCard } from '../components/MediaCard'
import { LiftedPlaybackContext } from '../components/mediaPlayback'
import { isFreshOutgoingNote } from '../components/voiceWaveform'
import { IMessage, MessageVideoProps } from '../Models'
import { NOTE_SIZE_RATIO, PLAYING_NOTE_INSET } from './constants'
import { ExpoVideoPlayer } from './ExpoVideoPlayer'
import { MirroredInlineVideo, MirroredRoundNote } from './MirroredVideo'
import { RoundNotePlayer } from './RoundNotePlayer'
import { styles } from './styles'
import { isExpoVideoAvailable, isRoundNotePlayerAvailable, videoPlayerKey } from './videoPlayers'
import { VideoTransferOverlay } from './VideoTransferOverlay'

export function MessageVideo<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  videoStyle,
  videoProps,
}: Partial<MessageVideoProps<TMessage>>) {
  const { width, height } = useWindowDimensions()
  // Inside a long-press copy: show what the original plays (see `MirroredRoundNote`).
  const lifted = useContext(LiftedPlaybackContext)
  const shortSide = Math.min(width, height)
  const noteSize = shortSide * NOTE_SIZE_RATIO
  const playingNoteSize = shortSide - PLAYING_NOTE_INSET
  const uri = currentMessage?.video

  if (!uri)
    return null

  const isNote = !!currentMessage?.videoNote
  const noteStyle = { width: noteSize, height: noteSize, borderRadius: noteSize / 2 }

  return (
    <View
      style={[
        styles.container,
        isNote && styles.noteContainer,
        // A note follows its sender's side; hardcoding flex-end detached an
        // incoming note from the left edge of its row.
        isNote && (position === 'right' ? styles.noteRight : styles.noteLeft),
        containerStyle,
      ]}
    >
      {isExpoVideoAvailable && (!isNote || isRoundNotePlayerAvailable)
        ? isNote
          ? lifted && currentMessage?._id != null
            ? (
              <MirroredRoundNote
                uri={uri}
                videoProps={videoProps}
                videoStyle={videoStyle}
                noteSize={noteSize}
                playingNoteSize={playingNoteSize}
                messageId={currentMessage._id}
                isIncoming={position === 'left'}
                controller={lifted}
              />
            )
            : (
              <RoundNotePlayer
              // A new note in this bubble (the uri changed) gets a fresh player and state
              // rather than inheriting the previous one's.
                key={`${String(currentMessage?._id)}:${uri}`}
                uri={uri}
                videoProps={videoProps}
                videoStyle={videoStyle}
                duration={currentMessage?.duration}
                noteSize={noteSize}
                playingNoteSize={playingNoteSize}
                messageId={currentMessage?._id}
                isIncoming={position === 'left'}
                isMediaUnread={currentMessage?.isMediaUnread}
                animateAppear={isFreshOutgoingNote(position, currentMessage?.createdAt)}
                message={currentMessage}
                isViewOnce={!!currentMessage?.isViewOnce}
                transcription={currentMessage?.transcription}
              />
            )
          : (
            <View>
              {lifted && videoPlayerKey(currentMessage?._id, uri)
                ? <MirroredInlineVideo uri={uri} style={[styles.video, videoStyle]} videoProps={videoProps} playerKey={videoPlayerKey(currentMessage?._id, uri)!} />
                : <ExpoVideoPlayer uri={uri} style={[styles.video, videoStyle]} videoProps={videoProps} playerKey={videoPlayerKey(currentMessage?._id, uri)} />}
              {currentMessage && <VideoTransferOverlay message={currentMessage} />}
            </View>
          )
        : <MediaCard kind='video' uri={uri} position={position} style={[isNote && noteStyle, videoStyle]} />}
    </View>
  )
}
