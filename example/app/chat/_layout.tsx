import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { defaultDarkTheme, defaultLightTheme } from '@kesha-antonov/react-native-chat'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useColorScheme } from '@/hooks/use-color-scheme'

export default function ChatLayout () {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  // The inset under the composer continues its bar, so it takes the bar's
  // colour; a fixed white showed as a strip under the dark chat.
  const colorScheme = useColorScheme()
  const insetBackground = (colorScheme === 'dark' ? defaultDarkTheme : defaultLightTheme).colors.inputBarBackground

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        // Expo Router 58 defaults to a transparent Liquid Glass header that the
        // screen scrolls under. iOS 26 then blurs scroll content beneath it with a
        // scroll edge effect, and on an inverted chat list that blur covers the
        // whole list. An opaque header keeps the list below it.
        headerTransparent: false,
        contentStyle: { paddingBottom: insets.bottom, backgroundColor: insetBackground },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name='chevron-back' size={24} color='#007AFF' />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name='basic'
        options={{ title: 'Basic Example' }}
      />
      <Stack.Screen
        name='customized-rendering'
        options={{ title: 'Customized Rendering' }}
      />
      <Stack.Screen
        name='links'
        options={{ title: 'Links & Patterns' }}
      />
      <Stack.Screen
        name='reply'
        options={{ title: 'Reply Example' }}
      />
      <Stack.Screen
        name='slack'
        options={{ title: 'Slack Style' }}
      />
      <Stack.Screen
        name='ai-bot'
        options={{ title: 'AI Bot (Streaming)' }}
      />
      <Stack.Screen
        name='reactions'
        options={{ title: 'Reactions' }}
      />
      <Stack.Screen
        name='context-menu'
        options={{ title: 'Context Menu' }}
      />
      <Stack.Screen
        name='media'
        options={{ title: 'Media & Voice' }}
      />
      <Stack.Screen
        name='theming'
        options={{ title: 'Theming & Icons' }}
      />
      <Stack.Screen
        name='localization'
        options={{ title: 'Localization (i18n)' }}
      />
      <Stack.Screen
        name='day-animated'
        options={{ title: 'Day Animated' }}
      />
      <Stack.Screen
        name='keyboard-provider'
        options={{ title: 'App KeyboardProvider' }}
      />
      <Stack.Screen
        name='aligned-top'
        options={{ title: 'Top Aligned (short chat)' }}
      />
    </Stack>
  )
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
})
