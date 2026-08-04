import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'


const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }

const INITIAL_MESSAGES: IMessage[] = [
  { _id: 2, text: 'Pick a language above - the composer placeholder, send button and other UI strings update instantly.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'The library ships translations for en, es, fr, de and ru, and you can override any string via the `labels` prop.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

const LOCALES: Array<{ id: string, label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Espanol' },
  { id: 'fr', label: 'Francais' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ru', label: 'Русский' },
]

export default function LocalizationExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [locale, setLocale] = useState('en')

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previous => Chat.append(previous, newMessages.map(m => ({
      ...m,
      _id: m._id || Math.random().toString(36).slice(2),
      user: USER,
      createdAt: new Date(),
    }))))
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {LOCALES.map(item => (
          <Pressable
            key={item.id}
            onPress={() => setLocale(item.id)}
            style={[styles.chip, locale === item.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, locale === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Chat<IMessage>
        messages={messages}
        onSend={onSend}
        user={USER}
        locale={locale}
        // Built-in translations are selected by `locale`. Override individual
        // strings with `labels`, e.g. labels={{ placeholder: 'Say hi...' }}.
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
