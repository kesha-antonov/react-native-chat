import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

/**
 * Minimal chat screen, exactly as reported in issue #11: the app mounts
 * `KeyboardProvider` once at the root (see `app/_layout.tsx`) and the screen renders
 * `Chat` with no keyboard props at all.
 *
 * Chat must detect the app's provider and reuse it rather than nesting a second one -
 * two providers fight over the activity's window insets on Android. Check it with
 * `adb logcat | grep keyboardDidShow`: the event must be logged once per keyboard
 * opening, not twice.
 */
export default function KeyboardProviderExample () {
  const [messages, setMessages] = useState<IMessage[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      _id: i + 1,
      text: `Message ${20 - i}`,
      createdAt: new Date(),
      user: { _id: (i % 2) + 1, name: i % 2 === 0 ? 'Developer' : 'John Doe' },
    }))
  )

  const user = useMemo(() => ({ _id: 1 }), [])

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  return (
    <View style={styles.container}>
      <Chat
        messages={messages}
        user={user}
        onSend={onSend}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
