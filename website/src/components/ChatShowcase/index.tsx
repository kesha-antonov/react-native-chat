import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useColorMode } from '@docusaurus/theme-common'
import ChatShowcase from './ChatShowcase'

/**
 * The README carries the showcase as a GIF; sync-docs.mjs turns it into a
 * clip inside a `.chat-showcase` block. On the site the live scene takes its
 * place, so it stays sharp at any size and follows the site's color mode.
 */
export default function ChatShowcaseSlot () {
  const { colorMode } = useColorMode()
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.chat-showcase')
    if (!el)
      return
    el.setAttribute('data-live', '')
    setSlot(el)
    // The clip the scene replaces is hidden from here on, so it stops playing
    const clip = el.querySelector('video')
    clip?.pause()
    return () => {
      el.removeAttribute('data-live')
      clip?.play().catch(() => {})
    }
  }, [])

  if (!slot)
    return null
  return createPortal(<ChatShowcase theme={colorMode === 'dark' ? 'dark' : 'light'} />, slot)
}
