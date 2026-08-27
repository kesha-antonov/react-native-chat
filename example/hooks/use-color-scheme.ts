import { useColorScheme as useRNColorScheme } from 'react-native'

/**
 * React Native's `ColorSchemeName` also admits `'unspecified'` alongside `null`, and no
 * theme palette has an entry for either. Collapse everything that isn't dark to light so
 * the result can index `Colors` directly.
 */
export function useColorScheme (): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light'
}
