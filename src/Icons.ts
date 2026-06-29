import { ReactNode } from 'react'

export interface IconProps {
  color: string
  size: number
}

export type IconRenderer = (props: IconProps) => ReactNode

/** Named icons the chat UI renders. Override any subset via the `icons` prop. */
export type IconName =
  | 'send'
  | 'mic'
  | 'camera'
  | 'play'
  | 'pause'
  | 'close'
  | 'chevronLeft'
  | 'chevronDown'
  | 'clock'
  | 'check'
  | 'checkAll'
  | 'pin'
  | 'plus'
  | 'emoji'
  | 'paperclip'
  | 'reply'
  | 'pencil'
  | 'lock'
  | 'trash'

/**
 * Icon override registry. Supply a render function for any icon to replace the
 * built-in (dependency-free) drawn icon with your own - e.g. lucide-react-native:
 *
 * ```tsx
 * import { Send, Mic } from 'lucide-react-native'
 * <Chat icons={{
 *   send: ({ color, size }) => <Send color={color} size={size} />,
 *   mic:  ({ color, size }) => <Mic color={color} size={size} />,
 * }} />
 * ```
 *
 * No dependency is added by this library; the drawn icons remain the default.
 */
export type ChatIcons = Partial<Record<IconName, IconRenderer>>
