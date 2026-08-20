import { ChatLabels, defaultLabels } from '../i18n'
import { SUPPORTED_LOCALES, translations } from '../locales'

describe('locale translations', () => {
  const labelKeys = Object.keys(defaultLabels) as Array<keyof ChatLabels>

  it.each(SUPPORTED_LOCALES)('%s has no empty-string label values', locale => {
    const translation = translations[locale]
    for (const key of Object.keys(translation) as Array<keyof ChatLabels>)
      expect(translation[key]).not.toBe('')
  })

  it.each(SUPPORTED_LOCALES)('%s has no label key unknown to ChatLabels (stale/renamed key)', locale => {
    const translation = translations[locale]
    for (const key of Object.keys(translation))
      expect(labelKeys).toContain(key)
  })

  it('warns (without failing) about labels a locale has not caught up to yet', () => {
    // Partial translations are intentional (untranslated keys fall back to English), so a gap
    // is not a test failure - but it should be visible so translators know what is stale after
    // a new label is added to ChatLabels.
    const localesMissingLabels = SUPPORTED_LOCALES.map(locale => {
      const translation = translations[locale]
      const missing = labelKeys.filter(key => !(key in translation))
      return { locale, missing }
    }).filter(({ missing }) => missing.length > 0)

    for (const { locale, missing } of localesMissingLabels)
      console.warn(`[i18n] locale "${locale}" is missing translations for: ${missing.join(', ')} (falls back to English)`)

    expect(localesMissingLabels.map(({ locale }) => locale)).toEqual(expect.any(Array))
  })
})
