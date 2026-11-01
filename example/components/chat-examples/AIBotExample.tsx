import React, { useCallback } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Chat, IMessage, Send, useStreamingMessages, useTheme } from '@kesha-antonov/react-native-chat'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Assistant' }

const GREETING: IMessage = {
  _id: 'greeting',
  text: 'Hi! I am a mock streaming assistant. Send a message and watch the reply stream in token by token. You can hit Stop mid-stream.',
  createdAt: new Date(),
  user: BOT,
}

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    })
  })

// Canned reply, streamed word by word. Swap this for a real provider (see
// docs/STREAMING.md) - the streaming plumbing stays identical. The reply is
// markdown, rendered via messageTextProps.markdown below: the built-in
// dependency-free renderer handles it out of the box, and the optional
// react-native-streamdown peer is used automatically when installed.
function buildReply (prompt: string): string {
  return (
    `You said: **"${prompt.trim()}"**.\n\n` +
    'Here is a *streamed* answer rendered as **markdown**:\n\n' +
    '- tokens arrive one at a time\n' +
    '- the chat coalesces them into one render per frame\n' +
    '- partial markdown renders gracefully while streaming\n\n' +
    'Replace `buildReply` with a call to your LLM and feed tokens to `push()`:\n\n' +
    '```ts\n' +
    'onToken: token => stream.push(token)\n' +
    '```\n'
  )
}

// Stop button shown in the composer in place of Send while a reply streams, in the accent
// color the send button uses.
function StopButton ({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <View style={styles.sendWrap}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel='Stop generating'
        style={({ pressed }) => [styles.stopButton, { backgroundColor: theme.colors.accent }, pressed && styles.stopButtonPressed]}
      >
        <View style={styles.stopSquare} />
      </Pressable>
    </View>
  )
}

export default function AIBotExample () {
  const {
    messages,
    append,
    startStream,
    isStreaming,
    stop,
  } = useStreamingMessages<IMessage>({ initialMessages: [GREETING] })

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    const userMessage = newMessages[0]
    append(userMessage)

    const stream = startStream({ user: BOT })
    const reply = buildReply(userMessage.text);

    (async () => {
      const tokens = reply.split(/(\s+)/) // keep whitespace as its own tokens
      // small initial "thinking" pause
      await delay(350, stream.signal)
      for (const token of tokens) {
        if (stream.signal.aborted)
          return
        await delay(35, stream.signal)
        if (stream.signal.aborted)
          return
        stream.push(token)
      }
      stream.done()
    })()
  }, [append, startStream])

  // While streaming, the composer's Send button becomes a Stop button.
  const renderSend = useCallback(
    (sendProps: React.ComponentProps<typeof Send>) =>
      isStreaming ? <StopButton onPress={stop} /> : <Send {...sendProps} />,
    [isStreaming, stop]
  )

  return (
    <Chat<IMessage>
      messages={messages}
      onSend={onSend}
      user={USER}
      renderSend={renderSend}
      // Markdown in every message, not only while one streams: the built-in renderer, or
      // react-native-streamdown when it is installed.
      messageTextProps={{ markdown: true }}
    />
  )
}

const styles = StyleSheet.create({
  sendWrap: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonPressed: {
    opacity: 0.7,
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
})
