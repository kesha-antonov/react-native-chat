import { BUNDLED_DAYJS_LOCALES } from '../dayjsLocales'
import { translations } from '../i18n'

describe('dayjsLocales', () => {
  it('bundles a dayjs locale for every language i18n.ts ships translations for', () => {
    expect([...BUNDLED_DAYJS_LOCALES].sort()).toEqual(Object.keys(translations).sort())
  })
})
