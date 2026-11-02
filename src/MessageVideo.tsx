import React, { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Keyboard, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native'
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, Easing, ReduceMotion, SharedValue, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useRaiseToListen } from './components/earpiece'
import { MediaCard } from './components/MediaCard'
import { isRemoteUri } from './components/mediaDownload'
import {
  MEDIA_BUTTON_SIZE,
  MEDIA_LOADER_BACKGROUND,
  MEDIA_LOADER_ICON,
  MediaInfoPill,
  ROUND_BUTTON_SIZE,
  transferLabel,
} from './components/MediaLoader'
import {
  LiftedPlaybackContext,
  MediaPlaybackController,
  StopReason,
  claimPlayback,
  detachRoundNoteFromRow,
  noteGrowShifts,
  releasePlayback,
  setMediaLifted,
  useIsMediaLifted,
  useIsNoteGrown,
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
import { transferState, useMediaTransfer } from './components/mediaTransfer'
import { suppressPressAfterHold } from './components/messagePress'
import { MediaActionIcon, RadialProgress } from './components/RadialProgress'
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
import { getExpoVideo } from './optional'

// Optional inline player. Resolved through the optional-peer registry (`src/optional`) so the bundle
// works whether or not the consumer installed `expo-video` - Metro treats
// try/catch-wrapped requires as optional dependencies and won't fail the build
// when the module is absent. When present, messages render a real inline
// player; otherwise they fall back to a tappable MediaCard.
const expoVideo = getExpoVideo()

const isExpoVideoAvailable = !!(expoVideo?.VideoView && expoVideo?.useVideoPlayer)
// Round notes create their players directly, so a playing one can outlive its
// row (see roundNotePlayers.ts).
const isRoundNotePlayerAvailable = isExpoVideoAvailable && !!expoVideo?.createVideoPlayer

// A round note is sized from the screen: 60% of its short side at rest, and
// all of it but 28pt while it plays with sound.
const NOTE_SIZE_RATIO = 0.6
const PLAYING_NOTE_INSET = 28
/** Centre the note once it has grown, so the list scrolls to its final size. */
const NOTE_CENTRE_DELAY_MS = 260
/** Seeks while dragging the ring are throttled to one per 100ms. */
const SEEK_THROTTLE_MS = 100

// The player is a native handle shared across rows, not React state: it is written through
// here so the compiler does not take these writes for mutations of a render value.
const setPlayer = (player: any, props: Record<string, unknown>) => {
  Object.assign(player, props)
}

// Outside the component: the compiler cannot yet lower `||` inside a `try`.
const playerTime = (player: any): number => {
  try {
    return player.currentTime || 0
  } catch {
    return 0
  }
}
/** How often a playing note checks the player's real position. */
const PROGRESS_SYNC_MS = 250
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
  /** Plays a single time (view once). */
  isViewOnce?: boolean
  transcription?: string
}

// Inline (not round) video players, by message, so the long-press copy of a message shows the
// player its original is playing instead of a fresh one stopped at the start.
const inlineVideoPlayers = new Map<string, unknown>()

const videoPlayerKey = (messageId: string | number | undefined, uri: string) =>
  messageId != null ? `${String(messageId)}\u0000${uri}` : undefined

// Only mounted when expo-video resolved, so the hooks below are always called
// in a stable order.
const ExpoVideoPlayer = ({ uri, style, videoProps, playerKey }: InlinePlayerProps & { playerKey?: string }) => {
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

/**
 * A round video note. In the list it holds its first frame with a
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
  // A view-once note never autoplays in the list: it rests on a play
  // button with its "1" marker, so nothing of it is seen before it is opened.
  const isAutoplay = isRoundVideoAutoplayEnabled && !isViewOnce
  const transcribe = useTranscription(message, messageId, transcription, onTranscribe)
  const viewOnce = useViewOnce(message, messageId, isViewOnce, onViewOnceEnd)
  const viewOnceRef = useRef(viewOnce)
  useLayoutEffect(() => {
    viewOnceRef.current = viewOnce
  })
  const controller = useMediaPlaybackController()
  const playerCache = useNotePlayerCache()
  const playerId = useId()
  // Keyed by message (and source) inside a chat, so a row that scrolled away
  // and back finds the player its note kept playing on.
  const playerKey = controller && messageId != null ? `${String(messageId)}\u0000${uri}` : playerId
  const [player] = useState(() => playerCache.get(playerKey, () => {
    const created = expoVideo.createVideoPlayer(uri)
    // Silent loop in the list, or a still first
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
  // The round note's button while the file is not here: the cancel ✕ with a ring as it
  // downloads, the arrow when it waits for a tap. expo-video
  // streams, so the ring follows how much of the clip is buffered until it can play.
  const [isPlayerLoading, setIsPlayerLoading] = useState(() => player.status === 'loading' || player.status === 'idle')
  const bufferProgress = useSharedValue(0)
  useEffect(() => {
    const subscription = player.addListener?.('statusChange', (event?: { status?: string }) => {
      setIsPlayerLoading(event?.status === 'loading' || event?.status === 'idle')
    })
    setIsPlayerLoading(player.status === 'loading' || player.status === 'idle')
    return () => subscription?.remove?.()
  }, [player])
  useEffect(() => {
    if (!isPlayerLoading)
      return
    const timer = setInterval(() => {
      const total = player.duration || duration || 0
      if (total > 0)
        bufferProgress.set(Math.min(1, (player.bufferedPosition || 0) / total))
    }, 200)
    return () => clearInterval(timer)
  }, [isPlayerLoading, player, duration, bufferProgress])
  const roundTransfer = transferState(message)
  const mediaTransfer = useMediaTransfer()

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
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rateRef = useRef(1)
  const noteRef = useRef<React.ComponentRef<typeof View>>(null)
  /** Taken back from the floating note: grow, but do not centre the list. */
  const skipCentreRef = useRef(false)

  // A just-sent round note's row stays at alpha 0 while the
  // camera circle flies onto it, then shows it at once: it is the same picture.
  const [appearOnMount] = useState(!!animateAppear)
  const flightReveal = useSharedValue(appearOnMount && isSendFlightExpected('round') ? 0 : 1)
  const hasLandedRef = useRef(false)
  const flightCleanupRef = useRef<(() => void) | null>(null)
  const onNoteLayout = useCallback(() => {
    if (!appearOnMount || hasLandedRef.current)
      return

    hasLandedRef.current = true
    const node = noteRef.current
    if (!node) {
      flightReveal.set(1)
      return
    }

    node.measureInWindow((x, y, width) => {
      if (!(width > 0 && landSendFlight('round', { x, y, size: width }))) {
        flightReveal.set(1)
        return
      }

      const show = () => {
        clearTimeout(safety)
        off()
        flightReveal.set(1)
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
  const flightRevealStyle = useAnimatedStyle(() => ({ opacity: flightReveal.get() }))

  const total = player.duration || duration || 0
  const totalRef = useRef(total)
  useLayoutEffect(() => {
    totalRef.current = total
  })
  const chrome = useRoundNoteChrome({ isCurrent, isPlaying, isGrown })

  const stopRaf = useCallback(() => {
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
    // Where the UI thread had it: the ring holds its last position after a stop.
    cancelAnimation(chrome.progress)
  }, [chrome.progress])

  // Drives the ring and the countdown. expo-video has no progress callback, so the ring runs
  // to the end on the UI thread at the playback rate, and the JS thread only checks in four
  // times a second: to put the ring back on the player's real position (a stall, a rate
  // change) and to re-render the countdown when its whole second changes.
  const tick = useCallback(() => {
    const time = player.currentTime || 0
    const length = totalRef.current
    if (length > 0) {
      chrome.progress.set(Math.min(1, time / length))
      chrome.progress.set(withTiming(1, {
        duration: Math.max(0, length - time) * 1000 / (rateRef.current || 1),
        easing: Easing.linear,
        // It shows where playback is, not motion for its own sake.
        reduceMotion: ReduceMotion.Never,
      }))
    }
    setCurrentTime(previous =>
      Math.floor(length - previous) === Math.floor(length - time) ? previous : time
    )
  }, [player, chrome.progress])

  const startTicking = useCallback(() => {
    stopRaf()
    tick()
    tickTimerRef.current = setInterval(tick, PROGRESS_SYNC_MS)
  }, [stopRaf, tick])

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
      setPlayer(player, { muted: true, loop: isAutoplay, playbackRate: 1, currentTime: 0 })
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
  // resets it, so only one note is ever current.
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
      setPlayer(player, { playbackRate: rate })
      player.play()
    } catch {
      return
    }
    rateRef.current = rate
    setIsPlaying(true)
    claimPlayback(playerId, onStop)
    startTicking()
  }, [player, rate, playerId, onStop, startTicking])

  /** Current and grown, kept alive past this row until it stops. */
  const becomeCurrent = useCallback(() => {
    playerCache.keep(playerKey, true)
    setIsCurrent(true)
    // The note does not grow with the keyboard up or in landscape: there is no room.
    const willGrow = windowWidth < windowHeight && !Keyboard.isVisible()
    setIsGrown(willGrow)

    // A note grows from its own side, so an incoming one beside an avatar
    // would run off the screen. Shift it to keep half of the side inset on
    // either edge; the avatar is hidden while it plays, so covering it is fine.
    if (willGrow)
      noteRef.current?.measureInWindow((x, _y, width) => {
        const grownLeft = isIncoming ? x : x + width - playingNoteSize
        const inset = PLAYING_NOTE_INSET / 2
        const fittedLeft = Math.min(Math.max(grownLeft, inset), windowWidth - inset - playingNoteSize)
        setGrowShift(fittedLeft - grownLeft)
        // The time stays at the circle's bottom-right, so it moves
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
      setPlayer(player, { loop: false, muted: false, currentTime: 0 })
    } catch {
      return
    }
    setCurrentTime(0)
    // The ring holds its last position while it fades out after a stop, so
    // it only snaps back to 12 o'clock when the note starts again.
    chrome.progress.set(0)
    chrome.wrapAlpha.set(0)
    becomeCurrent()
    resume()

    if (isIncoming && isMediaUnread) {
      setIsHeard(true)
      markReadRef.current()
    }
  }, [player, resume, becomeCurrent, isIncoming, isMediaUnread, markReadRef, chrome])

  // The note was current when its row unmounted and kept playing (or stayed
  // paused) floating over the list. Back on screen, the row takes it over
  // where the player is, without restarting it.
  const adoptDetached = useCallback(() => {
    const detached = playerCache.takeDetached(playerKey)
    if (!detached)
      return

    const wasPlaying = detached.adopt()
    const time = player.currentTime || 0
    const length = totalRef.current
    chrome.progress.set(length > 0 ? Math.min(1, time / length) : 0)
    chrome.wrapAlpha.set(0)
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
  useLayoutEffect(() => {
    adoptDetachedRef.current = adoptDetached
  })
  useEffect(() => {
    adoptDetachedRef.current()
  }, [playerKey])

  const onEndedRef = usePlaylistEntry(messageId, playFromStart)
  const isCurrentRef = useRef(isCurrent)
  useLayoutEffect(() => {
    isCurrentRef.current = isCurrent
  })

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
      setPlayer(player, { playbackRate: rate })
    } catch {
      // player already torn down
    }
    rateRef.current = rate
    // The ring's run to the end was timed at the old rate.
    tick()
  }, [isCurrent, isPlaying, player, rate, tick])

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

  // A round note that starts playing scrolls to the middle of the
  // list, once it has grown, so the whole circle is in view.
  const scrollToMessage = useScrollToMessage()
  const scrollToMessageRef = useRef(scrollToMessage)
  useLayoutEffect(() => {
    scrollToMessageRef.current = scrollToMessage
  })
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
    sizeSV.set(withTiming(size, { duration: NOTE_GROW_MS, easing: noteGrowEasing }))
  }, [size, sizeSV])
  const sizeStyle = useAnimatedStyle(() => ({
    width: sizeSV.get(),
    height: sizeSV.get(),
    borderRadius: sizeSV.get() / 2,
  }))
  const shiftSV = useSharedValue(0)
  useEffect(() => {
    shiftSV.set(withTiming(growShift, { duration: NOTE_GROW_MS, easing: noteGrowEasing }))
  }, [growShift, shiftSV])
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftSV.get() }],
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
      setPlayer(player, { currentTime: time })
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
    const fraction = angleToFraction(sizeSV.get(), x, y)
    // Wrapping past 12 o'clock leaves the old arc to fade out rather than
    // jumping, with one tick per wrap.
    if (isWrap(chrome.progress.get(), fraction)) {
      if (chrome.wrapAlpha.get() === 0)
        runOnJS(recordingHaptic)()
      chrome.wrapProgress.set(chrome.progress.get())
      chrome.wrapAlpha.set(1)
      chrome.wrapAlpha.set(withTiming(0, { duration: FADE_MS }))
    }
    chrome.progress.set(fraction)
    return fraction
  }

  const seekGesture = usePanGesture({
    enabled: canSeek,
    manualActivation: true,
    onTouchesDown: event => {
      const touch = event.changedTouches[0]
      const size = sizeSV.get()
      const pause = pausedAmount(chrome.pause.get(), chrome.isPaused.get())
      const knob = knobPoint(size, ringRadius(size, chrome.grow.get(), pause), chrome.progress.get())
      if (isSeekTouch(size, knob, touch.x, touch.y)) {
        // `roundToPauseProgress2`: the knob swells under the finger.
        chrome.drag.set(withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }))
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
      chrome.drag.set(withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }))
    },
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
  useEffect(() => {
    if (growShift)
      noteGrowShifts.set(playerKey, growShift)
    else
      noteGrowShifts.delete(playerKey)
  }, [growShift, playerKey])
  useEffect(() => () => {
    noteGrowShifts.delete(playerKey)
  }, [playerKey])

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

/**
 * The transcribe button beside a round note (closed: a
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
 * the circle. The bubble grows and fades with the text.
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
    open.set(withTiming(isOpen ? 1 : 0, { duration: TRANSCRIPTION_OPEN_MS }))
  }, [isOpen, open])
  // Padding follows the opening too, so a closed transcription leaves no
  // empty bubble behind.
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: open.get(),
    marginTop: TRANSCRIPTION_GAP * open.get(),
    paddingTop: TRANSCRIPTION_PADDING_TOP * open.get(),
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

/**
 * A video's media button while it uploads or waits to download (`transfer`,
 * `isDownloadRequired`): a 48 ring over the frame and the size pill. A tap on the
 * video is then the button's.
 */
const VideoTransferOverlay = ({ message }: { message: IMessage }) => {
  const mediaTransfer = useMediaTransfer()
  const state = transferState(message)
  const [hasShown, setHasShown] = useState(!!state)
  if (state && !hasShown)
    setHasShown(true)
  if (!hasShown)
    return null

  const label = message.transfer ? transferLabel(state?.progress ?? 0, message.transfer.totalBytes) : null
  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.videoOverlay]}
      pointerEvents={state ? 'auto' : 'none'}
      accessibilityRole='button'
      accessibilityLabel={state?.icon === 'cancel' ? 'cancel' : 'download video'}
      onPress={() => {
        if (message.transfer)
          mediaTransfer.onCancel(message)
        else if (message.isDownloadRequired)
          mediaTransfer.onDownload(message)
      }}
    >
      <RadialProgress
        icon={state?.icon ?? 'none'}
        progress={state?.progress ?? 0}
        size={MEDIA_BUTTON_SIZE}
        color={MEDIA_LOADER_ICON}
        backgroundColor={MEDIA_LOADER_BACKGROUND}
      />
      {label != null && <View style={styles.videoPill}><MediaInfoPill label={label} /></View>}
    </Pressable>
  )
}

/** A lifted copy marks its media as shown while it is up (see `useReattachAfterLift`). */
const useMarkLifted = (playerKey: string, isEnabled: boolean) => {
  useEffect(() => {
    if (!isEnabled)
      return
    setMediaLifted(playerKey, true)
    return () => setMediaLifted(playerKey, false)
  }, [playerKey, isEnabled])
}

/**
 * On Android a player draws into one view at a time, the last one attached: the lifted copy takes
 * the picture from the hidden original simply by attaching. The original must not let go of it by
 * setting its player to null - expo-video then throws, as the player still reports a view - so it
 * keeps its prop, and once the copy is gone it mounts its video view again (a new key), which
 * attaches the player back. iOS shows one player in several views and needs none of this.
 */
const useReattachAfterLift = (playerKey: string) => {
  const isLifted = useIsMediaLifted(playerKey)
  const [epoch, setEpoch] = useState(0)
  const wasLiftedRef = useRef(false)
  useEffect(() => {
    if (wasLiftedRef.current && !isLifted && Platform.OS === 'android')
      setEpoch(value => value + 1)
    wasLiftedRef.current = isLifted
  }, [isLifted])
  return epoch
}

/**
 * A round note inside the long-press copy of its message: the original's own player, at the size
 * and place the original has, still playing - as Telegram's lifted message is. It only shows the
 * player; it never claims playback or changes it, so the original carries on as if nothing
 * happened when the menu closes.
 */
const MirroredRoundNote = ({
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
const MirroredInlineVideo = ({ uri, style, videoProps, playerKey }: InlinePlayerProps & { playerKey: string }) => {
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
  videoOverlay: {
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  noteButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
