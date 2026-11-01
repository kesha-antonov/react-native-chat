import { createContext } from 'react'

/**
 * After a quote is tapped, the scroll-to-bottom button first
 * takes you back to the message you tapped it in, and only then down to the newest one.
 */
export interface PageDownReturn {
  messageId: string | number | null
  goBack: () => void
  clear: () => void
}

export const PageDownReturnContext = createContext<PageDownReturn | null>(null)
