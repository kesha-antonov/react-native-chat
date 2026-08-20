// Registers dayjs's locale data (month/day names, calendar formats) on THIS library's own
// dayjs module instance, for every language src/locales/ ships UI translations for.
//
// Day and Time format dates via `dayjs(...).locale(getLocale()).format(...)`, which silently
// falls back to English month/day names unless the *exact* dayjs module instance doing the
// formatting has already had `dayjs/locale/<code>` imported into it. A host app importing that
// locale file for its own `dayjs` does NOT help here whenever more than one physical copy of
// dayjs ends up installed (any yarn/npm workspace, or just a host app + this library resolving
// slightly different dayjs semver ranges) - each copy keeps its own locale registry. Importing
// the locale files here, once, guarantees this library formats dates correctly regardless of
// what the host app does.
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/de'
import 'dayjs/locale/ru'
import 'dayjs/locale/zh'
import 'dayjs/locale/ar'
import 'dayjs/locale/pt'
import 'dayjs/locale/ja'
import 'dayjs/locale/ko'
import 'dayjs/locale/it'
import 'dayjs/locale/tr'
import 'dayjs/locale/hi'
import 'dayjs/locale/nl'
import 'dayjs/locale/pl'
import 'dayjs/locale/id'

import { SupportedLocale } from './locales'

// Exhaustiveness check: `SupportedLocale` comes from the single source of truth in
// ./locales/index.ts. If a new locale is added there without a matching `dayjs/locale/<code>`
// import and entry here, this object literal fails to typecheck (missing property) - catching
// the drift at compile time. dayjsLocales.test.ts re-asserts the same invariant at runtime.
const bundled: Record<SupportedLocale, true> = {
  es: true, fr: true, de: true, ru: true, zh: true, ar: true, pt: true, ja: true,
  ko: true, it: true, tr: true, hi: true, nl: true, pl: true, id: true,
}

export const BUNDLED_DAYJS_LOCALES = Object.keys(bundled) as SupportedLocale[]
