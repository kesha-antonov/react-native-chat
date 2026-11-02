import { ComponentRef, RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Keyboard, View, useWindowDimensions } from 'react-native'
import { cancelAnimation, Easing, ReduceMotion, withTiming } from 'react-native-reanimated'
import {
  StopReason,
  claimPlayback,
  releasePlayback,
  useNotePlaybackOptions,
  useNotePlayerCache,
  usePlaybackRate,
  usePlaylistEntry,
} from '../components/mediaPlayback'
import { useRoundNoteChrome } from '../components/roundNoteChrome'
import { useViewOnce } from '../components/viewOnce'
import { PLAYING_NOTE_INSET, PROGRESS_SYNC_MS } from './constants'
import { setPlayer } from './videoPlayers'

interface RoundNotePlaybackOptions {
  player: any
  playerKey: string
  playerId: string
  playerCache: ReturnType<typeof useNotePlayerCache>
  messageId?: string | number
  /** Length in seconds, from the message, until the player knows its own. */
  duration?: number
  isAutoplay: boolean
  isIncoming: boolean
  isMediaUnread?: boolean
  playingNoteSize: number
  markReadRef: ReturnType<typeof useNotePlaybackOptions>['markReadRef']
  viewOnceRef: RefObject<ReturnType<typeof useViewOnce>>
  noteRef: RefObject<ComponentRef<typeof View> | null>
  /** Taken back from the floating note: grow, but do not centre the list. */
  skipCentreRef: RefObject<boolean>
}

/**
 * A round note's playback state machine: at rest (the silent loop, or a still frame), current and
 * playing, or current and paused; grown while current. It owns the player while current and hands
 * over to the next note when it ends.
 */
export const useRoundNotePlayback = ({
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
}: RoundNotePlaybackOptions) => {
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
  }, [reset, pause, viewOnceRef])

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
  }, [playerCache, playerKey, windowWidth, windowHeight, isIncoming, playingNoteSize, noteRef])

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
  }, [player, resume, becomeCurrent, isIncoming, isMediaUnread, markReadRef, chrome, viewOnceRef])

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
  }, [playerCache, playerKey, player, chrome, becomeCurrent, resume, playerId, onStop, skipCentreRef])
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
  }, [player, playerId, reset, onEndedRef, viewOnceRef])

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
  }, [isCurrent, isPlaying, playFromStart, pause, resume, viewOnceRef])

  return {
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
  }
}
