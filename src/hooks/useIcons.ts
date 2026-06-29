import { useChatContext } from '../ChatContext'
import { ChatIcons } from '../Icons'

const EMPTY: ChatIcons = {}

/** Returns the icon override registry from context (empty outside of Chat). */
export function useIcons (): ChatIcons {
  const { getIcons } = useChatContext()
  return getIcons?.() ?? EMPTY
}
