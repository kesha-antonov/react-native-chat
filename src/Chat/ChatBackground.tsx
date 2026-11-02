import React from 'react'
import { ChatWallpaper, useOutgoingStep } from '../components/ChatWallpaper'
import { IMessage } from '../Models'
import { ChatTheme } from '../Theme'

/**
 * The wallpaper behind the list and the floating composer. It sits outside the keyboard
 * avoiding view, so the keyboard does not squash it, and holds the outgoing-message count
 * itself, so a send re-renders only this.
 */
export function ChatBackground ({
  messages,
  userId,
  isInverted,
  theme,
  renderWallpaper,
}: {
  messages: IMessage[]
  userId: string | number | undefined
  isInverted: boolean
  theme: ChatTheme
  renderWallpaper?: (() => React.ReactNode) | null
}) {
  const step = useOutgoingStep(messages, userId, isInverted)

  if (renderWallpaper !== undefined)
    return renderWallpaper ? <>{renderWallpaper()}</> : null

  if (!theme.wallpaper.isEnabled)
    return null

  return <ChatWallpaper step={step} />
}
