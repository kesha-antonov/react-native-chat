import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native'
import { MediaCard } from './components/MediaCard'
import { claimPlayback, releasePlayback } from './components/mediaPlayback'
import { VideoNoteMeta, VideoNoteOverlay } from './components/VideoNoteOverlay'
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

// A Telegram round note is sized from the screen, not a fixed puck.
const NOTE_WIDTH_RATIO = 0.62
const MAX_NOTE_SIZE = 260

interface InlinePlayerProps {
  uri: string
  style: StyleProp<ViewStyle>
  videoProps?: object
  isNote?: boolean
  /** Length in seconds, shown under the note. */
  duration?: number
  /** Diameter of the round note, derived from the screen width. */
  noteSize: number
}

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
const ExpoVideoPlayer = ({ uri, style, videoProps, isNote, duration, noteSize }: InlinePlayerProps) => {
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    // A note holds its first frame muted. It does NOT autoplay: every note in
    // the list would otherwise decode and loop at once, and there would be no
    // way to ever hear one.
    p.loop = false
    if (isNote)
      p.muted = true
  })
  const VideoView = expoVideo.VideoView
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  // A note counts as watched once it has been played through at least once.
  const [isWatched, setIsWatched] = useState(false)
  const playerId = useId()
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const pause = useCallback(() => {
    try {
      player.pause()
    } catch {
      // player already torn down
    }
    stopRaf()
    setIsPlaying(false)
  }, [player, stopRaf])

  // Drives the progress ring. expo-video has no per-frame callback, so the
  // position is sampled on the display link while playing.
  const tick = useCallback(() => {
    const total = player.duration || duration || 0
    if (total > 0) {
      const next = Math.min(1, (player.currentTime || 0) / total)
      setProgress(next)

      if (next >= 1) {
        stopRaf()
        releasePlayback(playerId)
        setIsPlaying(false)
        setProgress(0)
        setIsMuted(true)
        setIsWatched(true)
        return
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [player, duration, stopRaf, playerId])

  useEffect(() => () => {
    stopRaf()
    releasePlayback(playerId)
  }, [stopRaf, playerId])

  // Tap a note to play it with sound, tap again to pause - the round note has no
  // native controls, so this press target is its only affordance.
  const togglePlayback = useCallback(() => {
    if (!isNote)
      return

    if (isPlaying) {
      pause()
      releasePlayback(playerId)
      return
    }

    player.muted = false
    setIsMuted(false)
    if (progress <= 0)
      player.currentTime = 0
    player.play()
    setIsPlaying(true)
    // Starting stops any other note or voice message, as Telegram does.
    claimPlayback(playerId, pause)
    stopRaf()
    rafRef.current = requestAnimationFrame(tick)
  }, [isNote, isPlaying, player, pause, playerId, tick, stopRaf, progress])

  const view = (
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

  if (!isNote)
    return view

  return (
    <View>
      <Pressable
        onPress={togglePlayback}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'pause video note' : 'play video note'}
      >
        {view}
        <VideoNoteOverlay
          size={noteSize}
          progress={progress}
          isMuted={isMuted}
          isPlaying={isPlaying}
        />
      </Pressable>
      {/* Telegram puts the length under the circle, on the chat background. */}
      <VideoNoteMeta duration={duration} isWatched={isWatched} />
    </View>
  )
}

export function MessageVideo<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  videoStyle,
  videoProps,
}: Partial<MessageVideoProps<TMessage>>) {
  const { width } = useWindowDimensions()
  const noteSize = Math.min(width * NOTE_WIDTH_RATIO, MAX_NOTE_SIZE)
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
      {isExpoVideoAvailable
        ? (
          <ExpoVideoPlayer
            uri={uri}
            style={[isNote ? [styles.note, noteStyle] : styles.video, videoStyle]}
            videoProps={videoProps}
            isNote={isNote}
            duration={currentMessage?.duration}
            noteSize={noteSize}
          />
        )
        : <MediaCard kind='video' uri={uri} position={position} style={[isNote && noteStyle, videoStyle]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  // A round note floats without bubble chrome (the Bubble strips its
  // background). It must not clip: the duration sits below the circle.
  noteContainer: {
    overflow: 'visible',
  },
  noteLeft: {
    alignSelf: 'flex-start',
  },
  noteRight: {
    alignSelf: 'flex-end',
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
    backgroundColor: '#000',
  },
})
