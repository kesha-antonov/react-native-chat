import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useColorMode } from '@docusaurus/theme-common'
import ChatShowcase from './ChatShowcase'

/**
 * The README carries the showcase as a GIF; sync-docs.mjs wraps it in a
 * `.chat-showcase` block. On the site the live scene takes the GIF's place,
 * so it stays sharp at any size and follows the site's color mode.
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
    return () => el.removeAttribute('data-live')
  }, [])

  if (!slot)
    return null
  return createPortal(<ChatShowcase theme={colorMode === 'dark' ? 'dark' : 'light'} />, slot)
}
