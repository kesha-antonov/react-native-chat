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

type StopHandler = () => void

const players = new Map<string, StopHandler>()

/**
 * Claim playback for `id`, stopping whatever else was playing.
 * Call when a player actually starts.
 */
export const claimPlayback = (id: string, stop: StopHandler) => {
  for (const [otherId, stopOther] of players)
    if (otherId !== id)
      try {
        stopOther()
      } catch {
        // a player that fails to stop must not block the new one
      }

  players.clear()
  players.set(id, stop)
}

/** Give up the claim (on pause, completion or unmount). */
export const releasePlayback = (id: string) => {
  players.delete(id)
}
