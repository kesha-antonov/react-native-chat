import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { NotePlayer, NotePlayerCache, createNotePlayerCache, detachRoundNote } from './roundNotePlayers'

/**
 * Module-level registry so only one piece of media plays at a time.
 *
 * Every voice note and round video note owns its own player, and nothing
 * coordinated them: starting a second note left the first one playing, and a
 * chat with several round notes played all of them at once. Telegram always
 * stops the current one when a new one starts.
 *
 * Deliberately not React context - bubbles are recycled by the list, and the
 * registry has to outlive individual mounts to stop a player whose row has
 * already scrolled away.
 */

/**
 * Why a player is told to stop. `replaced`: another note started, so this one
 * is no longer current and resets, as Telegram's `cleanupPlayer` resets the
 * previous message's progress. `paused`: something else took the audio (a
 * recording), so it pauses and stays current.
 */
export type StopReason = 'replaced' | 'paused'

type StopHandler = (reason: StopReason) => void

const players = new Map<string, StopHandler>()

/**
 * Claim playback for `id`, stopping whatever else was playing.
 * Call when a player actually starts. A paused note may keep its claim, so a
 * later note can still reset it.
 */
export const claimPlayback = (id: string, stop: StopHandler) => {
  for (const [otherId, stopOther] of players)
    if (otherId !== id)
      try {
        stopOther('replaced')
      } catch {
        // a player that fails to stop must not block the new one
      }

  players.clear()
  players.set(id, stop)
}

/** Give up the claim (on completion, reset or unmount). */
export const releasePlayback = (id: string) => {
  players.delete(id)
}

/**
 * Pause whatever is playing. Recording calls this first: Telegram takes audio
 * focus when the mic opens (`MediaController.startRecording`), which pauses the
 * playing note - otherwise it would bleed straight into the new take. The
 * paused note keeps its claim and stays current.
 */
export const stopAllPlayback = () => {
  for (const stop of [...players.values()])
    try {
      stop('paused')
    } catch {
      // a player that fails to stop must not block the others
    }
}

/** Telegram cycles through these on a tap of the speed pill. */
export const PLAYBACK_RATES = [1, 1.5, 2] as const

/**
 * The presets a long press on the speed pill offers, Telegram's Slow, Normal,
 * Medium, Fast, Very fast and Super fast (`FragmentContextView.speeds`).
 */
export const PLAYBACK_RATE_PRESETS = [0.5, 1, 1.2, 1.5, 1.7, 2] as const

/*
 * One playback speed for every voice and round note, like Telegram's
 * `MediaController.currentPlaybackSpeed`: picking 2x on one note keeps 2x for
 * the next instead of resetting each bubble to 1x. Module-level so it survives
 * rows being recycled; apps that want it across launches persist it through
 * `mediaPlayback.onPlaybackRateChange` and hand it back as `playbackRate`.
 */
let playbackRate = 1
const rateListeners = new Set<() => void>()

export const getPlaybackRate = () => playbackRate

export const setPlaybackRate = (rate: number) => {
  if (!Number.isFinite(rate) || rate <= 0 || rate === playbackRate)
    return

  playbackRate = rate
  for (const listener of rateListeners)
    listener()
}

/** The next step on the speed pill after `rate`. */
export const nextPlaybackRate = (rate: number) => {
  const index = PLAYBACK_RATES.indexOf(rate as typeof PLAYBACK_RATES[number])
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]
}

const subscribeRate = (listener: () => void) => {
  rateListeners.add(listener)
  return () => {
    rateListeners.delete(listener)
  }
}

/** The shared playback speed, re-rendering when any note changes it. */
export const usePlaybackRate = () =>
  useSyncExternalStore(subscribeRate, getPlaybackRate, getPlaybackRate)

export const subscribePlaybackRate = (listener: (rate: number) => void) =>
  subscribeRate(() => listener(playbackRate))

/** What a message needs for the "play the next note" lookup. */
interface PlaylistMessage {
  _id: string | number
  audio?: string
  video?: string
  videoNote?: boolean
  isMediaUnread?: boolean
}

/** Chat-level playback options, from the `mediaPlayback` prop. */
export interface MediaPlaybackOptions {
  isAutoPlayNextEnabled: boolean
  isRoundVideoAutoplayEnabled: boolean
  onMediaRead?: (message: any) => void
  isNearEar?: boolean
  onTranscribe?: (message: any) => void
  onViewOnceEnd?: (message: any) => void
  isFloatingRoundNoteEnabled?: boolean
}

/** A mounted player the controller can start when the previous note ends. */
interface PlaylistEntry {
  play: () => void
}

/**
 * Per-chat coordinator for auto-playing the next note. When a voice or round
 * note finishes on its own, Telegram moves on to the next newer voice/round
 * message in the chat (`ChatActivity.createVoiceMessagesPlaylist` +
 * `MediaController.cleanupPlayer`), so a run of notes plays as one.
 *
 * The chat feeds it the current messages on every render (a ref write, no
 * re-render), and players register by message id while they are mounted. The
 * next note can only be started if its row is mounted - the list virtualizes,
 * but the next note sits right below the current one, so it nearly always is.
 */
export interface MediaPlaybackController {
  setMessages: (messages: readonly PlaylistMessage[], isInverted: boolean) => void
  setOptions: (options: MediaPlaybackOptions) => void
  getOptions: () => MediaPlaybackOptions
  /** Notified when `isNearEar` flips (raise to listen). */
  subscribeNearEar: (listener: () => void) => () => void
  register: (messageId: string | number, entry: PlaylistEntry) => () => void
  /** Called by a player whose note reached its end without being paused. */
  onEnded: (messageId: string | number) => void
  /**
   * An incoming unread note started playing: report it, as Telegram marks
   * the content read on play (`MediaController.playMessage`).
   */
  markRead: (messageId: string | number) => void
  /**
   * The round note grown to play, if any. Its row hides the sender's avatar
   * meanwhile, as Telegram does (`isAvatarVisible && !isPlayingRound`).
   */
  setGrownNote: (messageId: string | number | null, timeShift?: number) => void
  getGrownNote: () => string | number | null
  /**
   * How far the grown note's right edge moved from where it rests, so the
   * bubble can carry the sent time along with the circle.
   */
  getGrownTimeShift: () => number
  subscribeGrownNote: (listener: () => void) => () => void
  /**
   * The note that owns playback, playing or paused, for the "now playing" bar
   * at the top of the chat (Telegram's `FragmentContextView`).
   */
  setNowPlaying: (entry: NowPlayingEntry | null) => void
  /** Clears the bar only if `messageId` still owns it. */
  clearNowPlaying: (messageId: string | number) => void
  getNowPlaying: () => NowPlayingEntry | null
  subscribeNowPlaying: (listener: () => void) => () => void
  getMessage: (messageId: string | number) => PlaylistMessage | undefined
  /** Set by the chat: scrolls the list so a message sits mid-screen. */
  setScroller: (scroll: ((messageId: string | number) => void) | null) => void
  /**
   * Centres a message in the list, as Telegram does when a round note starts
   * playing (`ChatActivity.scrollToMessageId`, centred).
   */
  scrollToMessage: (messageId: string | number) => void
  /**
   * The messages whose rows are at least partly on screen, from the list's
   * viewability. Telegram floats the playing round note once its cell is no
   * longer among the visible children (`ChatActivity` ->
   * `MediaController.setCurrentVideoVisible(false)`).
   */
  setViewableMessages: (messageIds: readonly (string | number)[]) => void
  /** `undefined` until the list first reports, so nothing floats before layout. */
  isMessageViewable: (messageId: string | number) => boolean | undefined
  subscribeViewable: (listener: () => void) => () => void
  /** The round note drawn floating over the list, while its view is mounted. */
  setFloatingNote: (messageId: string | number | null) => void
  getFloatingNote: () => string | number | null
  subscribeFloatingNote: (listener: () => void) => () => void
  /** Round note players, which outlive their rows while the note is current. */
  notePlayers: NotePlayerCache
}

/** What the "now playing" bar shows and controls. */
export interface NowPlayingEntry {
  messageId: string | number
  kind: 'voice' | 'round'
  isPlaying: boolean
  toggle: () => void
  stop: () => void
  /** A round note's expo-video player, so the floating note shows the same video. */
  player?: unknown
}

const isPlayableNote = (message: PlaylistMessage) =>
  !!message.audio || (!!message.video && !!message.videoNote)

export const createMediaPlaybackController = (): MediaPlaybackController => {
  let messages: readonly PlaylistMessage[] = []
  let isInverted = true
  let options: MediaPlaybackOptions = { isAutoPlayNextEnabled: true, isRoundVideoAutoplayEnabled: false }
  const entries = new Map<string | number, PlaylistEntry>()
  const nearEarListeners = new Set<() => void>()
  let grownNote: string | number | null = null
  let grownTimeShift = 0
  const grownListeners = new Set<() => void>()
  let scroller: ((messageId: string | number) => void) | null = null
  let nowPlaying: NowPlayingEntry | null = null
  const nowPlayingListeners = new Set<() => void>()
  const notifyNowPlaying = () => nowPlayingListeners.forEach(listener => listener())
  let viewable: Set<string | number> | null = null
  const viewableListeners = new Set<() => void>()
  let floatingNote: string | number | null = null
  const floatingListeners = new Set<() => void>()
  const notePlayers = createNotePlayerCache()

  return {
    notePlayers,
    setViewableMessages (messageIds) {
      const next = new Set(messageIds)
      if (viewable && viewable.size === next.size && [...next].every(id => viewable!.has(id)))
        return
      viewable = next
      viewableListeners.forEach(listener => listener())
    },
    isMessageViewable (messageId) {
      return viewable ? viewable.has(messageId) : undefined
    },
    subscribeViewable (listener) {
      viewableListeners.add(listener)
      return () => {
        viewableListeners.delete(listener)
      }
    },
    setFloatingNote (messageId) {
      if (floatingNote === messageId)
        return
      floatingNote = messageId
      floatingListeners.forEach(listener => listener())
    },
    getFloatingNote () {
      return floatingNote
    },
    subscribeFloatingNote (listener) {
      floatingListeners.add(listener)
      return () => {
        floatingListeners.delete(listener)
      }
    },
    setNowPlaying (entry) {
      nowPlaying = entry
      notifyNowPlaying()
    },
    clearNowPlaying (messageId) {
      if (nowPlaying?.messageId !== messageId)
        return
      nowPlaying = null
      notifyNowPlaying()
    },
    getNowPlaying () {
      return nowPlaying
    },
    subscribeNowPlaying (listener) {
      nowPlayingListeners.add(listener)
      return () => {
        nowPlayingListeners.delete(listener)
      }
    },
    getMessage (messageId) {
      return messages.find(message => message._id === messageId)
    },
    setScroller (next) {
      scroller = next
    },
    scrollToMessage (messageId) {
      scroller?.(messageId)
    },
    setGrownNote (messageId, timeShift = 0) {
      if (grownNote === messageId && grownTimeShift === timeShift)
        return
      grownTimeShift = messageId == null ? 0 : timeShift
      grownNote = messageId
      grownListeners.forEach(listener => listener())
    },
    getGrownTimeShift () {
      return grownTimeShift
    },
    getGrownNote () {
      return grownNote
    },
    subscribeGrownNote (listener) {
      grownListeners.add(listener)
      return () => {
        grownListeners.delete(listener)
      }
    },
    setMessages (next, inverted) {
      messages = next
      isInverted = inverted
    },
    setOptions (next) {
      const wasNearEar = !!options.isNearEar
      options = next
      // Rows do not re-render when the chat's options change, so the sensor
      // reaches players through a subscription.
      if (wasNearEar !== !!next.isNearEar)
        nearEarListeners.forEach(listener => listener())
    },
    subscribeNearEar (listener) {
      nearEarListeners.add(listener)
      return () => {
        nearEarListeners.delete(listener)
      }
    },
    getOptions () {
      return options
    },
    markRead (messageId) {
      const message = messages.find(m => m._id === messageId)
      if (message?.isMediaUnread)
        options.onMediaRead?.(message)
    },
    register (messageId, entry) {
      entries.set(messageId, entry)
      return () => {
        if (entries.get(messageId) === entry)
          entries.delete(messageId)
      }
    },
    onEnded (messageId) {
      if (!options.isAutoPlayNextEnabled)
        return

      const index = messages.findIndex(message => message._id === messageId)
      if (index < 0)
        return

      // An inverted list keeps the newest message first, so "newer" walks
      // towards index 0; a non-inverted one walks the other way.
      const step = isInverted ? -1 : 1
      for (let i = index + step; i >= 0 && i < messages.length; i += step) {
        const message = messages[i]
        if (!isPlayableNote(message))
          continue

        entries.get(message._id)?.play()
        return
      }
    },
  }
}

export const MediaPlaybackContext = createContext<MediaPlaybackController | null>(null)

/**
 * Registers a player for auto-play-next and returns the `onEnded` callback it
 * should fire when its note finishes on its own. A no-op outside a `Chat`, or
 * when the message id is unknown.
 */
export const usePlaylistEntry = (messageId: string | number | undefined, play: () => void) => {
  const controller = useContext(MediaPlaybackContext)
  const playRef = useRef(play)
  playRef.current = play

  useEffect(() => {
    if (!controller || messageId == null)
      return

    return controller.register(messageId, { play: () => playRef.current() })
  }, [controller, messageId])

  const onEndedRef = useRef(() => {})
  onEndedRef.current = () => {
    if (controller && messageId != null)
      controller.onEnded(messageId)
  }

  return onEndedRef
}

/**
 * Whether round notes loop silently in the list, and a callback that reports
 * an incoming unread note as read. Both are no-ops outside a `Chat`.
 */
export const useNotePlaybackOptions = (messageId: string | number | undefined) => {
  const controller = useContext(MediaPlaybackContext)
  const markReadRef = useRef(() => {})
  markReadRef.current = () => {
    if (controller && messageId != null)
      controller.markRead(messageId)
  }

  const options = controller?.getOptions()
  return {
    isRoundVideoAutoplayEnabled: options?.isRoundVideoAutoplayEnabled ?? false,
    isNearEar: options?.isNearEar ?? false,
    onTranscribe: options?.onTranscribe,
    onViewOnceEnd: options?.onViewOnceEnd,
    markReadRef,
  }
}

const noSubscription = () => () => {}

/** Whether this message's round note is grown to play; false outside a `Chat`. */
export const useIsNoteGrown = (messageId: string | number | undefined) => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeGrownNote ?? noSubscription,
    () => messageId != null && controller?.getGrownNote() === messageId,
    () => false
  )
}

/** Reports this note growing or shrinking back, so its row can hide the avatar. */
export const useReportNoteGrown = (messageId: string | number | undefined, isGrown: boolean, timeShift = 0) => {
  const controller = useContext(MediaPlaybackContext)
  useEffect(() => {
    if (!controller || messageId == null || !isGrown)
      return

    controller.setGrownNote(messageId, timeShift)
  }, [controller, messageId, isGrown, timeShift])

  useEffect(() => {
    if (!controller || messageId == null || !isGrown)
      return

    return () => {
      if (controller.getGrownNote() === messageId)
        controller.setGrownNote(null)
    }
  }, [controller, messageId, isGrown])
}

/** How far this message's grown round note moved its right edge; 0 at rest. */
export const useNoteTimeShift = (messageId: string | number | undefined) => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeGrownNote ?? noSubscription,
    () => messageId != null && controller?.getGrownNote() === messageId ? controller.getGrownTimeShift() : 0,
    () => 0
  )
}

/**
 * Puts this note in the "now playing" bar while it owns playback, playing or
 * paused, and takes it out when it stops, is replaced or unmounts.
 */
export const useReportNowPlaying = (
  messageId: string | number | undefined,
  kind: 'voice' | 'round',
  isCurrent: boolean,
  isPlaying: boolean,
  toggle: () => void,
  stop: () => void,
  player?: unknown
) => {
  const controller = useContext(MediaPlaybackContext)
  const actionsRef = useRef({ toggle, stop })
  actionsRef.current = { toggle, stop }

  useEffect(() => {
    if (!controller || messageId == null || !isCurrent)
      return

    controller.setNowPlaying({
      messageId,
      kind,
      isPlaying,
      toggle: () => actionsRef.current.toggle(),
      stop: () => actionsRef.current.stop(),
      player,
    })
  }, [controller, messageId, kind, isCurrent, isPlaying, player])

  useEffect(() => {
    if (!controller || messageId == null || !isCurrent)
      return

    return () => controller.clearNowPlaying(messageId)
  }, [controller, messageId, isCurrent])
}

/** Centres a message in the chat's list; a no-op outside a `Chat`. */
export const useScrollToMessage = () => {
  const controller = useContext(MediaPlaybackContext)
  return (messageId: string | number | undefined) => {
    if (controller && messageId != null)
      controller.scrollToMessage(messageId)
  }
}

/** The note in the "now playing" bar, or null; null outside a `Chat`. */
export const useNowPlaying = () => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeNowPlaying ?? noSubscription,
    () => controller?.getNowPlaying() ?? null,
    () => null
  )
}

/** The phone is held to the ear (raise to listen); false outside a `Chat`. */
export const useIsNearEar = () => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeNearEar ?? noSubscription,
    () => !!controller?.getOptions().isNearEar,
    () => false
  )
}

/**
 * Whether a message's row is on screen: `undefined` outside a `Chat` or before
 * the list has reported, so callers can tell "scrolled away" from "unknown".
 */
export const useIsMessageViewable = (messageId: string | number | undefined) => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeViewable ?? noSubscription,
    () => (controller && messageId != null ? controller.isMessageViewable(messageId) : undefined),
    () => undefined
  )
}

/** Whether this message's round note is currently drawn floating over the list. */
export const useIsNoteFloating = (messageId: string | number | undefined) => {
  const controller = useContext(MediaPlaybackContext)
  return useSyncExternalStore(
    controller?.subscribeFloatingNote ?? noSubscription,
    () => messageId != null && controller?.getFloatingNote() === messageId,
    () => false
  )
}

// Round notes rendered outside a `Chat` still borrow their players from a
// cache, so React's strict effects (unmount, mount again) do not release a
// player that is still on screen.
const sharedNotePlayers = createNotePlayerCache()

/** The chat's round note players, or a shared cache outside a `Chat`. */
export const useNotePlayerCache = () => {
  const controller = useContext(MediaPlaybackContext)
  return controller?.notePlayers ?? sharedNotePlayers
}

/**
 * Hands a current round note whose row is unmounting over to a detached
 * session, so it keeps playing (and floating) until it ends, another note
 * starts, or its row mounts again and takes it back. Without a `Chat`, or
 * while the chat itself is going away, the note just stops.
 */
export const detachRoundNoteFromRow = (
  controller: MediaPlaybackController | null,
  cache: NotePlayerCache,
  cacheKey: string | number,
  messageId: string | number | undefined,
  player: NotePlayer,
  isPlaying: boolean,
  /** False for a note that must not outlive its row (a view-once one). */
  canFloat = true
) => {
  if (
    !canFloat ||
    !controller ||
    messageId == null ||
    !cache.isActive() ||
    controller.getOptions().isFloatingRoundNoteEnabled === false
  ) {
    try {
      player.pause()
    } catch {
      // already torn down
    }
    cache.keep(cacheKey, false)
    return
  }

  detachRoundNote(cacheKey, player, isPlaying, {
    cache,
    claim: claimPlayback,
    unclaim: releasePlayback,
    getRate: getPlaybackRate,
    subscribeRate: subscribePlaybackRate,
    report: state => {
      if (state)
        controller.setNowPlaying({ messageId, kind: 'round', player, ...state })
      else
        controller.clearNowPlaying(messageId)
    },
    onEnded: () => controller.onEnded(messageId),
  })
}

/** The chat's playback controller, or `null` outside a `Chat`. */
export const useMediaPlaybackController = () => useContext(MediaPlaybackContext)
