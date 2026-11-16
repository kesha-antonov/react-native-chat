import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import { ChatAppearanceName } from '@kesha-antonov/react-native-chat'

/**
 * The appearance every demo passes to `Chat`, `ChatList` and `ChatHeader`, picked in the Explore
 * tab. One app-wide value, as an app would keep it in its settings.
 */

export const APPEARANCES: Array<{ id: ChatAppearanceName, label: string }> = [
  { id: 'plain', label: 'Plain' },
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'mono', label: 'Mono' },
  { id: 'soft', label: 'Soft' },
]

let current: ChatAppearanceName = 'plain'
const listeners = new Set<() => void>()

export function setAppearance (appearance: ChatAppearanceName) {
  if (appearance === current)
    return
  current = appearance
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const getSnapshot = () => current

export function useAppearance (): ChatAppearanceName {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_MODES: Array<{ id: ThemeMode, label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

let currentThemeMode: ThemeMode = 'system'
const themeModeListeners = new Set<() => void>()

/**
 * Light or dark for the whole app, or the system setting. It overrides React Native's own scheme,
 * so `useColorScheme`, the library, the tab bar and the status bar all follow it at once.
 */
export function setThemeMode (mode: ThemeMode) {
  if (mode === currentThemeMode)
    return
  currentThemeMode = mode
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode)
  themeModeListeners.forEach(listener => listener())
}

const subscribeThemeMode = (listener: () => void) => {
  themeModeListeners.add(listener)
  return () => {
    themeModeListeners.delete(listener)
  }
}
const getThemeMode = () => currentThemeMode

export function useThemeMode (): ThemeMode {
  return useSyncExternalStore(subscribeThemeMode, getThemeMode, getThemeMode)
}
