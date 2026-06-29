import { createContext, useContext } from 'react'
import { ColorSchemeName } from 'react-native'
import { ChatLabels } from './i18n'
import { ChatIcons } from './Icons'
import { ChatTheme } from './Theme'

/**
 * Minimal, library-agnostic action-sheet options. The built-in UI no longer
 * depends on @expo/react-native-action-sheet; this type lets consumers still
 * plug their own action-sheet implementation in via the `actionSheet` prop
 * (its options are a superset of these fields, so it stays compatible).
 */
export interface ActionSheetOptions {
  options: string[]
  cancelButtonIndex?: number
  destructiveButtonIndex?: number | number[]
  title?: string
  message?: string
  tintColor?: string
  [key: string]: unknown
}

export interface IChatContext {
  actionSheet(): {
    showActionSheetWithOptions: (
      options: ActionSheetOptions,
      callback: (buttonIndex?: number) => void | Promise<void>
    ) => void
  }
  getLocale(): string
  getColorScheme(): ColorSchemeName | null | undefined
  /**
   * The fully-resolved theme for the current color scheme (defaults merged with
   * any `theme` / `darkTheme` overrides). Returns undefined when a component is
   * rendered outside of `Chat`, in which case `useTheme` falls back to the
   * built-in defaults for the system color scheme.
   */
  getTheme?(): ChatTheme | undefined
  /** Icon override registry (drawn icons are used for any name not provided). */
  getIcons?(): ChatIcons | undefined
  /** Resolved UI labels for the current locale (English defaults outside Chat). */
  getLabels?(): ChatLabels | undefined
}

export const ChatContext = createContext<IChatContext>({
  getLocale: () => 'en',
  actionSheet: () => ({
    showActionSheetWithOptions: () => {},
  }),
  getColorScheme: () => null,
  getTheme: () => undefined,
  getIcons: () => undefined,
  getLabels: () => undefined,
})

export const useChatContext = () => useContext(ChatContext)
