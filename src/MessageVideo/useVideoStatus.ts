import { useEffect, useState } from 'react'
import { NotePlayer } from '../components/roundNotePlayers'

export function useVideoStatus (player: NotePlayer) {
  const [status, setStatus] = useState(() => player.status)
  useEffect(() => {
    const subscription = player.addListener?.('statusChange', (event: { status: string }) => setStatus(event.status))
    setStatus(player.status)
    return () => subscription?.remove?.()
  }, [player])
  return status
}
