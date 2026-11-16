import type { ChatAppearance, ChatAppearanceName } from '../Theme'
import { monoDark, monoLight } from './mono'
import { plainDark, plainLight } from './plain'
import { softDark, softLight } from './soft'
import { wallpaperDark, wallpaperLight } from './wallpaper'

/**
 * The built-in appearances, each a complete light and dark theme. Pick one with the
 * `appearance` prop, or spread one into your own: `{ ...chatAppearances.soft, light: ... }`.
 */
export const chatAppearances: Record<ChatAppearanceName, ChatAppearance> = {
  plain: { light: plainLight, dark: plainDark },
  wallpaper: { light: wallpaperLight, dark: wallpaperDark },
  mono: { light: monoLight, dark: monoDark },
  soft: { light: softLight, dark: softDark },
}

export const DEFAULT_APPEARANCE: ChatAppearanceName = 'plain'

/** A preset name or a `{ light, dark }` pair; anything else falls back to the default. */
export const getAppearance = (appearance?: ChatAppearanceName | ChatAppearance): ChatAppearance => {
  if (appearance && typeof appearance === 'object')
    return appearance
  return chatAppearances[appearance ?? DEFAULT_APPEARANCE] ?? chatAppearances[DEFAULT_APPEARANCE]
}
