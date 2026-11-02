import React, { useCallback, useId, useMemo, useState } from 'react'
import { LayoutChangeEvent, Text, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { useThemedStyles } from '../../hooks/useTheme'
import { MediaCard } from '../MediaCard'
import { useNotePlaybackOptions } from '../mediaPlayback'
import { clampProgress, useMediaTransfer } from '../mediaTransfer'
import { UnreadDot } from '../NoteIndicators'
import { MediaActionIcon } from '../RadialProgress'
import { TranscribeButton, TranscriptionText, useTranscription } from '../TranscribeButton'
import { useViewOnce } from '../viewOnce'
import { barHeight, formatVoiceDuration } from '../voiceWaveform'
import { useAudioEngine } from './audio'
import { createLeftStyles, createRightStyles } from './styles'
import { WaveformPlayerProps } from './types'
import { useSendFlightReveal } from './useSendFlightReveal'
import { useVoicePlayback } from './useVoicePlayback'
import { useVoiceSource } from './useVoiceSource'
import { useWaveformMotion } from './useWaveformMotion'
import { useWaveformScrub } from './useWaveformScrub'
import { VoiceButton } from './VoiceButton'
import { WaveformTrack } from './WaveformTrack'

export { isWaveformAvailable } from './audio'
export type { WaveformPlayerProps } from './types'

/**
 * Voice note: a 44 play/pause circle, a 30-tall waveform beside
 * it and the time under the waveform. A tap on the waveform toggles playback;
 * a drag scrubs and seeks once on release. Powered by react-native-audio-api
 * (decode + playback). Falls back to a tappable MediaCard if decoding fails.
 * Only mounted when audio-api is available.
 */
export function WaveformPlayer ({
  uri,
  position = 'left',
  duration: durationProp,
  messageId,
  isMediaUnread,
  animateAppear,
  message,
  isViewOnce = false,
  transcription,
}: WaveformPlayerProps) {
  const styles = useThemedStyles(position === 'right' ? createRightStyles : createLeftStyles)
  const playerId = useId()
  const mediaTransfer = useMediaTransfer()
  const [trackWidth, setTrackWidth] = useState(0)

  const progress = useSharedValue(0)
  const trackWidthSV = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const engine = useAudioEngine(progress, durationProp)

  const [appearOnMount] = useState(!!animateAppear)

  const { markReadRef, onTranscribe, onViewOnceEnd } = useNotePlaybackOptions(messageId)
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)

  const source = useVoiceSource({
    uri,
    position,
    durationProp,
    message,
    playerId,
    trackWidth,
    isTranscribeVisible: transcribe.isVisible,
    ...engine,
  })
  const { levels, transfer, shouldLoad, isFetching, fullDuration, contentWidth, barCount } = source

  const playback = useVoicePlayback({
    playerId,
    messageId,
    position,
    isMediaUnread,
    progress,
    isDragging,
    viewOnce,
    markReadRef,
    setFailed: source.setFailed,
    ...engine,
  })
  const { isPlaying, shownProgress, isCurrent, isUnread, togglePlayback } = playback

  const waveformGesture = useWaveformScrub({
    isViewOnce,
    progress,
    isDragging,
    trackWidthSV,
    durationRef: engine.durationRef,
    togglePlayback,
    commitSeek: playback.commitSeek,
    setShownProgress: playback.setShownProgress,
  })

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    trackWidthSV.set(width)
    setTrackWidth(width)
  }, [trackWidthSV])

  // Loading shimmer while decoding and not playing; fades out once ready.
  // The same sweep runs while a transcription is on its way.
  // Only for a transcription: a note being fetched shows the ring on its button instead.
  const isShimmering = transcribe.isLoading && !isPlaying
  const hasLevels = levels.length > 0
  const motion = useWaveformMotion({ isShimmering, appearOnMount, hasLevels })

  const flight = useSendFlightReveal({
    appearOnMount,
    flightColor: String(styles.playCircle.backgroundColor),
    flightIconColor: String(styles.glyphColor.color),
  })

  // A view-once note's levels are drawn back to front.
  // Before there are levels every bar is at zero, drawn as a
  // row of 2x2 dots (a zero-height bar is just its round caps).
  const heights = useMemo(() => {
    const next = levels.length ? levels.map(barHeight) : new Array<number>(barCount).fill(barHeight(0))
    return isViewOnce ? next.reverse() : next
  }, [levels, isViewOnce, barCount])

  // The bubble lays its time over the note's bottom-right corner, so the
  // fallback card leaves it a line of its own.
  if (source.failed)
    return (
      <View style={styles.metaSpacer}>
        <MediaCard kind='audio' uri={uri} position={position} />
      </View>
    )

  // The elapsed time shows while this note is the current one -
  // playing, or paused part-way - and the full length otherwise.
  const timeLabel = formatVoiceDuration(isCurrent ? shownProgress * fullDuration : fullDuration)

  const isPlayDisabled = viewOnce.isSpent

  let buttonIcon: MediaActionIcon
  if (transfer)
    buttonIcon = 'cancel'
  else if (!shouldLoad)
    buttonIcon = 'download'
  else if (isFetching)
    buttonIcon = 'cancel'
  else
    buttonIcon = isPlaying ? 'pause' : 'play'

  const onPressButton = () => {
    if (transfer) {
      if (message)
        mediaTransfer.onCancel(message)
      return
    }
    if (!shouldLoad) {
      source.setIsCancelled(false)
      if (source.isDownloadRequired && message && mediaTransfer.hasDownloadHandler())
        mediaTransfer.onDownload(message)
      else
        source.setIsRequested(true)
      return
    }
    if (isFetching) {
      source.setIsCancelled(true)
      return
    }
    togglePlayback()
  }
  const buttonLabel = buttonIcon === 'cancel'
    ? transfer?.type === 'upload' ? 'cancel upload' : 'cancel download'
    : buttonIcon === 'download'
      ? 'download'
      : isPlaying ? 'pause' : 'play'

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <View style={styles.row}>
        <VoiceButton
          icon={buttonIcon}
          label={buttonLabel}
          onPress={onPressButton}
          progress={transfer ? clampProgress(transfer.progress) : source.downloadProgress}
          isDisabled={isPlayDisabled}
          isViewOnce={isViewOnce}
          hasViewOnceStarted={viewOnce.hasStarted}
          styles={styles}
          playRef={flight.playRef}
          onPlayLayout={flight.onPlayLayout}
          playRevealStyle={flight.playRevealStyle}
        />

        <View style={styles.column}>
          <View style={styles.waveformRow}>
            <WaveformTrack
              gesture={waveformGesture}
              style={styles.waveform}
              onLayout={onTrackLayout}
              shownProgress={shownProgress}
              heights={heights}
              trackColor={styles.colors.borderColor}
              playedColor={styles.colors.backgroundColor}
              trackWidth={trackWidth}
              trackWidthSV={trackWidthSV}
              progress={progress}
              isAppearing={motion.isAppearing}
              appear={motion.appear}
              isSweepMounted={motion.isSweepMounted}
              sweep={motion.sweep}
              loading={motion.loading}
              isUnread={isUnread}
              isViewOnce={isViewOnce}
              isViewOnceSpent={viewOnce.isSpent}
              hasViewOnceStarted={viewOnce.hasStarted}
            />

            {/* The transcribe button at the end of the waveform row. */}
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
            <Text style={styles.time}>{timeLabel}</Text>
            {/* The unread dot: 6 across, centred 6 past the time, in the
                played color. */}
            <View style={styles.dotSlot}>
              <UnreadDot isVisible={isUnread} color={styles.colors.backgroundColor} />
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
