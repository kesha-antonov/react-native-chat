import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from './components/Icon'
import { MediaCard } from './components/MediaCard'
import { PauseIcon, PlayIcon } from './components/MediaControls'
import { WaveformPlayer, isWaveformAvailable } from './components/WaveformPlayer'
import { useThemedStyles } from './hooks/useTheme'
import { IMessage, MessageAudioProps } from './Models'
import { ChatTheme } from './Theme'

// Optional inline player. Resolved through a try/catch require so the bundle
// works whether or not the consumer installed `expo-audio` (Metro treats
// try/catch-wrapped requires as optional dependencies). When present, audio
// messages get a real play/pause control with a progress bar; otherwise they
// fall back to a tappable MediaCard that opens the audio in the system player.
let expoAudio: any = null
try {
  expoAudio = require('expo-audio')
} catch {
  expoAudio = null
}

const isExpoAudioAvailable = !!(expoAudio?.useAudioPlayer && expoAudio?.useAudioPlayerStatus)

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0)
    seconds = 0

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Only mounted when expo-audio resolved, so the hooks below always run in a
// stable order.
const ExpoAudioPlayer = ({ uri, position }: { uri: string, position: 'left' | 'right' }) => {
  const player = expoAudio.useAudioPlayer(uri)
  const status = expoAudio.useAudioPlayerStatus(player)
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)

  const isPlaying = !!status?.playing
  const duration: number = status?.duration ?? 0
  const currentTime: number = status?.currentTime ?? 0
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  const togglePlayback = useCallback(() => {
    if (status?.playing) {
      player.pause()
    } else {
      if (status?.didJustFinish || (duration > 0 && currentTime >= duration))
        player.seekTo(0)

      player.play()
    }
  }, [player, status, duration, currentTime])

  return (
    <View style={styles.audioRow}>
      <Pressable
        onPress={togglePlayback}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'pause' : 'play'}
        style={styles.playCircle}
      >
        {isPlaying
          ? <Icon name='pause' color='#fff' size={14} fallback={<PauseIcon color='#fff' size={14} />} />
          : <Icon name='play' color='#fff' size={14} fallback={<PlayIcon color='#fff' size={14} />} />}
      </Pressable>
      <View style={styles.track}>
        {/* progress fill width is a runtime value, so it stays inline */}
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>
        {formatTime(currentTime > 0 ? currentTime : duration)}
      </Text>
    </View>
  )
}

export function MessageAudio<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  audioStyle,
}: Partial<MessageAudioProps<TMessage>>) {
  const uri = currentMessage?.audio

  if (!uri)
    return null

  return (
    <View style={[styles.container, containerStyle]}>
      {isWaveformAvailable
        ? <WaveformPlayer uri={uri} position={position} />
        : isExpoAudioAvailable
          ? <ExpoAudioPlayer uri={uri} position={position} />
          : <MediaCard kind='audio' uri={uri} position={position} style={audioStyle} />}
    </View>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const overlay = position === 'right' ? theme.colors.outgoingOverlay : theme.colors.reactionBackground
  const metaColor = position === 'right' ? theme.colors.outgoingMeta : theme.colors.incomingMeta

  return StyleSheet.create({
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      minWidth: 200,
      gap: 10,
    },
    playCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: overlay,
      overflow: 'hidden',
    },
    trackFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.accent,
    },
    time: {
      fontSize: 12,
      color: metaColor,
      minWidth: 34,
      textAlign: 'right',
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
})
