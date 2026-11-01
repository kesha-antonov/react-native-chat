const styleString = (color: string) => `color: ${color}; font-weight: bold`
const headerLog = '%c[@kesha-antonov/react-native-chat]'

export const warning = (...args: unknown[]) =>
  console.log(headerLog, styleString('orange'), ...args)

export const error = (...args: unknown[]) =>
  console.log(headerLog, styleString('red'), ...args)

const shownHints = new Set<string>()

/**
 * A development-only hint, shown once per `key` per app run - for a feature that quietly
 * turned itself off, e.g. because its optional peer is not installed. Silent in production.
 */
export const devHint = (key: string, ...args: unknown[]) => {
  if (typeof __DEV__ !== 'undefined' && !__DEV__)
    return

  if (shownHints.has(key))
    return

  shownHints.add(key)
  warning(...args)
}
