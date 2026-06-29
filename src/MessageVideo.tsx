import React from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { MediaCard } from './components/MediaCard'
import { IMessage, MessageVideoProps } from './Models'

// Optional inline player. Resolved through a try/catch require so the bundle
// works whether or not the consumer installed `expo-video` - Metro treats
// try/catch-wrapped requires as optional dependencies and won't fail the build
// when the module is absent. When present, messages render a real inline
// player; otherwise they fall back to a tappable MediaCard.
let expoVideo: any = null
try {
  expoVideo = require('expo-video')
} catch {
  expoVideo = null
}

const isExpoVideoAvailable = !!(expoVideo?.VideoView && expoVideo?.useVideoPlayer)

// Diameter of a Telegram-style round video note.
const NOTE_SIZE = 200

interface InlinePlayerProps {
  uri: string
  style: StyleProp<ViewStyle>
  videoProps?: object
  isNote?: boolean
}

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
const ExpoVideoPlayer = ({ uri, style, videoProps, isNote }: InlinePlayerProps) => {
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    // Video notes autoplay muted on a loop, like Telegram's round previews.
    p.loop = !!isNote
    if (isNote) {
      p.muted = true
      p.play()
    }
  })
  const VideoView = expoVideo.VideoView

  return (
    <VideoView
      style={style}
      player={player}
      fullscreenOptions={{ enable: !isNote }}
      allowsPictureInPicture={!isNote}
      nativeControls={!isNote}
      contentFit='cover'
      {...videoProps}
    />
  )
}

export function MessageVideo<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  videoStyle,
  videoProps,
}: Partial<MessageVideoProps<TMessage>>) {
  const uri = currentMessage?.video

  if (!uri)
    return null

  const isNote = !!currentMessage?.videoNote

  return (
    <View style={[styles.container, isNote && styles.noteContainer, containerStyle]}>
      {isExpoVideoAvailable
        ? <ExpoVideoPlayer uri={uri} style={[isNote ? styles.note : styles.video, videoStyle]} videoProps={videoProps} isNote={isNote} />
        : <MediaCard kind='video' uri={uri} position={position} style={[isNote && styles.note, videoStyle]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  // A round note floats without bubble chrome (the Bubble strips its background).
  noteContainer: {
    alignSelf: 'flex-end',
    borderRadius: NOTE_SIZE / 2,
  },
  video: {
    width: 220,
    height: 140,
    borderRadius: 12,
    margin: 6,
    // Dark placeholder so the bubble reads as a video while the first frame
    // loads, instead of flashing a white void.
    backgroundColor: '#000',
  },
  note: {
    width: NOTE_SIZE,
    height: NOTE_SIZE,
    borderRadius: NOTE_SIZE / 2,
    backgroundColor: '#000',
  },
})
