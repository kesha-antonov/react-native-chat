import { RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePlaylistEntry } from './mediaPlayback'

export function useVoicePlaybackEvents (
  messageId: string | number | undefined,
  isUnread: boolean,
  markReadRef: RefObject<() => void>,
  playNext: () => void,
  onPlaybackEnded?: () => void
) {
  const [isHeard, setIsHeard] = useState(false)
  const heardRef = useRef(false)
  const endedRef = usePlaylistEntry(messageId, playNext)
  const callbackRef = useRef(onPlaybackEnded)
  useLayoutEffect(() => {
    callbackRef.current = onPlaybackEnded
  })

  const markStarted = useCallback(() => {
    if (isUnread && !heardRef.current) {
      heardRef.current = true
      setIsHeard(true)
      markReadRef.current()
    }
  }, [isUnread, markReadRef])

  const notifyEnded = useCallback(() => {
    endedRef.current()
    callbackRef.current?.()
  }, [endedRef])

  return { isUnread: isUnread && !isHeard, markStarted, notifyEnded }
}
