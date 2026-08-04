import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Chat, ChatIcons, IMessage, PartialChatTheme } from '@kesha-antonov/react-native-chat'


const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Theme Bot' }

const INITIAL_MESSAGES: IMessage[] = [
  { _id: 4, text: 'Nice - my bubble, the accent and the send button all follow the theme.', createdAt: new Date(Date.now() - 1000 * 10), user: USER },
  { _id: 3, text: 'Tap a preset above and watch the whole chat restyle instantly.', createdAt: new Date(Date.now() - 1000 * 20), user: BOT },
  { _id: 2, text: 'Switch the theme above. Every token (accent, bubbles, background, dark mode) is overridable.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'Tap a preset to see the theme change at runtime.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

// A custom send icon supplied through the `icons` registry (no extra dependency
// here, but this is exactly where you'd drop a lucide-react-native component).
const customIcons: ChatIcons = {
  send: ({ color, size }) => (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size / 2,
        borderBottomWidth: size / 2,
        borderLeftWidth: size * 0.9,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        marginLeft: size * 0.1,
      }}
    />
  ),
}

const PRESETS: Array<{ id: string, label: string, theme?: PartialChatTheme }> = [
  { id: 'default', label: 'Telegram blue', theme: { colors: { accent: '#3390EC', outgoingBubble: '#3390EC', background: '#EFEFF4' } } },
  { id: 'green', label: 'WhatsApp green', theme: { colors: { accent: '#25D366', outgoingBubble: '#DCF8C6', outgoingText: '#000000', outgoingMeta: '#5DA46B', background: '#ECE5DD' } } },
  { id: 'purple', label: 'Purple', theme: { colors: { accent: '#8E44AD', outgoingBubble: '#8E44AD', background: '#F3ECFA' } } },
]

export default function ThemingExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [presetId, setPresetId] = useState('default')

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages.map(m => ({
      ...m,
      _id: m._id || Math.random().toString(36).slice(2),
      user: USER,
      createdAt: new Date(),
    }))))
  }, [])

  const theme = useMemo(() => PRESETS.find(p => p.id === presetId)?.theme, [presetId])

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {PRESETS.map(preset => (
          <Pressable
            key={preset.id}
            onPress={() => setPresetId(preset.id)}
            style={[styles.chip, presetId === preset.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, presetId === preset.id && styles.chipTextActive]}>
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        theme={theme}
        icons={customIcons}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  chipActive: {
    backgroundColor: '#3390EC',
    borderColor: '#3390EC',
  },
  chipText: {
    fontSize: 13,
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})
