import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useRaiseToListen } from '../components/earpiece'
import { isRemoteUri } from '../components/mediaDownload'
import { MEDIA_LOADER_BACKGROUND, MEDIA_LOADER_ICON, ROUND_BUTTON_SIZE } from '../components/MediaLoader'
import {
  detachRoundNoteFromRow,
  releasePlayback,
  useIsNoteFloating,
  useNotePlaybackOptions,
  useReportNoteGrown,
  useReportNowPlaying,
} from '../components/mediaPlayback'
import { transferState, useMediaTransfer } from '../components/mediaTransfer'
import { suppressPressAfterHold } from '../components/messagePress'
import { MediaActionIcon, RadialProgress } from '../components/RadialProgress'
import { useTranscription } from '../components/TranscribeButton'
import { VideoNoteMeta, VideoNoteOverlay } from '../components/VideoNoteOverlay'
import { useViewOnce } from '../components/viewOnce'
import { useReattachAfterLift, useReportGrowShift } from './liftedMedia'
import { RoundTranscribeButton, RoundTranscription } from './RoundTranscription'
import { styles } from './styles'
import { RoundNotePlayerProps } from './types'
import { useCentreWhenGrown, useNoteGrowAnimation } from './useNoteGrow'
import { useNotePlayer } from './useNotePlayer'
import { useRingSeek } from './useRingSeek'
import { useRoundNotePlayback } from './useRoundNotePlayback'
import { useSendFlightReveal } from './useSendFlightReveal'
import { expoVideo, playerTime } from './videoPlayers'

/**
 * A round video note. In the list it holds its first frame with a
 * play button, or loops silently when autoplay is on; a tap plays it from the
 * start with sound and grows it; another tap pauses it, and a paused
 * note can be scrubbed by dragging along its ring. When it ends, or another
 * note starts, it shrinks back to the silent loop.
 */
export const RoundNotePlayer = ({
  uri,
  videoProps,
  videoStyle,
  duration,
  noteSize,
  playingNoteSize,
  messageId,
  isIncoming,
  isMediaUnread,
  animateAppear,
  message,
  isViewOnce = false,
  transcription,
}: RoundNotePlayerProps) => {
  const { isRoundVideoAutoplayEnabled, markReadRef, onTranscribe, onViewOnceEnd } = useNotePlaybackOptions(messageId)
  // A view-once note never autoplays in the list: it rests on a play
  // button with its "1" marker, so nothing of it is seen before it is opened.
  const isAutoplay = isRoundVideoAutoplayEnabled && !isViewOnce
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)
  const viewOnceRef = useRef(viewOnce)
  useLayoutEffect(() => {
    viewOnceRef.current = viewOnce
  })
  const {
    controller,
    playerCache,
    playerId,
    playerKey,
    player,
    isPlayerLoading,
    bufferProgress,
  } = useNotePlayer(uri, messageId, isAutoplay, duration)
  const roundTransfer = transferState(message)
  const mediaTransfer = useMediaTransfer()

  const VideoView = expoVideo.VideoView
  const noteRef = useRef<React.ComponentRef<typeof View>>(null)
  /** Taken back from the floating note: grow, but do not centre the list. */
  const skipCentreRef = useRef(false)

  const { onNoteLayout, flightRevealStyle } = useSendFlightReveal(animateAppear, noteRef)

  const {
    isCurrent,
    isPlaying,
    isGrown,
    currentTime,
    setCurrentTime,
    isHeard,
    growShift,
    timeShift,
    total,
    chrome,
    reset,
    pause,
    resume,
    playFromStart,
    onPress,
  } = useRoundNotePlayback({
    player,
    playerKey,
    playerId,
    playerCache,
    messageId,
    duration,
    isAutoplay,
    isIncoming,
    isMediaUnread,
    playingNoteSize,
    markReadRef,
    viewOnceRef,
    noteRef,
    skipCentreRef,
  })

  useReportNoteGrown(messageId, isGrown, timeShift)

  // The "now playing" bar's close stops the note and shrinks it back.
  const stop = useCallback(() => {
    releasePlayback(playerId)
    reset()
    viewOnceRef.current.onEnd()
  }, [playerId, reset])
  useReportNowPlaying(messageId, 'round', isCurrent, isPlaying, onPress, stop, player)

  // Raise to listen,
  // as voice notes do: at the ear the current note plays through the earpiece,
  // from the start if it was under a second in; lowered, it pauses. A
  // view-once note is never rewound, which would replay part of it.
  const isPlayingRef = useRef(isPlaying)
  useLayoutEffect(() => {
    isPlayingRef.current = isPlaying
  })
  useRaiseToListen({
    isCurrent,
    getPositionSeconds: () => playerTime(player),
    listen: fromStart => {
      if (fromStart && !isViewOnce)
        playFromStart()
      else if (!isPlayingRef.current)
        resume()
    },
    pause,
  })

  useCentreWhenGrown(isGrown, messageId, skipCentreRef)

  const { sizeSV, sizeStyle, shiftStyle } = useNoteGrowAnimation(isGrown, noteSize, playingNoteSize, growShift)

  const seekGesture = useRingSeek({
    player,
    isViewOnce,
    isCurrent,
    isPlaying,
    total,
    sizeSV,
    chrome,
    setCurrentTime,
    resume,
  })

  const remaining = isCurrent ? Math.max(0, total - currentTime) : duration

  // On Android a player draws into one view at a time, the last one attached
  // (`PlayerView.switchTargetView`). While the note floats, this row lets go of
  // it - even when it mounts again off screen - so the floating circle keeps
  // the picture; once that is gone the row attaches it again.
  const isFloating = useIsNoteFloating(messageId)
  const viewPlayer = isFloating && Platform.OS === 'android' ? null : player
  // A long-press copy of this message takes the picture while it is up (see the hook).
  const liftEpoch = useReattachAfterLift(playerKey)
  // Where the grown circle sits, for that copy to sit exactly over it.
  useReportGrowShift(playerKey, growShift)

  // Declared last so it runs after the cleanups above have released the claim
  // and cleared the bar: a note still current as its row unmounts keeps going,
  // floating, instead of being cut off with the row.
  // A view-once note never floats: closing it - here, by scrolling it away -
  // ends it, and `useViewOnce` spends it on unmount.
  const liveRef = useRef({ isCurrent, isPlaying, isViewOnce })
  useLayoutEffect(() => {
    liveRef.current = { isCurrent, isPlaying, isViewOnce }
  })
  useEffect(() => () => {
    const live = liveRef.current
    if (live.isCurrent)
      detachRoundNoteFromRow(controller, playerCache, playerKey, messageId, player, live.isPlaying, !live.isViewOnce)
  }, [controller, playerCache, playerKey, messageId, player])

  const isPlayDisabled = viewOnce.isSpent

  let buttonIcon: MediaActionIcon
  if (roundTransfer)
    buttonIcon = roundTransfer.icon
  else if (isPlayerLoading && !isCurrent && isRemoteUri(uri))
    buttonIcon = 'cancel'
  else
    buttonIcon = !isCurrent && !isAutoplay ? 'play' : 'none'
  // Once the ring has shown, it stays to morph into the play button.
  const [hasShownButton, setHasShownButton] = useState(buttonIcon === 'cancel' || buttonIcon === 'download')
  if (!hasShownButton && (buttonIcon === 'cancel' || buttonIcon === 'download'))
    setHasShownButton(true)

  const onPressNote = () => {
    if (message?.transfer) {
      mediaTransfer.onCancel(message)
      return
    }
    if (message?.isDownloadRequired) {
      mediaTransfer.onDownload(message)
      return
    }
    onPress()
  }

  return (
    <View style={isIncoming ? styles.noteColumnLeft : styles.noteColumnRight}>
      <Animated.View style={[styles.noteWrapper, shiftStyle, flightRevealStyle]}>
        <GestureDetector gesture={seekGesture}>
          <Animated.View ref={noteRef} onLayout={onNoteLayout} style={[styles.note, sizeStyle, videoStyle]}>
            <Pressable
              onPress={onPressNote}
              {...suppressPressAfterHold}
              disabled={isPlayDisabled}
              accessibilityRole='button'
              accessibilityState={{ disabled: isPlayDisabled }}
              accessibilityLabel={isPlaying ? 'pause video note' : 'play video note'}
              accessibilityHint={isViewOnce ? 'plays once' : undefined}
              style={StyleSheet.absoluteFill}
            >
              <VideoView
                key={liftEpoch}
                style={StyleSheet.absoluteFill}
                player={viewPlayer}
                fullscreenOptions={{ enable: false }}
                allowsPictureInPicture={false}
                nativeControls={false}
                contentFit='cover'
                {...videoProps}
              />
              <VideoNoteOverlay
                size={sizeSV}
                maxSize={playingNoteSize}
                chrome={chrome}
                isCurrent={isCurrent}
                isMuted={isAutoplay}
                isViewOnce={isViewOnce}
                hasViewOnceStarted={viewOnce.hasStarted || viewOnce.isSpent}
                isDisabled={isPlayDisabled}
                isPlayHidden={hasShownButton}
              />
              {hasShownButton && (
                <View style={[StyleSheet.absoluteFill, styles.noteButton]} pointerEvents='none'>
                  <RadialProgress
                    icon={buttonIcon}
                    progress={roundTransfer ? roundTransfer.progress : bufferProgress}
                    size={ROUND_BUTTON_SIZE}
                    color={MEDIA_LOADER_ICON}
                    backgroundColor={MEDIA_LOADER_BACKGROUND}
                  />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </GestureDetector>
        {/* The length pill, counting down while it plays. */}
        <VideoNoteMeta
          duration={remaining}
          isWatched={!isMediaUnread || isHeard || isCurrent}
          isPlaying={isCurrent && isPlaying}
          grow={chrome.grow}
          growDistance={playingNoteSize - noteSize}
          isOutgoing={!isIncoming}
        />
        {transcribe.isVisible && (
          <RoundTranscribeButton
            size={sizeSV}
            grow={chrome.grow}
            isIncoming={isIncoming}
            isOpen={transcribe.isOpen}
            isLoading={transcribe.isLoading}
            onPress={transcribe.onPress}
          />
        )}
      </Animated.View>
      {transcribe.isVisible && (
        <RoundTranscription text={transcription} isOpen={transcribe.isOpen} isIncoming={isIncoming} width={noteSize} />
      )}
    </View>
  )
}
