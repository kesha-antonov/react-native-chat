import { createContext, useContext } from 'react'
import { StyleProp, TextStyle } from 'react-native'

/** The words to mark in message text (`Chat`'s `highlightText`), e.g. a search query. */
export interface TextHighlight {
  text: string
  style?: StyleProp<TextStyle>
}

export const TextHighlightContext = createContext<TextHighlight | null>(null)

export const useTextHighlight = () => useContext(TextHighlightContext)

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The parts of `text`, each marked whether it matches `query` (case-insensitive). */
export function splitHighlights (text: string, query: string): { text: string, isMatch: boolean }[] {
  const needle = query.trim()
  if (!needle || !text)
    return [{ text, isMatch: false }]

  const pattern = new RegExp(escapeRegExp(needle), 'gi')
  const parts: { text: string, isMatch: boolean }[] = []
  let lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex)
      parts.push({ text: text.slice(lastIndex, index), isMatch: false })
    parts.push({ text: match[0], isMatch: true })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length)
    parts.push({ text: text.slice(lastIndex), isMatch: false })
  return parts
}
