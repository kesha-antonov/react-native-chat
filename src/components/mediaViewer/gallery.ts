import { createContext, useContext } from 'react'

import { IMessage } from '../../Models'
import { createStore, Store, useStore } from '../../store'

/**
 * The chat's photos, for the media viewer: tapping a photo opens the viewer on it, and the
 * viewer pages through every photo in the conversation, oldest first, as Telegram's does
 * (swiping left reaches newer photos, the counter reads "3 of 12" from the oldest).
 */
export interface MediaGallery {
  /** The message whose photo is open, or null while the viewer is closed. */
  openId: Store<IMessage['_id'] | null>
  open: (messageId: IMessage['_id']) => void
  close: () => void
  /** The photo messages, oldest first, read when the viewer opens. */
  getItems: () => IMessage[]
  /** The chat's messages as `Chat` holds them, newest first; set after each render. */
  setMessages: (messages: readonly IMessage[]) => void
}

/**
 * The messages are only read when the viewer opens, so the gallery never re-renders anything
 * as messages arrive.
 */
export function createMediaGallery (): MediaGallery {
  const openId = createStore<IMessage['_id'] | null>(null)
  let messages: readonly IMessage[] = []
  return {
    setMessages: next => {
      messages = next
    },
    openId,
    open: messageId => openId.set(messageId),
    close: () => openId.set(null),
    getItems: () => {
      const items: IMessage[] = []
      for (let i = messages.length - 1; i >= 0; i--)
        if (messages[i].image)
          items.push(messages[i])
      return items
    },
  }
}

export const MediaGalleryContext = createContext<MediaGallery | null>(null)

export const useMediaGallery = () => useContext(MediaGalleryContext)

const openIdOf = (id: IMessage['_id'] | null) => id

/** The message whose photo is open; re-renders only when the viewer opens or closes. */
export const useOpenMediaId = (gallery: MediaGallery | null) => useStore(gallery?.openId, openIdOf, null)
