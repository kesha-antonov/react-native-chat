// Registers dayjs's locale data (month/day names, calendar formats) on THIS library's own
// dayjs module instance, for every language i18n.ts ships UI translations for.
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

// Source of truth for dayjsLocales.test.ts, which asserts this stays in sync with the languages
// translated in i18n.ts - add a `dayjs/locale/<code>` import above alongside any new translation.
export const BUNDLED_DAYJS_LOCALES = ['es', 'fr', 'de', 'ru']
