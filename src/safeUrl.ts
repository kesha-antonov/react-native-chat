import { Linking } from 'react-native'

import { warning } from './logging'

/**
 * A URL in a message comes from whoever sent it. Handed to `Linking.openURL` as is, a
 * `javascript:` link runs script on web (react-native-web opens it with `window.open`), an
 * `intent:` link starts any activity on Android, and a custom scheme drives any app that
 * registered it. So the library opens only the schemes below; an app that wants more takes
 * the press itself (`onPress` on `MessageText`, `onPressLinkPreview`, a matcher's `onPress`).
 */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms'])

/** Media and files may also be local: a file the user just picked, or one saved on the device. */
const MEDIA_SCHEMES = new Set(['http', 'https', 'file', 'content'])

/**
 * `url` as a browser reads it: browsers drop ASCII tabs and newlines anywhere in a URL and
 * control characters and spaces at either end, so `java\tscript:` is still `javascript:`.
 * The checks read the scheme from this, and the openers open this, never the raw string.
 */
const cleanUrl = (url: string) =>
  url.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '')

/** The scheme of `url`, lower case, or `null` when it has none. */
export function urlScheme (url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(cleanUrl(url))
  return match ? match[1].toLowerCase() : null
}

const hasScheme = (url: unknown, schemes: Set<string>): url is string => {
  if (typeof url !== 'string')
    return false

  const scheme = urlScheme(url)
  return scheme != null && schemes.has(scheme)
}

/** Whether the library may open `url` from a message: http(s), mailto, tel or sms. */
export const isSafeLinkUrl = (url: string | undefined | null): url is string =>
  hasScheme(url, LINK_SCHEMES)

/** Whether the library may open a message's media or file `uri`: http(s), file or content. */
export const isSafeMediaUrl = (url: string | undefined | null): url is string =>
  hasScheme(url, MEDIA_SCHEMES)

const open = (url: string, isSafe: boolean) => {
  if (!isSafe) {
    // The scheme alone: the rest of the URL is the sender's content.
    warning(`Not opening a link with the "${urlScheme(url) ?? 'none'}" scheme. Handle the press yourself to allow it.`)
    return
  }
  Linking.openURL(cleanUrl(url)).catch(() => {})
}

/** Opens a link from a message when its scheme is safe; otherwise does nothing. */
export const openLinkUrl = (url: string) => open(url, isSafeLinkUrl(url))

/** Opens a message's media or file `uri` when its scheme is safe; otherwise does nothing. */
export const openMediaUrl = (url: string) => open(url, isSafeMediaUrl(url))
