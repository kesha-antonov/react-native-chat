import { useChatContext } from '../ChatContext'

/** Whether the chat is laying out right-to-left (`false` when used outside `Chat`). */
export function useIsRTL (): boolean {
  const { getIsRTL } = useChatContext()
  return getIsRTL?.() ?? false
}
