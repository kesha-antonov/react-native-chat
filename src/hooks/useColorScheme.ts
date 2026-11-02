import { useSyncExternalStore } from 'react'
import { Appearance, ColorSchemeName } from 'react-native'
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

const subscribeAppearance = (listener: () => void) => {
  const subscription = Appearance.addChangeListener(listener)
  return () => subscription.remove()
}
const noopSubscribe = () => () => {}
const getAppearance = () => Appearance.getColorScheme()

/**
 * The system colour scheme, subscribed to only while `isNeeded`. Inside a `Chat` the context
 * already carries the scheme, and every row asks for it several times: a listener per call
 * would be thousands of system listeners on a long list for one value the root already reads.
 */
export function useSystemColorScheme (isNeeded: boolean) {
  return useSyncExternalStore(isNeeded ? subscribeAppearance : noopSubscribe, getAppearance, getAppearance)
}

/**
 * Custom hook that returns the color scheme from Chat context if provided,
 * otherwise falls back to the system color scheme from React Native.
 *
 * @returns The current color scheme ('light', 'dark', or null)
 */
export function useColorScheme () {
  const { getColorScheme } = useChatContext()
  const contextColorScheme = getColorScheme()
  const hasContextScheme = contextColorScheme !== undefined && contextColorScheme !== null
  const systemColorScheme = useSystemColorScheme(!hasContextScheme)

  return normalizeColorScheme(hasContextScheme ? contextColorScheme : systemColorScheme)
}
