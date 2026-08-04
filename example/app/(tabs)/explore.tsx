import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { RectButton } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'

type ChatExample = 'basic' | 'customized-rendering' | 'slack' | 'links' | 'reply' | 'ai-bot' | 'reactions' | 'context-menu' | 'media' | 'theming' | 'localization' | 'day-animated' | 'keyboard-provider' | 'aligned-top'

const examples: Array<{ id: ChatExample, title: string, description: string }> = [
  { id: 'ai-bot', title: 'AI Bot (Streaming + Markdown)', description: 'Streamed assistant replies with a typing cursor, Stop button, and markdown rendering' },
  { id: 'reactions', title: 'Reactions', description: 'Long-press a message to react with emojis, with a full emoji browser' },
  { id: 'context-menu', title: 'Context Menu', description: 'Telegram-style long-press menu with Copy/Delete actions and a reactions row' },
  { id: 'media', title: 'Media & Voice', description: 'Audio, video and location messages, hold-to-record voice notes, and video recording' },
  { id: 'theming', title: 'Theming & Icons', description: 'Switch themes at runtime and override icons via the icon registry' },
  { id: 'localization', title: 'Localization (i18n)', description: 'Switch UI language at runtime; built-in en/es/fr/de/ru + custom labels' },
  { id: 'basic', title: 'Basic Example', description: 'Basic chat with keyboard logging for testing' },
  { id: 'links', title: 'Links & Patterns', description: 'Phone numbers, emails, URLs, hashtags, and mentions' },
  { id: 'customized-rendering', title: 'Customized Rendering', description: 'Customized chat with all rendering options' },
  { id: 'slack', title: 'Slack Style', description: 'Slack-like message styling' },
  { id: 'reply', title: 'Reply Example', description: 'Example demonstrating reply functionality' },
  { id: 'day-animated', title: 'Day Animated', description: 'Multi-day chat with Load earlier for testing the animated day header' },
  { id: 'keyboard-provider', title: 'App KeyboardProvider', description: 'Bare Chat under the app-level KeyboardProvider, with no keyboard props (issue #11)' },
  { id: 'aligned-top', title: 'Top Aligned (short chat)', description: 'isAlignedTop false / true / auto on a short chat, with optional very tall bubbles' },
]

export default function ExploreScreen () {
  const router = useRouter()
  const backgroundColor = useThemeColor({}, 'background')
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'icon')

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor }]} edges={['top']}>
      <ScrollView style={styles.fill}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type='title'>Explore Chat Examples</ThemedText>
        </ThemedView>
        <ThemedView style={styles.description}>
          <ThemedText>
            Choose from different chat implementations to see various features and styling options.
          </ThemedText>
        </ThemedView>
        <View style={styles.examplesContainer}>
          {examples.map(example => (
            <RectButton
              key={example.id}
              style={[styles.exampleCard, { borderColor }]}
              onPress={() => router.push(`/chat/${example.id}` as Href)}
            >
              <ThemedText type='subtitle' style={styles.exampleTitle}>
                {example.title}
              </ThemedText>
              <ThemedText style={styles.exampleDescription}>
                {example.description}
              </ThemedText>
              <ThemedText type='link' style={styles.tryButton}>
                Try it →
              </ThemedText>
            </RectButton>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  titleContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  description: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  examplesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  exampleCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  exampleTitle: {
    marginBottom: 2,
    fontSize: 16,
    lineHeight: 20,
  },
  exampleDescription: {
    opacity: 0.7,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 17,
  },
  tryButton: {
    alignSelf: 'flex-start',
  },
})
