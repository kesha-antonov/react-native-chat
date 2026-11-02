import { useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { normalizeColorScheme } from '../hooks/useColorScheme'
import { resolveLabels } from '../i18n'
import { IMessage } from '../Models'
import { isRTLLocale } from '../rtl'
import { resolveTheme } from '../Theme'
import { ChatProps } from './types'

/** The theme, labels, direction and colour scheme the chat resolves once and hands down. */
export function useChatContextValue<TMessage extends IMessage> ({
  locale = 'en',
  forceRTL,
  colorScheme: colorSchemeProp,
  theme,
  darkTheme,
  icons,
  labels,
  actionSheet,
}: Pick<ChatProps<TMessage>, 'locale' | 'forceRTL' | 'colorScheme' | 'theme' | 'darkTheme' | 'icons' | 'labels' | 'actionSheet'>) {
  const systemColorScheme = useColorScheme()
  // RN 0.86 can report 'unspecified'; normalize it away before it reaches the theme.
  const colorScheme = normalizeColorScheme(
    colorSchemeProp !== undefined ? colorSchemeProp : systemColorScheme
  )

  // Resolve the theme once per change so its identity is stable; this is what
  // makes on-the-fly theme / color-scheme switching propagate to every memoized
  // StyleSheet without rebuilding styles on unrelated renders.
  const resolvedTheme = useMemo(
    () => resolveTheme(colorScheme, theme, darkTheme),
    [colorScheme, theme, darkTheme]
  )

  const resolvedLabels = useMemo(
    () => resolveLabels(locale, labels),
    [locale, labels]
  )

  const isRTL = useMemo(
    () => forceRTL ?? isRTLLocale(locale),
    [forceRTL, locale]
  )

  const contextValues = useMemo(
    () => ({
      // The built-in UI no longer uses an action sheet; this stays as an
      // escape hatch for consumers who pass their own `actionSheet` (e.g.
      // @expo/react-native-action-sheet). Defaults to a no-op.
      actionSheet:
        actionSheet ||
        (() => ({
          showActionSheetWithOptions: () => {},
        })),
      getLocale: () => locale,
      getIsRTL: () => isRTL,
      getColorScheme: () => colorScheme,
      getTheme: () => resolvedTheme,
      getIcons: () => icons,
      getLabels: () => resolvedLabels,
    }),
    [actionSheet, locale, isRTL, colorScheme, resolvedTheme, icons, resolvedLabels]
  )

  return { resolvedTheme, resolvedLabels, contextValues }
}
