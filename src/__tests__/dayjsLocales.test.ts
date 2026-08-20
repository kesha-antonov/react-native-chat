import { BUNDLED_DAYJS_LOCALES } from '../dayjsLocales'
import { translations } from '../locales'

describe('dayjsLocales', () => {
  it('bundles a dayjs locale for every language src/locales/ ships translations for', () => {
    expect([...BUNDLED_DAYJS_LOCALES].sort()).toEqual(Object.keys(translations).sort())
  })
})
