import React from 'react'
import { Text, TextStyle, StyleProp, Linking } from 'react-native'

export type LinkType = 'url' | 'email' | 'phone' | 'mention' | 'hashtag'

export interface ParsedLink {
  type: LinkType
  text: string
  url: string
  index: number
  length: number
}

export interface LinkMatcher {
  type: LinkType
  pattern: RegExp
  getLinkUrl?: (text: string) => string
  getLinkText?: (text: string) => string
  baseUrl?: string
  style?: StyleProp<TextStyle>
  renderLink?: (text: string, url: string, index: number, type: LinkType) => React.ReactNode
  onPress?: (url: string, type: LinkType) => void
}

interface LinkParserProps {
  text: string
  matchers?: LinkMatcher[]
  email?: boolean
  phone?: boolean
  url?: boolean
  hashtag?: boolean
  mention?: boolean
  hashtagUrl?: string
  mentionUrl?: string
  linkStyle?: StyleProp<TextStyle>
  onPress?: (url: string, type: LinkType) => void
  stripPrefix?: boolean
  textStyle?: StyleProp<TextStyle>
  TextComponent?: React.ComponentType<any>
}

let DEFAULT_MATCHER_URL : LinkMatcher | null = null

function getDefaultMatcherURL() : LinkMatcher {
  if (!DEFAULT_MATCHER_URL)
    DEFAULT_MATCHER_URL = {
      type: 'url',
      pattern: new RegExp('(?:https?:\\/\\/(?:www\\.)?|www\\.)[^\\s]+|(?<![A-Za-z0-9_.@])(?![A-Za-z0-9._%+-]*@)[a-zA-Z0-9][a-zA-Z0-9-]*\\.(?!@)[a-zA-Z]{2,}(?![A-Za-z0-9._%+-]*@)(?:\\/[^\\s]*)?', 'gi'),
      getLinkUrl: (text: string) => {
        if (!/^https?:\/\//i.test(text))
          return `http://${text}`

        return text
      },
    }

  return DEFAULT_MATCHER_URL
}

let DEFAULT_MATCHER_EMAIL : LinkMatcher | null = null

function getDefaultMatcherEmail() : LinkMatcher {
  if (!DEFAULT_MATCHER_EMAIL)
    DEFAULT_MATCHER_EMAIL = {
      type: 'email',
      pattern: new RegExp('(?<![A-Za-z0-9])([a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})', 'gi'),
      getLinkUrl: (text: string) => `mailto:${text}`,
    }

  return DEFAULT_MATCHER_EMAIL
}

let DEFAULT_MATCHER_PHONE : LinkMatcher | null = null

function getDefaultMatcherPhone() : LinkMatcher {
  if (!DEFAULT_MATCHER_PHONE)
    DEFAULT_MATCHER_PHONE = {
      type: 'phone',
      pattern: new RegExp('(?<![A-Za-z0-9_])(?:\\+?\\d{1,3}[\\s.\\-]?)?\\(?\\d{1,4}\\)?[\\s.\\-]?\\d{1,4}[\\s.\\-]?\\d{1,9}(?![A-Za-z0-9_]|\\.[a-z]{2,4})', 'gi'),
      getLinkUrl: (text: string) => {
        const cleaned = text.replace(/[\s.()\-]/g, '')
        return `tel:${cleaned}`
      },
    }

  return DEFAULT_MATCHER_PHONE
}

let DEFAULT_MATCHER_HASHTAG : LinkMatcher | null = null

function getDefaultMatcherHashtag() : LinkMatcher {
  if (!DEFAULT_MATCHER_HASHTAG)
    DEFAULT_MATCHER_HASHTAG = {
      type: 'hashtag',
      pattern: new RegExp('#[\\w]+', 'g'),
      getLinkUrl: (text: string) => text,
      baseUrl: undefined,
    }

  return DEFAULT_MATCHER_HASHTAG
}

let DEFAULT_MATCHER_MENTION : LinkMatcher | null = null

function getDefaultMatcherMention() : LinkMatcher {
  if (!DEFAULT_MATCHER_MENTION)
    DEFAULT_MATCHER_MENTION = {
      type: 'mention',
      pattern: new RegExp('(?<![a-zA-Z0-9._%+-])@[\\w-]+', 'g'),
      getLinkUrl: (text: string) => text,
      baseUrl: undefined,
    }

  return DEFAULT_MATCHER_MENTION
}

function parseLinks(text: string, matchers: LinkMatcher[]): ParsedLink[] {
  const links: ParsedLink[] = []

  matchers.forEach(matcher => {
    const matches = text.matchAll(matcher.pattern)
    for (const match of matches)
      if (match.index !== undefined) {
        const matchText = match[0]
        const url = matcher.getLinkUrl
          ? matcher.getLinkUrl(matchText)
          : matchText
        const linkText = matcher.getLinkText
          ? matcher.getLinkText(matchText)
          : matchText

        links.push({
          type: matcher.type,
          text: linkText,
          url,
          index: match.index,
          length: matchText.length,
        })
      }

  })

  // Sort by index to maintain order
  return links.sort((a, b) => a.index - b.index)
}

function removeOverlaps(links: ParsedLink[]): ParsedLink[] {
  const filtered: ParsedLink[] = []

  for (const link of links) {
    const hasOverlap = filtered.some(existing => {
      const existingEnd = existing.index + existing.length
      const linkEnd = link.index + link.length

      return (
        (link.index >= existing.index && link.index < existingEnd) ||
        (linkEnd > existing.index && linkEnd <= existingEnd) ||
        (link.index <= existing.index && linkEnd >= existingEnd)
      )
    })

    if (!hasOverlap)
      filtered.push(link)

  }

  return filtered
}

export function LinkParser({
  text,
  matchers: customMatchers,
  email = true,
  phone = true,
  url = true,
  hashtag = false,
  mention = false,
  hashtagUrl,
  mentionUrl,
  linkStyle,
  onPress,
  stripPrefix = true,
  textStyle,
  TextComponent = Text,
}: LinkParserProps): React.ReactElement {
  const activeMatchers: LinkMatcher[] = []

  // Add custom matchers first (they take precedence)
  if (customMatchers)
    activeMatchers.push(...customMatchers)


  // Add default matchers based on flags
  if (url && !customMatchers?.some(m => m.type === 'url'))
    activeMatchers.push(getDefaultMatcherURL())

  if (email && !customMatchers?.some(m => m.type === 'email'))
    activeMatchers.push(getDefaultMatcherEmail())

  if (phone && !customMatchers?.some(m => m.type === 'phone'))
    activeMatchers.push(getDefaultMatcherPhone())

  if (hashtag && !customMatchers?.some(m => m.type === 'hashtag')) {
    const hashtagMatcher = { ...getDefaultMatcherHashtag() }
    if (hashtagUrl) {
      hashtagMatcher.baseUrl = hashtagUrl
      const baseUrl = hashtagUrl.endsWith('/') ? hashtagUrl : `${hashtagUrl}/`
      hashtagMatcher.getLinkUrl = (text: string) => `${baseUrl}${text.substring(1)}`
    }
    activeMatchers.push(hashtagMatcher)
  }

  if (mention && !customMatchers?.some(m => m.type === 'mention')) {
    const mentionMatcher = { ...getDefaultMatcherMention() }
    if (mentionUrl) {
      mentionMatcher.baseUrl = mentionUrl
      const baseUrl = mentionUrl.endsWith('/') ? mentionUrl : `${mentionUrl}/`
      mentionMatcher.getLinkUrl = (text: string) => `${baseUrl}${text.substring(1)}`
    }
    activeMatchers.push(mentionMatcher)
  }


  const links = removeOverlaps(parseLinks(text, activeMatchers))

  if (links.length === 0)
    return <TextComponent style={textStyle}>{text}</TextComponent>


  const elements: React.ReactNode[] = []
  let lastIndex = 0

  links.forEach((link, index) => {
    // Add text before link
    if (link.index > lastIndex)
      elements.push(
        <TextComponent key={`text-${index}`} style={textStyle}>
          {text.substring(lastIndex, link.index)}
        </TextComponent>
      )


    // Find the matcher for this link
    const matcher = activeMatchers.find(m => m.type === link.type)

    // Handle link rendering
    if (matcher?.renderLink) {
      elements.push(matcher.renderLink(link.text, link.url, index, link.type))
    } else {
      const handlePress = () => {
        if (matcher?.onPress)
          matcher.onPress(link.url, link.type)
        else if (onPress)
          onPress(link.url, link.type)
        else
          // Default behavior
          Linking.openURL(link.url).catch(err => {
            console.warn('Failed to open URL:', err)
          })

      }

      let displayText = link.text
      if (stripPrefix && link.type === 'url')
        displayText = displayText.replace(/^https?:\/\//i, '')


      elements.push(
        <TextComponent
          key={`link-${index}`}
          style={[linkStyle, matcher?.style]}
          onPress={handlePress}
        >
          {displayText}
        </TextComponent>
      )
    }

    lastIndex = link.index + link.length
  })

  // Add remaining text
  if (lastIndex < text.length)
    elements.push(
      <TextComponent key='text-end' style={textStyle}>
        {text.substring(lastIndex)}
      </TextComponent>
    )


  return <TextComponent style={textStyle}>{elements}</TextComponent>
}
