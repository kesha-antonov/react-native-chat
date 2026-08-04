import { LogBox, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/use-color-scheme'

LogBox.ignoreLogs(['Open debugger to view warnings'])

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout () {
  const colorScheme = useColorScheme()

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Apps are expected to mount KeyboardProvider once, at the root.
          Chat detects it and does not mount a second one. */}
      <KeyboardProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name='(tabs)' />
            <Stack.Screen name='chat' />
            <Stack.Screen name='modal' options={{ headerShown: true, presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style='auto' />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
