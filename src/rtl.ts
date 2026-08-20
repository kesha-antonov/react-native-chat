/**
 * Right-to-left support. `isRTL` is resolved once in `Chat` (from `forceRTL`, falling back to
 * whether `locale` is a right-to-left language) and exposed via `useIsRTL()`. Components mirror
 * their own layout with it - there is no global `I18nManager.forceRTL` call here, since that is
 * an app-wide, native-reload-requiring switch that would be wrong to flip from a single `Chat`
 * instance.
 */

/**
 * Base language codes (BCP-47, lower-cased) that read right-to-left. Deliberately excludes
 * ambiguous macro-codes (e.g. `ku`, whose Sorani script is RTL but whose far more common
 * Kurmanji script is LTR) - pass `forceRTL` for those instead of relying on auto-detection.
 */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv'])

/** Whether a BCP-47 tag (e.g. "ar-EG", "he") names a right-to-left language. */
export function isRTLLocale (locale: string | undefined): boolean {
  const base = locale?.split('-')[0]?.toLowerCase()
  return !!base && RTL_LANGUAGES.has(base)
}

/**
 * Flip a semantic `'left' | 'right'` position to the side it should actually render on. Only
 * ever apply this to *physical* layout (alignment, margins, corner radii) - never to a
 * `LeftRightStyle` override keyed by message ownership (own vs. other message), which stays
 * keyed by the original, unmirrored position so a consumer's "my messages are blue" style
 * keeps meaning "my messages" regardless of which side they render on.
 */
export function mirrorPosition<T extends 'left' | 'right' | undefined> (position: T, isRTL: boolean): T {
  if (!isRTL || !position)
    return position

  return (position === 'left' ? 'right' : 'left') as T
}
