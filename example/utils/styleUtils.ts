/**
 * Picks the `<baseName>_<colorScheme>` entry out of a stylesheet.
 *
 * The key is built from the literal argument types so the result is the style that key
 * actually names - indexing with a widened `keyof T` would hand back a union of every
 * style in the sheet, text styles included, which no `ViewStyle` slot accepts.
 */
export function getColorSchemeStyle<
  T extends Record<string, unknown>,
  B extends string,
  C extends string
> (styles: T, baseName: B, colorScheme: C) {
  const key = `${baseName}_${colorScheme}`

  return styles[key] as Extract<`${B}_${C}`, keyof T> extends never
    ? undefined
    : T[Extract<`${B}_${C}`, keyof T>]
}
