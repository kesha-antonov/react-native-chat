import { useColorScheme as useRNColorScheme } from 'react-native'
import { useChatContext } from '../ChatContext'

/**
 * Custom hook that returns the color scheme from Chat context if provided,
 * otherwise falls back to the system color scheme from React Native.
 * 
 * @returns The current color scheme ('light', 'dark', null, or undefined)
 */
export function useColorScheme() {
  const { getColorScheme } = useChatContext()
  const contextColorScheme = getColorScheme()
  const systemColorScheme = useRNColorScheme()
  
  return contextColorScheme !== undefined && contextColorScheme !== null
    ? contextColorScheme
    : systemColorScheme
}
