import { useCallback, useEffect, useRef, useState } from 'react'

import { IMessage, User } from '../Models'

/** Fields you provide when opening a stream for an assistant reply. */
export type StartStreamInput<TMessage extends IMessage = IMessage> =
  Partial<TMessage> & { user: User }

/** Handle returned by `startStream` to feed tokens into the placeholder message. */
export interface StreamHandle {
  /** _id of the streaming message. */
  id: IMessage['_id']
  /** Append a token/chunk to the message text (batched per animation frame). */
  push: (chunk: string) => void
  /** Replace the whole message text. */
  set: (text: string) => void
  /** Flush remaining text, clear the streaming flag, optionally patch fields. */
  done: (finalPatch?: Partial<IMessage>) => void
  /** AbortSignal tied to this stream; pass it to your fetch/LLM call. */
  signal: AbortSignal
}

export interface UseStreamingMessagesOptions<TMessage extends IMessage = IMessage> {
  initialMessages?: TMessage[]
  /** Newest message first in the array (matches `<Chat>` default). Default true. */
  inverted?: boolean
}

export interface UseStreamingMessagesResult<TMessage extends IMessage = IMessage> {
  messages: TMessage[]
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
  /** Add message(s) respecting the configured order. */
  append: (newMessages: TMessage | TMessage[]) => void
  /** Insert an empty assistant message flagged `streaming` and return a feed handle. */
  startStream: (assistant: StartStreamInput<TMessage>) => StreamHandle
  /** True between `startStream` and `done`/`stop`. */
  isStreaming: boolean
  /** Abort the active stream (also fires the stream's AbortSignal). */
  stop: () => void
}

/**
 * Message state tuned for streamed (AI) replies. Token pushes are coalesced
 * with `requestAnimationFrame` so a fast stream produces at most one render per
 * frame, and only the streaming message is updated.
 */
export function useStreamingMessages<TMessage extends IMessage = IMessage> (
  options: UseStreamingMessagesOptions<TMessage> = {}
): UseStreamingMessagesResult<TMessage> {
  const { initialMessages = [], inverted = true } = options

  const [messages, setMessages] = useState<TMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)

  const idCounter = useRef(0)
  const bufferRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const activeIdRef = useRef<IMessage['_id'] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancelFrame = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const flush = useCallback(() => {
    rafRef.current = null
    const id = activeIdRef.current
    const chunk = bufferRef.current
    if (id == null || !chunk)
      return

    bufferRef.current = ''
    setMessages(prev =>
      prev.map(m => (m._id === id ? { ...m, text: m.text + chunk } as TMessage : m))
    )
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current == null)
      rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const append = useCallback((newMessages: TMessage | TMessage[]) => {
    const arr = Array.isArray(newMessages) ? newMessages : [newMessages]
    setMessages(prev => (inverted ? arr.concat(prev) : prev.concat(arr)))
  }, [inverted])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const startStream = useCallback((assistant: StartStreamInput<TMessage>): StreamHandle => {
    // Finalize any previous stream before starting a new one.
    cancelFrame()
    bufferRef.current = ''
    abortRef.current?.abort()

    const id = (assistant._id ?? `stream-${Date.now()}-${idCounter.current++}`) as IMessage['_id']
    const controller = new AbortController()
    abortRef.current = controller
    activeIdRef.current = id

    const placeholder = {
      text: '',
      createdAt: new Date(),
      ...assistant,
      _id: id,
      streaming: true,
    } as unknown as TMessage

    setMessages(prev => (inverted ? [placeholder, ...prev] : [...prev, placeholder]))
    setIsStreaming(true)

    let finished = false
    const finalize = (finalPatch?: Partial<IMessage>) => {
      if (finished)
        return
      finished = true

      cancelFrame()
      const remaining = bufferRef.current
      bufferRef.current = ''
      setMessages(prev =>
        prev.map(m =>
          m._id === id
            ? { ...m, text: m.text + remaining, streaming: false, ...finalPatch } as TMessage
            : m
        )
      )
      if (activeIdRef.current === id)
        activeIdRef.current = null

      setIsStreaming(false)
    }

    controller.signal.onabort = () => finalize()

    return {
      id,
      push: (chunk: string) => {
        bufferRef.current += chunk
        scheduleFlush()
      },
      set: (text: string) => {
        bufferRef.current = ''
        setMessages(prev =>
          prev.map(m => (m._id === id ? { ...m, text } as TMessage : m))
        )
      },
      done: (finalPatch?: Partial<IMessage>) => finalize(finalPatch),
      signal: controller.signal,
    }
  }, [inverted, cancelFrame, scheduleFlush])

  useEffect(() => () => {
    cancelFrame()
    abortRef.current?.abort()
  }, [cancelFrame])

  return { messages, setMessages, append, startStream, isStreaming, stop }
}
