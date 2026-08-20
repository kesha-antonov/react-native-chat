import type { ChatLabels } from '../i18n'
import { ar } from './ar'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { hi } from './hi'
import { id } from './id'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { nl } from './nl'
import { pl } from './pl'
import { pt } from './pt'
import { ru } from './ru'
import { tr } from './tr'
import { zh } from './zh'

/**
 * Single source of truth for which locales ship a built-in UI translation. Adding a language:
 *   1. add its code here
 *   2. create src/locales/<code>.ts exporting `Partial<ChatLabels>`, add it to `translations`
 *      below (a missing entry is a compile error, since the record is typed over this tuple)
 *   3. add its `dayjs/locale/<code>` import and an entry to the exhaustiveness map in
 *      dayjsLocales.ts (also a compile error if skipped)
 */
export const SUPPORTED_LOCALES = ['es', 'fr', 'de', 'ru', 'zh', 'ar', 'pt', 'ja', 'ko', 'it', 'tr', 'hi', 'nl', 'pl', 'id'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export const translations: Record<SupportedLocale, Partial<ChatLabels>> = {
  es, fr, de, ru, zh, ar, pt, ja, ko, it, tr, hi, nl, pl, id,
}

/**
 * Map a BCP-47 tag (e.g. "pt-BR", "fr", "FR-ca") to one of our bundled locales, if any.
 * Shared by `resolveLabels` and available to anything else that needs the same
 * tag -> bundled-locale matching (e.g. picking a dayjs locale from the same set).
 */
export function matchSupportedLocale (locale: string | undefined): SupportedLocale | undefined {
  const base = locale?.split('-')[0]?.toLowerCase()
  return base && (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? base as SupportedLocale
    : undefined
}
