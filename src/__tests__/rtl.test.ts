import { isRTLLocale, mirrorPosition } from '../rtl'

describe('isRTLLocale', () => {
  it('recognizes known right-to-left languages, case- and region-insensitively', () => {
    expect(isRTLLocale('ar')).toBe(true)
    expect(isRTLLocale('AR')).toBe(true)
    expect(isRTLLocale('ar-EG')).toBe(true)
    expect(isRTLLocale('he')).toBe(true)
    expect(isRTLLocale('fa')).toBe(true)
    expect(isRTLLocale('ur')).toBe(true)
  })

  it('treats left-to-right and unset locales as LTR', () => {
    expect(isRTLLocale('en')).toBe(false)
    expect(isRTLLocale('es')).toBe(false)
    expect(isRTLLocale('zh-CN')).toBe(false)
    expect(isRTLLocale(undefined)).toBe(false)
  })
})

describe('mirrorPosition', () => {
  it('passes position through unchanged when not RTL', () => {
    expect(mirrorPosition('left', false)).toBe('left')
    expect(mirrorPosition('right', false)).toBe('right')
  })

  it('flips left/right when RTL', () => {
    expect(mirrorPosition('left', true)).toBe('right')
    expect(mirrorPosition('right', true)).toBe('left')
  })

  it('leaves an undefined position as undefined either way', () => {
    expect(mirrorPosition(undefined, true)).toBeUndefined()
    expect(mirrorPosition(undefined, false)).toBeUndefined()
  })
})
