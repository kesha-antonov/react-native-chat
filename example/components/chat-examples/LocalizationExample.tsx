import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

import { OptionChips } from './OptionChips'
import { useDemoSend } from './useDemoSend'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }

const INITIAL_MESSAGES: IMessage[] = [
  { _id: 2, text: 'Pick a language above - the composer placeholder, send button and other UI strings update instantly.', createdAt: new Date(Date.now() - 1000 * 30), user: BOT },
  { _id: 1, text: 'The library ships 15 built-in translations, and you can override any string via the `labels` prop. Arabic also switches the whole chat to right-to-left layout.', createdAt: new Date(Date.now() - 1000 * 60), user: BOT },
]

const LOCALES: Array<{ id: string, label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Espanol' },
  { id: 'fr', label: 'Francais' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ru', label: 'Русский' },
  { id: 'zh', label: '中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ar', label: 'العربية (RTL)' },
]

export default function LocalizationExample () {
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)
  const [locale, setLocale] = useState('en')

  const onSend = useDemoSend(setMessages)

  return (
    <View style={styles.container}>
      <OptionChips
        options={LOCALES.map(item => ({ id: item.id, label: item.label, isActive: item.id === locale }))}
        onPress={setLocale}
      />
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
})
