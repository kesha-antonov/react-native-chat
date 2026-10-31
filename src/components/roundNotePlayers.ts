/*
 * Round note players that outlive their rows.
 *
 * The list virtualizes: scroll far enough from a playing round note and its
 * row unmounts, which used to release its expo-video player and cut the note
 * off mid-sentence. Telegram keeps playing and floats the note in a corner
 * (`PipRoundVideoView`) until its message is back on screen. So players live
 * here, keyed by message id: a row borrows its note's player while mounted,
 * and a note that is current when its row goes away is handed to a detached
 * session that keeps driving the same player - the floating note shows it and
 * the "now playing" bar keeps controlling it. When the row mounts again it
 * takes the session back and carries on from where the player is.
 */

/** The subset of expo-video's `VideoPlayer` used here. */
export interface NotePlayer {
  play: () => void
  pause: () => void
  release?: () => void
  playing?: boolean
  muted: boolean
  loop: boolean
  currentTime: number
  playbackRate: number
  duration?: number
  addListener?: (event: string, listener: () => void) => { remove?: () => void } | undefined
}

/** A detached note, waiting for its row to come back or for playback to end. */
export interface DetachedRound {
  /** The row is back: stop driving the player and say whether it was playing. */
  adopt: () => boolean
  /** End it: playback stops and the player can be released. */
  end: () => void
}

interface Entry {
  player: NotePlayer
  refs: number
  /** Kept alive past its last row because the note is current. */
  isKept: boolean
  detached: DetachedRound | null
  releaseTimer: ReturnType<typeof setTimeout> | null
}

/**
 * How long a player with no rows lingers before it is released. A row that
 * unmounts and mounts straight back (React's strict effects, a list re-render)
 * picks up the same player instead of creating a new one.
 */
export const NOTE_PLAYER_GRACE_MS = 500

const releasePlayer = (player: NotePlayer) => {
  try {
    player.pause()
  } catch {
    // already torn down
  }
  try {
    player.release?.()
  } catch {
    // already torn down
  }
}

export interface NotePlayerCache {
  /** The player for `key`, creating it on first use. Call during render. */
  get: (key: string | number, create: () => NotePlayer) => NotePlayer
  /** A mounted row holds the player. */
  retain: (key: string | number) => void
  /** The row unmounted. The player goes once no row holds it and it is not kept. */
  release: (key: string | number) => void
  /** Keep the player alive past its rows while the note is current. */
  keep: (key: string | number, isKept: boolean) => void
  setDetached: (key: string | number, detached: DetachedRound | null) => void
  /** Hands a detached note back to its row, if there is one. */
  takeDetached: (key: string | number) => DetachedRound | null
  /**
   * The chat mounts (`true`) or goes away (`false`). Going away ends every
   * detached note and drops the players no row holds; rows unmounting with it
   * then stop their notes instead of detaching them.
   */
  setActive: (isActive: boolean) => void
  isActive: () => boolean
}

export const createNotePlayerCache = (graceMs = NOTE_PLAYER_GRACE_MS): NotePlayerCache => {
  const entries = new Map<string | number, Entry>()
  let active = true

  const cancelTimer = (entry: Entry) => {
    if (entry.releaseTimer != null) {
      clearTimeout(entry.releaseTimer)
      entry.releaseTimer = null
    }
  }

  const scheduleRelease = (key: string | number, entry: Entry) => {
    cancelTimer(entry)
    if (entry.refs > 0 || entry.isKept)
      return

    entry.releaseTimer = setTimeout(() => {
      entry.releaseTimer = null
      if (entry.refs > 0 || entry.isKept || entries.get(key) !== entry)
        return

      entries.delete(key)
      releasePlayer(entry.player)
    }, graceMs)
  }

  return {
    get (key, create) {
      const existing = entries.get(key)
      if (existing)
        return existing.player

      const entry: Entry = { player: create(), refs: 0, isKept: false, detached: null, releaseTimer: null }
      entries.set(key, entry)
      // Created by a render that may never commit: release it unless a row
      // retains it in time.
      scheduleRelease(key, entry)
      return entry.player
    },
    retain (key) {
      const entry = entries.get(key)
      if (!entry)
        return

      entry.refs += 1
      cancelTimer(entry)
    },
    release (key) {
      const entry = entries.get(key)
      if (!entry)
        return

      entry.refs = Math.max(0, entry.refs - 1)
      scheduleRelease(key, entry)
    },
    keep (key, isKept) {
      const entry = entries.get(key)
      if (!entry || entry.isKept === isKept)
        return

      entry.isKept = isKept
      scheduleRelease(key, entry)
    },
    setDetached (key, detached) {
      const entry = entries.get(key)
      if (entry)
        entry.detached = detached
    },
    takeDetached (key) {
      const entry = entries.get(key)
      const detached = entry?.detached ?? null
      if (entry)
        entry.detached = null
      return detached
    },
    setActive (isActive) {
      active = isActive
      if (isActive)
        return

      for (const [key, entry] of [...entries]) {
        const detached = entry.detached
        entry.detached = null
        try {
          detached?.end()
        } catch {
          // keep tearing the rest down
        }
        entry.isKept = false
        if (entry.refs === 0) {
          cancelTimer(entry)
          entries.delete(key)
          releasePlayer(entry.player)
        }
      }
    },
    isActive () {
      return active
    },
  }
}

/** What a detached note needs from the chat around it. */
export interface DetachedRoundHost {
  cache: NotePlayerCache
  claim: (id: string, stop: (reason: 'replaced' | 'paused') => void) => void
  unclaim: (id: string) => void
  getRate: () => number
  subscribeRate: (listener: (rate: number) => void) => () => void
  /** Publish the note's state, or `null` once it is over. */
  report: (state: { isPlaying: boolean, toggle: () => void, stop: () => void } | null) => void
  /** It reached its end on its own: auto-play the next note. */
  onEnded: () => void
}

/**
 * Keeps a current round note going after its row unmounted. The player stays
 * as the row left it, playing or paused; this answers the "now playing" bar
 * and the floating note, stops when another note starts, and on the note's
 * natural end resets the player and hands over to the next note, as the row
 * would have.
 */
export const detachRoundNote = (
  key: string | number,
  player: NotePlayer,
  isPlaying: boolean,
  host: DetachedRoundHost
): DetachedRound => {
  const claimId = `detached-round:${String(key)}`
  let playing = isPlaying
  let isOver = false

  // Only while playing: on iOS a rate set on a paused player starts it.
  const unsubscribeRate = host.subscribeRate(rate => {
    if (!playing)
      return

    try {
      player.playbackRate = rate
    } catch {
      // already torn down
    }
  })
  let endSubscription: { remove?: () => void } | undefined

  const detach = () => {
    isOver = true
    endSubscription?.remove?.()
    unsubscribeRate()
    host.unclaim(claimId)
    host.cache.setDetached(key, null)
  }

  const end = () => {
    if (isOver)
      return

    detach()
    // Back to rest, so a row that mounts later shows the first frame.
    // The rate first: set after the pause, it would start the player again.
    try {
      player.playbackRate = 1
      player.pause()
      player.muted = true
      player.currentTime = 0
    } catch {
      // already torn down
    }
    host.report(null)
    host.cache.keep(key, false)
  }

  const pause = () => {
    try {
      player.pause()
    } catch {
      // already torn down
    }
    playing = false
    publish()
  }

  const toggle = () => {
    if (isOver)
      return

    if (playing) {
      pause()
      return
    }

    try {
      player.playbackRate = host.getRate()
      player.play()
    } catch {
      return
    }
    playing = true
    host.claim(claimId, onStop)
    publish()
  }

  // Another note starting ends this one (`cleanupPlayer`); a recording only
  // pauses it, and it stays current.
  const onStop = (reason: 'replaced' | 'paused') => {
    if (reason === 'replaced')
      end()
    else
      pause()
  }

  const publish = () => {
    if (!isOver)
      host.report({ isPlaying: playing, toggle, stop: end })
  }

  endSubscription = player.addListener?.('playToEnd', () => {
    if (isOver)
      return

    end()
    host.onEnded()
  })

  // A paused note keeps its claim too, so a later note still ends it.
  host.claim(claimId, onStop)
  publish()

  const detached: DetachedRound = {
    adopt () {
      if (!isOver)
        detach()
      return playing
    },
    end,
  }
  host.cache.setDetached(key, detached)
  return detached
}
