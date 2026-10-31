import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Keyboard, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native'
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler'
import Animated, { ReduceMotion, SharedValue, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useRaiseToListen } from './components/earpiece'
import { MediaCard } from './components/MediaCard'
import {
  StopReason,
  claimPlayback,
  detachRoundNoteFromRow,
  releasePlayback,
  useIsNoteFloating,
  useMediaPlaybackController,
  useNotePlaybackOptions,
  useNotePlayerCache,
  usePlaybackRate,
  usePlaylistEntry,
  useReportNoteGrown,
  useReportNowPlaying,
  useScrollToMessage,
} from './components/mediaPlayback'
import { suppressPressAfterHold } from './components/messagePress'
import { recordingHaptic } from './components/recordingFeedback'
import {
  FADE_MS,
  NOTE_GROW_MS,
  angleToFraction,
  isSeekTouch,
  isWrap,
  knobPoint,
  noteGrowEasing,
  ROUND_TRANSCRIBE_SIZE,
  pausedAmount,
  ringRadius,
  roundTranscribePosition,
  useRoundNoteChrome,
} from './components/roundNoteChrome'
import {
  SEND_FLIGHT_SAFETY_MS,
  isSendFlightExpected,
  landSendFlight,
  onSendFlightFinished,
} from './components/sendFlight'
import { TranscribeButton, TranscriptionText, useTranscription } from './components/TranscribeButton'
import { VideoNoteMeta, VideoNoteOverlay } from './components/VideoNoteOverlay'
import { useViewOnce } from './components/viewOnce'
import { isFreshOutgoingNote } from './components/voiceWaveform'
import { useTheme } from './hooks/useTheme'
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
// Round notes create their players directly, so a playing one can outlive its
// row (see roundNotePlayers.ts).
const isRoundNotePlayerAvailable = isExpoVideoAvailable && !!expoVideo?.createVideoPlayer

// Telegram sizes a round note from the screen: 60% of its short side at rest
// (`AndroidUtilities.roundMessageSize`), and all of it but 28pt while it plays
// with sound (`roundPlayingMessageSize`).
const NOTE_SIZE_RATIO = 0.6
const PLAYING_NOTE_INSET = 28
/** Centre the note once it has grown, so the list scrolls to its final size. */
const NOTE_CENTRE_DELAY_MS = 260
/** Seeks while dragging the ring are throttled to one per 100ms. */
const SEEK_THROTTLE_MS = 100
/** The transcription opens with the cell's height change, about 220ms. */
const TRANSCRIPTION_OPEN_MS = 220
const TRANSCRIPTION_GAP = 4
const TRANSCRIPTION_PADDING_TOP = 6

interface InlinePlayerProps {
  uri: string
  style: StyleProp<ViewStyle>
  videoProps?: object
}

interface RoundNotePlayerProps {
  uri: string
  videoProps?: object
  videoStyle?: StyleProp<ViewStyle>
  /** Length in seconds, shown under the note. */
  duration?: number
  noteSize: number
  playingNoteSize: number
  messageId?: string | number
  isIncoming: boolean
  isMediaUnread?: boolean
  /** Just sent from here: the camera circle flies into it. Read on mount only. */
  animateAppear?: boolean
  /** The message, handed to `mediaPlayback.onTranscribe` and `onViewOnceEnd`. */
  message?: IMessage
  /** Plays a single time (Telegram's `isRoundOnce`). */
  isViewOnce?: boolean
  transcription?: string
}

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
const ExpoVideoPlayer = ({ uri, style, videoProps }: InlinePlayerProps) => {
  const player = expoVideo.useVideoPlayer(uri, (p: any) => {
    p.loop = false
  })
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

/**
 * A Telegram round video note. In the list it holds its first frame with a
 * play button, or loops silently when autoplay is on; a tap plays it from the
 * start with sound and grows it; another tap pauses it, and a paused
 * note can be scrubbed by dragging along its ring. When it ends, or another
 * note starts, it shrinks back to the silent loop.
 */
const RoundNotePlayer = ({
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
  // Telegram never autoplays a view-once note in the list: it rests on a play
  // button with its "1" marker, so nothing of it is seen before it is opened.
  const isAutoplay = isRoundVideoAutoplayEnabled && !isViewOnce
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)
  const viewOnceRef = useRef(viewOnce)
  viewOnceRef.current = viewOnce
  const controller = useMediaPlaybackController()
  const playerCache = useNotePlayerCache()
  const playerId = useId()
  // Keyed by message (and source) inside a chat, so a row that scrolled away
  // and back finds the player its note kept playing on.
  const playerKey = controller && messageId != null ? `${String(messageId)}\u0000${uri}` : playerId
  const [player] = useState(() => playerCache.get(playerKey, () => {
    const created = expoVideo.createVideoPlayer(uri)
    // Silent loop in the list (`ImageLoader.AUTOPLAY_FILTER`), or a still first
    // frame when autoplay is off.
    created.muted = true
    created.loop = isAutoplay
    if (isAutoplay)
      created.play()
    return created
  }))
  useEffect(() => {
    playerCache.retain(playerKey)
    return () => playerCache.release(playerKey)
  }, [playerCache, playerKey])
  const VideoView = expoVideo.VideoView
  const rate = usePlaybackRate()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  // Current: this note owns playback, playing or paused (`isPlayingMessage`).
  const [isCurrent, setIsCurrent] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGrown, setIsGrown] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isHeard, setIsHeard] = useState(false)
  const [growShift, setGrowShift] = useState(0)
  // How far the grown circle's right edge moves, for the bubble's sent time.
  const [timeShift, setTimeShift] = useState(0)
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const noteRef = useRef<React.ComponentRef<typeof View>>(null)
  /** Taken back from the floating note: grow, but do not centre the list. */
  const skipCentreRef = useRef(false)

  // `ChatActivity` keeps a just-sent round note's cell at alpha 0 while the
  // camera circle flies onto it, then shows it at once: it is the same picture.
  const appearOnMount = useRef(!!animateAppear).current
  const flightReveal = useSharedValue(appearOnMount && isSendFlightExpected('round') ? 0 : 1)
  const hasLandedRef = useRef(false)
  const flightCleanupRef = useRef<(() => void) | null>(null)
  const onNoteLayout = useCallback(() => {
    if (!appearOnMount || hasLandedRef.current)
      return

    hasLandedRef.current = true
    const node = noteRef.current
    if (!node) {
      flightReveal.value = 1
      return
    }

    node.measureInWindow((x, y, width) => {
      if (!(width > 0 && landSendFlight('round', { x, y, size: width }))) {
        flightReveal.value = 1
        return
      }

      const show = () => {
        clearTimeout(safety)
        off()
        flightReveal.value = 1
      }
      const safety = setTimeout(show, SEND_FLIGHT_SAFETY_MS)
      const off = onSendFlightFinished('round', show)
      flightCleanupRef.current = () => {
        clearTimeout(safety)
        off()
      }
    })
  }, [appearOnMount, flightReveal])
  useEffect(() => () => flightCleanupRef.current?.(), [])
  const flightRevealStyle = useAnimatedStyle(() => ({ opacity: flightReveal.value }))

  const total = player.duration || duration || 0
  const totalRef = useRef(total)
  totalRef.current = total
  const chrome = useRoundNoteChrome({ isCurrent, isPlaying, isGrown })

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Drives the ring and the countdown. expo-video has no per-frame callback,
  // so the position is sampled on the display link while playing. The ring
  // takes every sample straight into a shared value; React only re-renders
  // when the countdown's whole second changes.
  const tick = useCallback(() => {
    const time = player.currentTime || 0
    const length = totalRef.current
    if (length > 0)
      chrome.progress.value = Math.min(1, time / length)
    setCurrentTime(previous =>
      Math.floor(length - previous) === Math.floor(length - time) ? previous : time
    )
    rafRef.current = requestAnimationFrame(tick)
  }, [player, chrome.progress])

  /** Back to rest at the original size: the silent loop, or paused. */
  const reset = useCallback(() => {
    stopRaf()
    playerCache.keep(playerKey, false)
    setIsCurrent(false)
    setIsPlaying(false)
    setIsGrown(false)
    setGrowShift(0)
    setTimeShift(0)
    setCurrentTime(0)
    try {
      player.muted = true
      player.loop = isAutoplay
      player.playbackRate = 1
      player.currentTime = 0
      if (isAutoplay)
        player.play()
      else
        player.pause()
    } catch {
      // player already torn down
    }
  }, [player, isAutoplay, stopRaf, playerCache, playerKey])

  const pause = useCallback(() => {
    try {
      player.pause()
    } catch {
      // player already torn down
    }
    stopRaf()
    setIsPlaying(false)
  }, [player, stopRaf])

  // Recording pauses this note and leaves it current; another note starting
  // resets it, as Telegram's `cleanupPlayer` does.
  const onStop = useCallback((reason: StopReason) => {
    if (reason === 'replaced') {
      reset()
      // Stopped for good after starting: a view-once note is spent.
      viewOnceRef.current.onEnd()
    } else {
      pause()
    }
  }, [reset, pause])

  const resume = useCallback(() => {
    try {
      player.playbackRate = rate
      player.play()
    } catch {
      return
    }
    setIsPlaying(true)
    claimPlayback(playerId, onStop)
    stopRaf()
    rafRef.current = requestAnimationFrame(tick)
  }, [player, rate, playerId, onStop, stopRaf, tick])

  /** Current and grown, kept alive past this row until it stops. */
  const becomeCurrent = useCallback(() => {
    playerCache.keep(playerKey, true)
    setIsCurrent(true)
    // Telegram does not grow the note with the keyboard up or in landscape.
    const willGrow = windowWidth < windowHeight && !Keyboard.isVisible()
    setIsGrown(willGrow)

    // A note grows from its own side, so an incoming one beside an avatar
    // would run off the screen. Shift it to keep half of Telegram's inset on
    // either edge; like Telegram hiding the avatar, it then covers it.
    if (willGrow)
      noteRef.current?.measureInWindow((x, _y, width) => {
        const grownLeft = isIncoming ? x : x + width - playingNoteSize
        const inset = PLAYING_NOTE_INSET / 2
        const fittedLeft = Math.min(Math.max(grownLeft, inset), windowWidth - inset - playingNoteSize)
        setGrowShift(fittedLeft - grownLeft)
        // Telegram keeps the time at the circle's bottom-right, so it moves
        // with the grown circle's right edge.
        setTimeShift(fittedLeft + playingNoteSize - (x + width))
      })
  }, [playerCache, playerKey, windowWidth, windowHeight, isIncoming, playingNoteSize])

  /** Play with sound from the start, as a tap on a looping note does. */
  const playFromStart = useCallback(() => {
    // A view-once note that has played does not play again.
    if (!viewOnceRef.current.onStart())
      return

    try {
      player.loop = false
      player.muted = false
      player.currentTime = 0
    } catch {
      return
    }
    setCurrentTime(0)
    // The ring holds its last position while it fades out after a stop, so
    // it only snaps back to 12 o'clock when the note starts again.
    chrome.progress.value = 0
    chrome.wrapAlpha.value = 0
    becomeCurrent()
    resume()

    if (isIncoming && isMediaUnread) {
      setIsHeard(true)
      markReadRef.current()
    }
  }, [player, resume, becomeCurrent, isIncoming, isMediaUnread, markReadRef, chrome])

  // The note was current when its row unmounted and kept playing (or stayed
  // paused) floating over the list. Back on screen, the row takes it over
  // where the player is, as Telegram's cell picks the playing message up again.
  const adoptDetached = useCallback(() => {
    const detached = playerCache.takeDetached(playerKey)
    if (!detached)
      return

    const wasPlaying = detached.adopt()
    const time = player.currentTime || 0
    const length = totalRef.current
    chrome.progress.value = length > 0 ? Math.min(1, time / length) : 0
    chrome.wrapAlpha.value = 0
    setCurrentTime(time)
    setIsHeard(true)
    skipCentreRef.current = true
    becomeCurrent()
    if (wasPlaying) {
      resume()
    } else {
      setIsPlaying(false)
      claimPlayback(playerId, onStop)
    }
  }, [playerCache, playerKey, player, chrome, becomeCurrent, resume, playerId, onStop])
  const adoptDetachedRef = useRef(adoptDetached)
  adoptDetachedRef.current = adoptDetached
  useEffect(() => {
    adoptDetachedRef.current()
  }, [playerKey])

  const onEndedRef = usePlaylistEntry(messageId, playFromStart)
  const isCurrentRef = useRef(isCurrent)
  isCurrentRef.current = isCurrent

  // A natural end: shrink back to the loop and hand over to the next note.
  useEffect(() => {
    const subscription = player.addListener?.('playToEnd', () => {
      if (!isCurrentRef.current)
        return

      releasePlayback(playerId)
      reset()
      viewOnceRef.current.onEnd()
      onEndedRef.current()
    })
    return () => subscription?.remove?.()
  }, [player, playerId, reset, onEndedRef])

  // A speed picked on any note applies to a playing round note too. Only
  // while it plays: on iOS a rate set on a paused player starts it, so a
  // paused note would run on silently to its end and start the next note.
  // A paused one picks the rate up in `resume`.
  useEffect(() => {
    if (!isCurrent || !isPlaying)
      return

    try {
      player.playbackRate = rate
    } catch {
      // player already torn down
    }
  }, [isCurrent, isPlaying, player, rate])

  useEffect(() => () => {
    stopRaf()
    releasePlayback(playerId)
  }, [stopRaf, playerId])

  const onPress = useCallback(() => {
    if (viewOnceRef.current.isSpent)
      return
    if (!isCurrent)
      playFromStart()
    else if (isPlaying)
      pause()
    else
      resume()
  }, [isCurrent, isPlaying, playFromStart, pause, resume])

  useReportNoteGrown(messageId, isGrown, timeShift)

  // The "now playing" bar's close stops the note and shrinks it back.
  const stop = useCallback(() => {
    releasePlayback(playerId)
    reset()
    viewOnceRef.current.onEnd()
  }, [playerId, reset])
  useReportNowPlaying(messageId, 'round', isCurrent, isPlaying, onPress, stop, player)

  // Raise to listen (`MediaController.setUseFrontSpeaker` / `startAudioAgain`),
  // as voice notes do: at the ear the current note plays through the earpiece,
  // from the start if it was under a second in; lowered, it pauses. A
  // view-once note is never rewound, which would replay part of it.
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying
  useRaiseToListen({
    isCurrent,
    getPositionSeconds: () => {
      try {
        return player.currentTime || 0
      } catch {
        return 0
      }
    },
    listen: fromStart => {
      if (fromStart && !isViewOnce)
        playFromStart()
      else if (!isPlayingRef.current)
        resume()
    },
    pause,
  })

  // Telegram scrolls a round note that starts playing to the middle of the
  // list, once it has grown, so the whole circle is in view.
  const scrollToMessage = useScrollToMessage()
  const scrollToMessageRef = useRef(scrollToMessage)
  scrollToMessageRef.current = scrollToMessage
  useEffect(() => {
    if (!isGrown)
      return

    if (skipCentreRef.current) {
      skipCentreRef.current = false
      return
    }

    const timer = setTimeout(() => scrollToMessageRef.current(messageId), NOTE_CENTRE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isGrown, messageId])

  // Grow while current, shrink back after.
  const size = isGrown ? playingNoteSize : noteSize
  const sizeSV = useSharedValue(noteSize)
  useEffect(() => {
    sizeSV.value = withTiming(size, { duration: NOTE_GROW_MS, easing: noteGrowEasing })
  }, [size, sizeSV])
  const sizeStyle = useAnimatedStyle(() => ({
    width: sizeSV.value,
    height: sizeSV.value,
    borderRadius: sizeSV.value / 2,
  }))
  const shiftSV = useSharedValue(0)
  useEffect(() => {
    shiftSV.value = withTiming(growShift, { duration: NOTE_GROW_MS, easing: noteGrowEasing })
  }, [growShift, shiftSV])
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftSV.value }],
  }))

  // Scrub a paused note by dragging around its ring (`checkRoundSeekbar`).
  // The drag only starts on the knob or the outer band, so a tap in the
  // middle still resumes.
  // A view-once note plays straight through: no scrubbing back over it.
  const canSeek = !isViewOnce && isCurrent && !isPlaying && total > 0
  const lastSeekAtRef = useRef(0)

  const seekTo = useCallback((fraction: number, isFinal: boolean) => {
    const now = Date.now()
    if (!isFinal && now - lastSeekAtRef.current < SEEK_THROTTLE_MS)
      return

    lastSeekAtRef.current = now
    const time = fraction * total
    setCurrentTime(time)
    try {
      player.currentTime = time
    } catch {
      return
    }
    if (isFinal)
      resume()
  }, [total, player, resume])

  // The knob follows the finger on the UI thread; only the seek itself
  // goes through JS, throttled.
  const track = (x: number, y: number) => {
    'worklet'
    const fraction = angleToFraction(sizeSV.value, x, y)
    // Wrapping past 12 o'clock leaves the old arc to fade out rather than
    // jumping, with one tick per wrap, as Telegram does.
    if (isWrap(chrome.progress.value, fraction)) {
      if (chrome.wrapAlpha.value === 0)
        runOnJS(recordingHaptic)()
      chrome.wrapProgress.value = chrome.progress.value
      chrome.wrapAlpha.value = 1
      chrome.wrapAlpha.value = withTiming(0, { duration: FADE_MS })
    }
    chrome.progress.value = fraction
    return fraction
  }

  const seekGesture = usePanGesture({
    enabled: canSeek,
    manualActivation: true,
    onTouchesDown: event => {
      const touch = event.changedTouches[0]
      const size = sizeSV.value
      const pause = pausedAmount(chrome.pause.value, chrome.isPaused.value)
      const knob = knobPoint(size, ringRadius(size, chrome.grow.value, pause), chrome.progress.value)
      if (isSeekTouch(size, knob, touch.x, touch.y)) {
        // `roundToPauseProgress2`: the knob swells under the finger.
        chrome.drag.value = withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never })
        GestureStateManager.activate(event.handlerTag)
      } else {
        GestureStateManager.fail(event.handlerTag)
      }
    },
    onUpdate: event => {
      runOnJS(seekTo)(track(event.x, event.y), false)
    },
    onDeactivate: event => {
      runOnJS(seekTo)(track(event.x, event.y), true)
    },
    onFinalize: () => {
      chrome.drag.value = withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never })
    },
  })

  const remaining = isCurrent ? Math.max(0, total - currentTime) : duration

  // On Android a player draws into one view at a time, the last one attached
  // (`PlayerView.switchTargetView`). While the note floats, this row lets go of
  // it - even when it mounts again off screen - so the floating circle keeps
  // the picture; once that is gone the row attaches it again.
  const isFloating = useIsNoteFloating(messageId)
  const viewPlayer = isFloating && Platform.OS === 'android' ? null : player

  // Declared last so it runs after the cleanups above have released the claim
  // and cleared the bar: a note still current as its row unmounts keeps going,
  // floating, instead of being cut off with the row (`PipRoundVideoView`).
  // A view-once note never floats: closing it - here, by scrolling it away -
  // ends it, and `useViewOnce` spends it on unmount.
  const liveRef = useRef({ isCurrent, isPlaying, isViewOnce })
  liveRef.current = { isCurrent, isPlaying, isViewOnce }
  useEffect(() => () => {
    const live = liveRef.current
    if (live.isCurrent)
      detachRoundNoteFromRow(controller, playerCache, playerKey, messageId, player, live.isPlaying, !live.isViewOnce)
  }, [controller, playerCache, playerKey, messageId, player])

  const isPlayDisabled = viewOnce.isSpent

  return (
    <View style={isIncoming ? styles.noteColumnLeft : styles.noteColumnRight}>
      <Animated.View style={[styles.noteWrapper, shiftStyle, flightRevealStyle]}>
        <GestureDetector gesture={seekGesture}>
          <Animated.View ref={noteRef} onLayout={onNoteLayout} style={[styles.note, sizeStyle, videoStyle]}>
            <Pressable
              onPress={onPress}
              {...suppressPressAfterHold}
              disabled={isPlayDisabled}
              accessibilityRole='button'
              accessibilityState={{ disabled: isPlayDisabled }}
              accessibilityLabel={isPlaying ? 'pause video note' : 'play video note'}
              accessibilityHint={isViewOnce ? 'plays once' : undefined}
              style={StyleSheet.absoluteFill}
            >
              <VideoView
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
              />
            </Pressable>
          </Animated.View>
        </GestureDetector>
        {/* Telegram's length pill, counting down while it plays. */}
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

/**
 * The transcribe button beside a round note (`ChatMessageCell`, closed: a
 * 32dp circle on the service background, out of the bubble since a round note
 * has none). It follows the note's grow on the UI thread.
 */
const RoundTranscribeButton = ({
  size,
  grow,
  isIncoming,
  isOpen,
  isLoading,
  onPress,
}: {
  size: SharedValue<number>
  grow: SharedValue<number>
  isIncoming: boolean
  isOpen: boolean
  isLoading: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const positionStyle = useAnimatedStyle(() => roundTranscribePosition(isIncoming, size.value, grow.value))

  return (
    <Animated.View style={[styles.transcribe, positionStyle]}>
      <View pointerEvents='none' style={[styles.transcribeBackground, { backgroundColor: theme.colors.dayPillBackground }]} />
      <TranscribeButton
        isOpen={isOpen}
        isLoading={isLoading}
        onPress={onPress}
        color={theme.colors.dayPillText}
      />
    </Animated.View>
  )
}

/**
 * The transcription of a round note, in a bubble of the sender's color under
 * the circle, as Telegram opens it (`isVoiceTranscriptionOpen` on a round
 * message). The bubble grows and fades with the text.
 */
const RoundTranscription = ({
  text,
  isOpen,
  isIncoming,
  width,
}: {
  text: string | undefined
  isOpen: boolean
  isIncoming: boolean
  /** The note's resting width. The text is measured off-flow, so the bubble needs one. */
  width: number
}) => {
  const theme = useTheme()
  const open = useSharedValue(isOpen ? 1 : 0)
  useEffect(() => {
    open.value = withTiming(isOpen ? 1 : 0, { duration: TRANSCRIPTION_OPEN_MS })
  }, [isOpen, open])
  // Padding follows the opening too, so a closed transcription leaves no
  // empty bubble behind.
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    marginTop: TRANSCRIPTION_GAP * open.value,
    paddingTop: TRANSCRIPTION_PADDING_TOP * open.value,
  }))

  return (
    <Animated.View
      style={[
        styles.transcription,
        { width, backgroundColor: isIncoming ? theme.colors.incomingBubble : theme.colors.outgoingBubble },
        bubbleStyle,
      ]}
    >
      <TranscriptionText
        text={text}
        isOpen={isOpen}
        color={isIncoming ? theme.colors.incomingText : theme.colors.outgoingText}
      />
    </Animated.View>
  )
}

export function MessageVideo<TMessage extends IMessage = IMessage> ({
  currentMessage,
  position = 'left',
  containerStyle,
  videoStyle,
  videoProps,
}: Partial<MessageVideoProps<TMessage>>) {
  const { width, height } = useWindowDimensions()
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
          ? (
            <RoundNotePlayer
              // A recycled cell (FlashList) gets a fresh player and state
              // rather than inheriting another message's.
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
          : <ExpoVideoPlayer uri={uri} style={[styles.video, videoStyle]} videoProps={videoProps} />
        : <MediaCard kind='video' uri={uri} position={position} style={[isNote && noteStyle, videoStyle]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  // A round note floats without bubble chrome (the Bubble strips its
  // background). It must not clip: a playing note shifts past its row.
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
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  // Drawn above the avatar when shifted over it while playing.
  noteWrapper: {
    zIndex: 1,
  },
  noteColumnLeft: {
    alignItems: 'flex-start',
  },
  noteColumnRight: {
    alignItems: 'flex-end',
  },
  transcribe: {
    position: 'absolute',
    width: ROUND_TRANSCRIBE_SIZE,
    height: ROUND_TRANSCRIBE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribeBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: ROUND_TRANSCRIBE_SIZE / 2,
  },
  transcription: {
    borderRadius: 16,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
})
