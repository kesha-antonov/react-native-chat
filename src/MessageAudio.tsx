import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRaiseToListen } from './components/earpiece'
import { MediaCard } from './components/MediaCard'
import { getMediaPalette } from './components/mediaPalette'
import {
  StopReason,
  claimPlayback,
  releasePlayback,
  useNotePlaybackOptions,
  usePlaybackRate,
  usePlaylistEntry,
  useReportNowPlaying,
} from './components/mediaPlayback'
import { suppressPressAfterHold } from './components/messagePress'
import { UnreadDot } from './components/NoteIndicators'
import { PlayPauseIcon } from './components/PlayPauseIcon'
import { TranscribeButton, TranscriptionText, useTranscription } from './components/TranscribeButton'
import { useViewOnce } from './components/viewOnce'
import { ViewOnceBadge } from './components/ViewOnceBadge'
import {
  TRANSCRIBE_SLOT_WIDTH,
  VOICE_BUTTON_SIZE,
  VOICE_COLUMN_GAP,
  VOICE_META_HEIGHT,
  VOICE_ROW_PADDING_V,
  VOICE_TIME_FONT_SIZE,
  WAVEFORM_HEIGHT,
  formatVoiceDuration,
  isFreshOutgoingNote,
  voiceContentWidth,
} from './components/voiceWaveform'
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

// Only mounted when expo-audio resolved, so the hooks below always run in a
// stable order.
const ExpoAudioPlayer = ({
  uri,
  position,
  messageId,
  isMediaUnread,
  duration: durationProp,
  message,
  isViewOnce = false,
  transcription,
}: {
  uri: string
  position: 'left' | 'right'
  messageId?: string | number
  isMediaUnread?: boolean
  /** Length from the message, shown until the player has loaded the file. */
  duration?: number
  message?: IMessage
  isViewOnce?: boolean
  transcription?: string
}) => {
  const player = expoAudio.useAudioPlayer(uri)
  const status = expoAudio.useAudioPlayerStatus(player)
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const playerId = useId()
  const rate = usePlaybackRate()

  const isPlaying = !!status?.playing
  const duration: number = status?.duration || durationProp || 0
  const currentTime: number = status?.currentTime ?? 0
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  const { markReadRef, onTranscribe, onViewOnceEnd } = useNotePlaybackOptions(messageId)
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)
  // Heard here already, before the app has updated `isMediaUnread`.
  const [isHeard, setIsHeard] = useState(false)

  const pause = useCallback(() => {
    try {
      player.pause()
    } catch {
      // player already released
    }
  }, [player])

  // Recording pauses this note where it is; another note starting resets it,
  // as Telegram's `cleanupPlayer` does.
  const onStop = useCallback((reason: StopReason) => {
    pause()
    if (reason === 'replaced') {
      try {
        player.seekTo(0)
      } catch {
        // player already released
      }
      // Stopped for good after starting: a view-once note is spent.
      viewOnce.onEnd()
    }
  }, [pause, player, viewOnce])

  const play = useCallback((fromStart: boolean) => {
    // A view-once note that has played does not play again.
    if (!viewOnce.onStart())
      return

    if (fromStart)
      player.seekTo(0)

    player.setPlaybackRate?.(rate)
    player.play()
    // Same one-at-a-time rule as the waveform player and round notes; this
    // fallback used to play over them.
    claimPlayback(playerId, onStop)

    // Telegram marks an incoming note read the moment it starts playing.
    if (position === 'left' && isMediaUnread) {
      setIsHeard(true)
      markReadRef.current()
    }
  }, [player, rate, playerId, onStop, position, isMediaUnread, markReadRef, viewOnce])

  // A paused note keeps its claim: it is still the current one, so a note
  // started later can reset it.
  const togglePlayback = useCallback(() => {
    if (status?.playing)
      pause()
    else
      play(!!status?.didJustFinish || (duration > 0 && currentTime >= duration))
  }, [status, duration, currentTime, pause, play])

  const onEndedRef = usePlaylistEntry(messageId, () => play(true))
  const viewOnceEndRef = useRef(viewOnce.onEnd)
  viewOnceEndRef.current = viewOnce.onEnd

  // `didJustFinish` is set only by a natural end, never by a pause, so it is
  // the signal to move on to the next note.
  const didFinish = !!status?.didJustFinish
  useEffect(() => {
    if (!didFinish)
      return

    releasePlayback(playerId)
    viewOnceEndRef.current()
    onEndedRef.current()
  }, [didFinish, playerId, onEndedRef])

  // A speed picked on another note applies to this one mid-play too.
  useEffect(() => {
    player.setPlaybackRate?.(rate)
  }, [player, rate])

  useEffect(() => () => releasePlayback(playerId), [playerId])

  // The "now playing" bar's close: stop and rewind, as another note would.
  const stopFromBar = useCallback(() => {
    onStop('replaced')
    releasePlayback(playerId)
  }, [onStop, playerId])

  // Same rule as the waveform player: elapsed time while this note is the
  // current one (playing, or paused part-way), the full length otherwise.
  const isCurrent = isPlaying || currentTime > 0
  useReportNowPlaying(messageId, 'voice', isCurrent, isPlaying, togglePlayback, stopFromBar)
  const isUnread = position === 'left' && !!isMediaUnread && !isHeard

  // Raise to listen, as in the waveform player.
  useRaiseToListen({
    isCurrent,
    getPositionSeconds: () => currentTime,
    listen: fromStart => {
      if (fromStart || !isPlaying)
        play(fromStart)
    },
    pause,
  })

  // A view-once note plays from wherever it is and burns its track away as
  // it goes, like SeekBarWaveform's `explodeProgress`.
  const fill = viewOnce.isSpent
    ? 0
    : isViewOnce
      ? viewOnce.hasStarted ? 1 - progress : 1
      : progress
  const isPlayDisabled = viewOnce.isSpent

  return (
    <View style={[styles.container, { width: voiceContentWidth(duration, position === 'right') }]}>
      <View style={styles.audioRow}>
        <View>
          <Pressable
            onPress={togglePlayback}
            {...suppressPressAfterHold}
            disabled={isPlayDisabled}
            accessibilityRole='button'
            accessibilityState={{ disabled: isPlayDisabled }}
            accessibilityLabel={isPlaying ? 'pause' : 'play'}
            accessibilityHint={isViewOnce ? 'plays once' : undefined}
            style={[styles.playCircle, isPlayDisabled && styles.playCircleDisabled]}
          >
            <PlayPauseIcon isPlaying={isPlaying} color={styles.glyphColor.color} size={18} />
          </Pressable>
          {isViewOnce && (
            <ViewOnceBadge
              isVisible={!viewOnce.hasStarted}
              color={styles.playCircle.backgroundColor as string}
              glyphColor={styles.glyphColor.color}
              cutColor={styles.bubble.backgroundColor as string}
            />
          )}
        </View>
        <View style={styles.column}>
          <View style={styles.trackRow}>
            <View style={styles.trackArea}>
              <View style={styles.track}>
                {/* progress fill width is a runtime value, so it stays inline */}
                <View style={[styles.trackFill, { width: `${fill * 100}%` }]} />
              </View>
            </View>
            {transcribe.isVisible && (
              <View style={styles.transcribeSlot}>
                <TranscribeButton
                  isOpen={transcribe.isOpen}
                  isLoading={transcribe.isLoading}
                  onPress={transcribe.onPress}
                  color={styles.playCircle.backgroundColor as string}
                />
              </View>
            )}
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.time}>
              {formatVoiceDuration(isCurrent ? currentTime : duration)}
            </Text>
            {/* Telegram's unread dot, centred 6 past the time in the progress color. */}
            <View style={styles.dotSlot}>
              <UnreadDot isVisible={isUnread} color={styles.unreadDot.backgroundColor} />
            </View>
          </View>
        </View>
      </View>
      {transcribe.isVisible && (
        <View style={[styles.transcription, transcribe.isOpen && styles.metaSpacer]}>
          <TranscriptionText
            text={transcription}
            isOpen={transcribe.isOpen}
            color={styles.transcriptionColor.color}
          />
        </View>
      )}
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
        ? (
          <WaveformPlayer
            uri={uri}
            position={position}
            duration={currentMessage?.duration}
            messageId={currentMessage?._id}
            isMediaUnread={currentMessage?.isMediaUnread}
            animateAppear={isFreshOutgoingNote(position, currentMessage?.createdAt)}
            message={currentMessage}
            isViewOnce={!!currentMessage?.isViewOnce}
            transcription={currentMessage?.transcription}
          />
        )
        : isExpoAudioAvailable
          ? (
            <ExpoAudioPlayer
              uri={uri}
              position={position}
              messageId={currentMessage?._id}
              isMediaUnread={currentMessage?.isMediaUnread}
              duration={currentMessage?.duration}
              message={currentMessage}
              isViewOnce={!!currentMessage?.isViewOnce}
              transcription={currentMessage?.transcription}
            />
          )
          : (
            // The bubble lays its time over the note's bottom-right corner,
            // so the card leaves it a line of its own.
            <View style={styles.metaSpacer}>
              <MediaCard kind='audio' uri={uri} position={position} style={audioStyle} />
            </View>
          )}
    </View>
  )
}

const makeStyles = (theme: ChatTheme, position: 'left' | 'right') => {
  const palette = getMediaPalette(theme, position)

  return StyleSheet.create({
    // Carries the glyph color out of JSX and into the stylesheet.
    glyphColor: {
      color: palette.glyph,
    },
    bubble: {
      backgroundColor: position === 'right' ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
    },
    transcriptionColor: {
      color: position === 'right' ? theme.colors.outgoingText : theme.colors.incomingText,
    },
    container: {
      maxWidth: '100%',
    },
    audioRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: VOICE_ROW_PADDING_V,
      paddingHorizontal: 8,
      gap: VOICE_COLUMN_GAP,
    },
    playCircle: {
      width: VOICE_BUTTON_SIZE,
      height: VOICE_BUTTON_SIZE,
      borderRadius: VOICE_BUTTON_SIZE / 2,
      backgroundColor: palette.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playCircleDisabled: {
      opacity: 0.5,
    },
    // Laid out like the waveform player: the track where the waveform would
    // be, level with the button's top, and the time under it.
    column: {
      flex: 1,
      minHeight: VOICE_BUTTON_SIZE,
      justifyContent: 'space-between',
    },
    trackRow: {
      height: WAVEFORM_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    trackArea: {
      flex: 1,
      height: WAVEFORM_HEIGHT,
      justifyContent: 'center',
    },
    transcribeSlot: {
      width: TRANSCRIBE_SLOT_WIDTH,
      alignItems: 'flex-end',
    },
    transcription: {
      paddingHorizontal: 8,
    },
    // The bubble lays its time over the note's bottom-right corner, so an
    // open transcription leaves it a line of its own.
    metaSpacer: {
      paddingBottom: VOICE_META_HEIGHT,
    },
    track: {
      height: 3,
      borderRadius: 2,
      backgroundColor: palette.track,
      overflow: 'hidden',
    },
    trackFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: palette.progress,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    time: {
      fontSize: VOICE_TIME_FONT_SIZE,
      lineHeight: VOICE_BUTTON_SIZE - WAVEFORM_HEIGHT,
      color: palette.meta,
      fontVariant: ['tabular-nums'],
    },
    dotSlot: {
      marginLeft: 3,
    },
    unreadDot: {
      backgroundColor: palette.progress,
    },
  })
}

const createLeftStyles = (theme: ChatTheme) => makeStyles(theme, 'left')
const createRightStyles = (theme: ChatTheme) => makeStyles(theme, 'right')

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  metaSpacer: {
    paddingBottom: VOICE_META_HEIGHT,
  },
})
