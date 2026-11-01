import React, { useEffect, useSyncExternalStore } from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { multiplyAlpha } from '../colorUtils'
import { useTheme, useThemedStyles } from '../hooks/useTheme'
import { IMessage, LinkPreview } from '../Models'
import { ChatTheme, getNameColor } from '../Theme'

/** What a custom `renderLinkPreview` receives. */
export interface LinkPreviewProps<TMessage extends IMessage = IMessage> {
  preview: LinkPreview & { url: string }
  currentMessage: TMessage
  position: 'left' | 'right'
  /** The widest the card can be inside the bubble. */
  maxWidth: number
  onPress?: (preview: LinkPreview & { url: string }, message: TMessage) => void
}

/** Fetches a preview for a URL; resolve `null` when the page has none. */
export type FetchLinkPreview = (url: string) => Promise<LinkPreview | null | undefined>

// Same matching as the text's own links: an explicit scheme, `www.`, or a bare domain.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>"]*)?/i
// Punctuation that ends a sentence rather than the link.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»]+$/

/** The first link in a text, with a scheme, or undefined. */
export function findFirstUrl (text: string | undefined): string | undefined {
  if (!text)
    return undefined

  const match = text.match(URL_PATTERN)
  if (!match)
    return undefined

  // An e-mail address is not a page.
  if (match.index != null && match.index > 0 && text[match.index - 1] === '@')
    return undefined

  const url = match[0].replace(TRAILING_PUNCTUATION, '')
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// One request per URL for the app's lifetime; the rows that show it share the answer.
const fetched = new Map<string, LinkPreview | null>()
const pending = new Map<string, Promise<LinkPreview | null>>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @internal Only for tests. */
export const resetLinkPreviewCache = () => {
  fetched.clear()
  pending.clear()
}

const fetchOnce = (url: string, fetchPreview: FetchLinkPreview): Promise<LinkPreview | null> => {
  let request = pending.get(url)
  if (!request) {
    request = Promise.resolve()
      .then(() => fetchPreview(url))
      .then(result => result ?? null, () => null)
      .then(result => {
        fetched.set(url, result)
        pending.delete(url)
        listeners.forEach(listener => listener())
        return result
      })
    pending.set(url, request)
  }
  return request
}

/**
 * The preview to draw for a message: its own `linkPreview`, or one fetched for the first link
 * in its text through `fetchPreview`. `linkPreview: null` turns it off for that message.
 */
export function useLinkPreview (
  message: IMessage | undefined,
  fetchPreview: FetchLinkPreview | undefined
): (LinkPreview & { url: string }) | null {
  const own = message?.linkPreview
  const firstUrl = own === null ? undefined : findFirstUrl(message?.text)
  const fetchUrl = own === undefined && fetchPreview ? firstUrl : undefined

  // Read through `useSyncExternalStore`, so the row re-renders when its fetch lands.
  const fetchedPreview = useSyncExternalStore(
    subscribe,
    () => (fetchUrl ? fetched.get(fetchUrl) : undefined),
    () => undefined
  )
  useEffect(() => {
    if (fetchUrl && fetchPreview && !fetched.has(fetchUrl))
      fetchOnce(fetchUrl, fetchPreview)
  }, [fetchUrl, fetchPreview])

  if (own) {
    const url = own.url ?? firstUrl
    if (!url || !(own.title || own.description || own.siteName || own.image))
      return null
    return { ...own, url }
  }

  if (!fetchUrl)
    return null

  const result = fetchedPreview
  if (!result || !(result.title || result.description || result.siteName || result.image))
    return null
  return { ...result, url: result.url ?? fetchUrl }
}

const hostOf = (url: string) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]

// `ReplyMessageLine` (TYPE_LINK) fills the block with its accent at 10%.
const BOX_ALPHA = 0.1
const BOX_ALPHA_ON_WHITE_LINE = 0.12
/** `smallImageSide` and `smallSideMargin`, `ChatMessageCell:7828`. */
const SMALL_IMAGE = 48
const SMALL_IMAGE_MARGIN = 10
/** Insets of the block's content: past the 3dp bar on the left, `dp(10)` on the right. */
const INSET_LEFT = 10
const INSET_RIGHT = 10
const MAX_IMAGE_HEIGHT = 320

/**
 * Telegram Android's web page preview (`ChatMessageCell.drawLinkPreview`): a rounded block in
 * the sender's color at 10% with a 3dp bar down its left side, the site name in that color,
 * the title in bold, a few lines of description, and the page's picture - full width under the
 * text, or a 48dp thumbnail at the top right. A tap opens the page.
 */
export function LinkPreviewCard<TMessage extends IMessage> ({
  preview,
  currentMessage,
  position,
  maxWidth,
  onPress,
}: LinkPreviewProps<TMessage>) {
  const theme = useTheme()
  const styles = useThemedStyles(createStyles)

  // Incoming previews take the sender's color, outgoing ones the bubble's (`linkLine.check`).
  const accent = position === 'left'
    ? (theme.nameColors.length ? getNameColor(theme, currentMessage.user?._id) : theme.colors.incomingReplyLine)
    : theme.colors.outgoingReplyLine
  const siteColor = position === 'left'
    ? (theme.nameColors.length ? accent : theme.colors.incomingReplyName)
    : theme.colors.outgoingReplyName
  const textColor = position === 'left' ? theme.colors.incomingText : theme.colors.outgoingText
  const boxAlpha = position === 'right' && accent.toUpperCase() === '#FFFFFF' ? BOX_ALPHA_ON_WHITE_LINE : BOX_ALPHA

  const aspect = preview.imageWidth && preview.imageHeight ? preview.imageWidth / preview.imageHeight : undefined
  const isSmallImage = !!preview.image &&
    (preview.imageSize === 'small' || (preview.imageSize !== 'large' && aspect != null && aspect <= 1))
  const isLargeImage = !!preview.image && !isSmallImage
  // The 3dp bar plus 7 of padding make the left inset.
  const imageWidth = Math.max(0, maxWidth - INSET_LEFT - INSET_RIGHT)
  const imageHeight = Math.min(MAX_IMAGE_HEIGHT, imageWidth / (aspect ?? 1.91))

  const handlePress = () => {
    if (onPress) {
      onPress(preview, currentMessage)
      return
    }
    Linking.openURL(preview.url).catch(() => {})
  }

  const siteName = preview.siteName ?? hostOf(preview.url)

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole='link'
      accessibilityLabel={[siteName, preview.title].filter(Boolean).join(', ')}
      style={[
        styles.card,
        { borderLeftColor: accent, backgroundColor: multiplyAlpha(accent, boxAlpha) },
        isLargeImage && { width: maxWidth },
      ]}
      testID='link-preview'
    >
      <View style={styles.row}>
        <View style={styles.texts}>
          {!!siteName && (
            <Text style={[styles.siteName, { color: siteColor }]} numberOfLines={1}>{siteName}</Text>
          )}
          {!!preview.title && (
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{preview.title}</Text>
          )}
          {!!preview.description && (
            <Text style={[styles.description, { color: textColor }]} numberOfLines={isSmallImage ? 3 : 4}>
              {preview.description}
            </Text>
          )}
        </View>
        {isSmallImage && (
          <Image source={{ uri: preview.image }} style={styles.smallImage} accessibilityIgnoresInvertColors />
        )}
      </View>
      {isLargeImage && (
        <Image
          source={{ uri: preview.image }}
          style={[styles.largeImage, { width: imageWidth, height: imageHeight }]}
          resizeMode='cover'
          accessibilityIgnoresInvertColors
        />
      )}
    </Pressable>
  )
}

// Text in `chat_replyNamePaint` / `chat_replyTextPaint`: (2 * 16 + 10) / 3 = 14dp; site name and
// title bold. The block starts 6 below the text and keeps the reply quote's corner radii.
const createStyles = (theme: ChatTheme) => StyleSheet.create({
  card: {
    marginTop: 2,
    marginHorizontal: theme.spacing.bubblePaddingH,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderTopLeftRadius: theme.radii.replyQuote,
    borderBottomLeftRadius: theme.radii.replyQuote,
    borderTopRightRadius: theme.radii.replyQuote * 2,
    borderBottomRightRadius: theme.radii.replyQuote * 2,
    paddingLeft: INSET_LEFT - 3,
    paddingRight: INSET_RIGHT,
    paddingTop: 5,
    paddingBottom: 7,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  texts: {
    flexShrink: 1,
  },
  siteName: {
    fontSize: theme.typography.replyName.fontSize,
    lineHeight: theme.typography.replyName.lineHeight,
    fontWeight: '700',
  },
  title: {
    marginTop: 2,
    fontSize: theme.typography.replyName.fontSize,
    lineHeight: theme.typography.replyName.lineHeight,
    fontWeight: '700',
  },
  description: {
    marginTop: 2,
    fontSize: theme.typography.replyText.fontSize,
    lineHeight: theme.typography.replyText.lineHeight,
  },
  smallImage: {
    width: SMALL_IMAGE,
    height: SMALL_IMAGE,
    marginLeft: SMALL_IMAGE_MARGIN,
    marginTop: 2,
    borderRadius: 6,
  },
  largeImage: {
    marginTop: 6,
    borderRadius: 6,
  },
})
