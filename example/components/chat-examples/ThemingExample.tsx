import React, { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, ChatIcons, IMessage, PartialChatTheme } from '@kesha-antonov/react-native-chat'

import { OptionChips } from './OptionChips'
import { useDemoSend } from './useDemoSend'

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

// Light text and meta for a saturated outgoing bubble, as the default day theme's pale green
// bubble carries dark text.
const onColoredBubble = {
  outgoingText: '#FFFFFF',
  outgoingMeta: 'rgba(255, 255, 255, 0.75)',
  outgoingLink: '#FFFFFF',
  ticksSent: 'rgba(255, 255, 255, 0.75)',
  ticksRead: '#FFFFFF',
  outgoingReplyLine: '#FFFFFF',
  outgoingReplyName: '#FFFFFF',
  outgoingReaction: '#FFFFFF',
  outgoingReactionText: '#FFFFFF',
  outgoingVoiceFill: '#FFFFFF',
  outgoingVoiceTrack: 'rgba(255, 255, 255, 0.4)',
}

// `theme` only applies in light mode; dark mode reads `darkTheme`. Each preset sets both,
// so switching works whichever scheme the device is in.
const PRESETS: Array<{ id: string, label: string, theme: PartialChatTheme, darkTheme: PartialChatTheme }> = [
  {
    id: 'default',
    label: 'Default',
    // The built-in look: the library's day and night themes.
    theme: {},
    darkTheme: {},
  },
  {
    id: 'blue',
    label: 'Blue',
    theme: { colors: { accent: '#3390EC', outgoingBubble: '#3390EC', ...onColoredBubble } },
    darkTheme: { colors: { accent: '#3390EC', outgoingBubble: '#2B5278', ...onColoredBubble } },
  },
  {
    id: 'green',
    label: 'WhatsApp green',
    // A flat background instead of the wallpaper.
    theme: { colors: { accent: '#25D366', outgoingBubble: '#DCF8C6', outgoingText: '#000000', outgoingMeta: '#5DA46B', background: '#ECE5DD' }, wallpaper: { isEnabled: false } },
    darkTheme: { colors: { accent: '#25D366', outgoingBubble: '#005C4B', outgoingText: '#E9EDEF', outgoingMeta: 'rgba(233, 237, 239, 0.6)', ticksSent: 'rgba(233, 237, 239, 0.6)', ticksRead: '#53BDEB', incomingBubble: '#202C33', background: '#0B141A' }, wallpaper: { isEnabled: false } },
  },
  {
    id: 'purple',
    label: 'Purple',
    theme: { colors: { accent: '#8E44AD', outgoingBubble: '#8E44AD', ...onColoredBubble }, wallpaper: { colors: ['#F3ECFA', '#D7BDE2', '#EBDEF0', '#C39BD3'] } },
    darkTheme: { colors: { accent: '#B07CC6', outgoingBubble: '#6C3483', incomingBubble: '#2A1F33', ...onColoredBubble }, wallpaper: { colors: ['#160F1C', '#2A1F33', '#1B1222', '#3B2547'] } },
  },
]

export default function ThemingExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [presetId, setPresetId] = useState('default')

  const onSend = useDemoSend(setMessages)

  const activePreset = useMemo(() => PRESETS.find(p => p.id === presetId) ?? PRESETS[0], [presetId])

  return (
    <View style={styles.container}>
      <OptionChips
        options={PRESETS.map(preset => ({ id: preset.id, label: preset.label, isActive: preset.id === presetId }))}
        onPress={setPresetId}
      />
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        theme={activePreset.theme}
        darkTheme={activePreset.darkTheme}
        icons={customIcons}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
