import { createContext, useContext } from 'react'

/**
 * Lets the message list close a panel the composer has open in the keyboard's place (the emoji
 * keyboard): Telegram hides it when you tap the chat. The composer registers its closer; the
 * list calls `close` on a tap. A plain mutable store, so neither side re-renders for it.
 */
export interface ComposerPanelsStore {
  close: () => void
  setCloser: (closer: (() => void) | null) => void
}

export const createComposerPanelsStore = (): ComposerPanelsStore => {
  let closer: (() => void) | null = null
  return {
    close: () => closer?.(),
    setCloser: next => {
      closer = next
    },
  }
}

export const ComposerPanelsContext = createContext<ComposerPanelsStore | null>(null)

export const useComposerPanels = () => useContext(ComposerPanelsContext)
