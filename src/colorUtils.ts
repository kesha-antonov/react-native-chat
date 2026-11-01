/**
 * Small color helpers for the tokens that Telegram derives from others: a reply box is its
 * accent line at 10%, an unchosen reaction pill its accent at 15.6%, and a glass surface with
 * blur off is its fill made opaque.
 */

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`; anything else is `null`. */
export function parseColor (color: string | undefined | null): RGBA | null {
  if (!color)
    return null

  const value = color.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (hex) {
    const digits = hex[1].length === 3
      ? hex[1].split('').map(c => c + c).join('')
      : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    }
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value)
  if (rgb)
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    }

  return null
}

export function formatColor ({ r, g, b, a }: RGBA): string {
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${Math.round(a * 1000) / 1000})`
}

/**
 * `color` with its alpha multiplied by `alpha` (Telegram's `multAlpha`). A color it cannot
 * parse (a named or platform color) comes back unchanged.
 */
export function multiplyAlpha (color: string, alpha: number): string {
  const parsed = parseColor(color)
  if (!parsed)
    return color

  return formatColor({ ...parsed, a: parsed.a * alpha })
}

/** `color` with the given alpha, replacing its own. */
export function withAlpha (color: string, alpha: number): string {
  const parsed = parseColor(color)
  if (!parsed)
    return color

  return formatColor({ ...parsed, a: alpha })
}

/** Average perceived brightness (HSB "B", 0..1) of a set of colors, as Telegram picks a pattern tint. */
export function averageBrightness (colors: string[]): number {
  const parsed = colors.map(parseColor).filter((c): c is RGBA => !!c)
  if (parsed.length === 0)
    return 1

  const total = parsed.reduce((sum, c) => sum + Math.max(c.r, c.g, c.b) / 255, 0)
  return total / parsed.length
}
