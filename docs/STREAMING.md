# Streaming (AI) messages

`@kesha-antonov/react-native-chat` has first-class support for streamed assistant
replies - the kind of token-by-token output AI chat bots produce. This is the
piece plain chat UIs make you hand-roll.

## What the library gives you

- **`IMessage.streaming?: boolean`** - mark a message as still streaming. While
  true, its bubble shows a blinking caret ([`StreamingCursor`](../src/components/StreamingCursor.tsx)).
- **`useStreamingMessages(...)`** - a hook that owns the message list and batches
  token pushes with `requestAnimationFrame`, so a fast stream renders at most once
  per frame and only the streaming bubble re-renders. It also wires up
  `AbortController` so you can stop a generation.

The heavy lifting is the rAF batching: LLMs emit tokens far faster than 60fps, and
calling `setState` on every token janks the list. The hook coalesces them.

## Minimal usage

```tsx
import { Chat, IMessage, useStreamingMessages } from '@kesha-antonov/react-native-chat'

const USER = { _id: 1 }
const BOT = { _id: 2, name: 'Assistant' }

function Bot () {
  const { messages, append, startStream, isStreaming, stop } = useStreamingMessages<IMessage>()

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    append(newMessages[0])                 // show the user's message
    const stream = startStream({ user: BOT }) // insert an empty streaming bubble

    runMyModel(newMessages[0].text, {
      signal: stream.signal,               // aborts when stop() is called
      onToken: token => stream.push(token), // batched, one render per frame
      onDone: () => stream.done(),          // clears the streaming flag
    })
  }, [append, startStream])

  return <Chat messages={messages} onSend={onSend} user={USER} />
}
```

`startStream` returns a handle:

| Field | Purpose |
| --- | --- |
| `push(chunk)` | Append a token/chunk to the streaming message (rAF-batched). |
| `set(text)` | Replace the whole text (e.g. on a non-incremental update). |
| `done(patch?)` | Flush remaining text, clear `streaming`, optionally patch fields. |
| `signal` | `AbortSignal` to pass to your fetch/LLM call; `stop()` fires it. |

See a complete, runnable demo (with a Stop button and a mock token streamer) in
[`example/components/chat-examples/AIBotExample.tsx`](../example/components/chat-examples/AIBotExample.tsx).

## Wiring a real Claude stream

Call the model from **your backend**, never directly from the app - shipping an
Anthropic API key in a mobile bundle leaks it. The app talks to your endpoint;
your endpoint talks to Claude and forwards tokens.

### Backend (Node) - stream from Claude and forward chunks

Uses the official `@anthropic-ai/sdk`. Latest model id: `claude-opus-4-8`
(use `claude-sonnet-4-6` or `claude-haiku-4-5` for cheaper/faster bots).

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // reads ANTHROPIC_API_KEY from env

// e.g. an Express / Hono / Fastify handler that streams plain text chunks
export async function chatHandler (req, res) {
  const { messages } = req.body // [{ role: 'user' | 'assistant', content }]

  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
      res.write(event.delta.text) // forward the token to the app
  }
  res.end()
}
```

### App - read the response stream and push tokens

```tsx
const onSend = useCallback((newMessages: IChatMessage[] = []) => {
  append(newMessages[0])
  const stream = startStream({ user: BOT })

  fetch('https://your.api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: toClaudeMessages(messages, newMessages[0]) }),
    signal: stream.signal,
    reactNative: { textStreaming: true }, // RN: enable incremental body reads
  })
    .then(async res => {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        stream.push(decoder.decode(value, { stream: true }))
      }
      stream.done()
    })
    .catch(() => stream.done()) // also fires on stop() abort
}, [append, startStream, messages])
```

Notes:
- `reactNative: { textStreaming: true }` makes React Native's `fetch` expose a
  readable body for incremental reads.
- Keep your conversation as Claude-shaped `{ role, content }` messages on the
  backend; the chat UI's `IMessage[]` is a separate, UI-facing shape - map between
  them where you call your endpoint.
- For thinking models you can leave Claude's adaptive thinking on; surface only the
  final text deltas to `push()`.
