import { useMemo } from 'react'
import { useChatContext } from '../ChatContext'
import { ChatTheme, defaultDarkTheme, defaultLightTheme } from '../Theme'
import { useColorScheme } from './useColorScheme'

/**
 * Returns the active {@link ChatTheme}. Inside `Chat` this is the resolved theme
 * shared through context (defaults merged with `theme` / `darkTheme` overrides),
 * so switching the theme prop or the system color scheme at runtime updates
 * every consumer. Used standalone (outside `Chat`), it falls back to the
 * built-in defaults for the current system color scheme.
 */
export function useTheme (): ChatTheme {
  const colorScheme = useColorScheme()
  const { getTheme } = useChatContext()
  const contextTheme = getTheme?.()

  return useMemo(
    () => contextTheme ?? (colorScheme === 'dark' ? defaultDarkTheme : defaultLightTheme),
    [contextTheme, colorScheme]
  )
}

/**
 * DRY helper for theme-aware StyleSheets. Pass a module-level factory that maps
 * a theme to a `StyleSheet.create(...)` result; the styles are memoized on the
 * theme, so they are rebuilt only when the theme actually changes.
 *
 * @example
 * const createStyles = (theme: ChatTheme) => StyleSheet.create({ ... })
 * // inside a component:
 * const styles = useThemedStyles(createStyles)
 */
export function useThemedStyles<T> (factory: (theme: ChatTheme) => T): T {
  const theme = useTheme()
  return useMemo(() => factory(theme), [factory, theme])
}
