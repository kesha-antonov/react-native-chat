import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'
import { Chat, IMessage, useStreamingMessages } from '@kesha-antonov/react-native-chat'

import { useKeyboardVerticalOffset } from '../../hooks/useKeyboardVerticalOffset'
import { getColorSchemeStyle } from '../../utils/styleUtils'

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
// docs/STREAMING.md) - the streaming plumbing stays identical.
function buildReply (prompt: string): string {
  return (
    `You said: "${prompt.trim()}".\n\n` +
    'Here is a streamed answer. Each word arrives separately, and the chat ' +
    'coalesces them into one render per frame so it stays smooth even on a ' +
    'fast stream. Replace buildReply with a call to your LLM and feed tokens ' +
    'to push() - that is the whole integration.'
  )
}

export default function AIBotExample () {
  const colorScheme = useColorScheme()
  const keyboardVerticalOffset = useKeyboardVerticalOffset()

  const {
    messages,
    append,
    startStream,
    isStreaming,
    stop,
  } = useStreamingMessages<IMessage>({ initialMessages: [GREETING] })

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    const userMessage = {
      ...newMessages[0],
      _id: newMessages[0]?._id || Math.random().toString(36).slice(2),
      user: USER,
      createdAt: new Date(),
    }
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

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        messagesContainerStyle={getColorSchemeStyle(styles, 'messagesContainer', colorScheme)}
        textInputProps={{ style: getColorSchemeStyle(styles, 'composer', colorScheme) }}
        keyboardAvoidingViewProps={{ keyboardVerticalOffset }}
      />

      {isStreaming && (
        <View pointerEvents='box-none' style={styles.stopWrap}>
          <Pressable style={styles.stopButton} onPress={stop}>
            <Text style={styles.stopText}>{'■ Stop'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container_dark: {
    backgroundColor: '#000',
  },
  messagesContainer_dark: {
    backgroundColor: '#000',
  },
  composer_dark: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
  },
  stopWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stopText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
