import { ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native'
import { useChatContext } from '../ChatContext'

/**
 * React Native 0.86 widened `ColorSchemeName` with `'unspecified'`, which means
 * "no preference expressed" rather than a real scheme. Everything downstream
 * only understands light/dark, so collapse it (and `undefined`) to `null`.
 */
export const normalizeColorScheme = (
  scheme: ColorSchemeName | 'light' | 'dark' | null | undefined
): 'light' | 'dark' | null =>
  scheme === 'light' || scheme === 'dark' ? scheme : null

/**
 * Custom hook that returns the color scheme from Chat context if provided,
 * otherwise falls back to the system color scheme from React Native.
 *
 * @returns The current color scheme ('light', 'dark', or null)
 */
export function useColorScheme () {
  const { getColorScheme } = useChatContext()
  const contextColorScheme = getColorScheme()
  const systemColorScheme = useRNColorScheme()

  return normalizeColorScheme(
    contextColorScheme !== undefined && contextColorScheme !== null
      ? contextColorScheme
      : systemColorScheme
  )
}
