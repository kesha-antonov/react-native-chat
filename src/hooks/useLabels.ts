import { useChatContext } from '../ChatContext'
import { ChatLabels, defaultLabels } from '../i18n'

/** Returns the resolved UI labels (English defaults when used outside Chat). */
export function useLabels (): ChatLabels {
  const { getLabels } = useChatContext()
  return getLabels?.() ?? defaultLabels
}
