import React from 'react'
import { useIcons } from '../hooks/useIcons'
import { IconName } from '../Icons'
import { LucideIcon, isSvgAvailable } from './LucideIcon'

export interface IconProps {
  name: IconName
  color: string
  size: number
  /** Drawn fallback, used only when react-native-svg is not installed. */
  fallback: React.ReactNode
}

/**
 * Resolves an icon in priority order:
 *   1. a consumer override from the `icons` registry (e.g. lucide-react-native),
 *   2. the built-in Lucide glyph (rendered via react-native-svg),
 *   3. the dependency-free drawn `fallback` when react-native-svg is absent.
 */
export const Icon = ({ name, color, size, fallback }: IconProps): React.ReactElement => {
  const icons = useIcons()
  const render = icons[name]

  if (render)
    return <>{render({ color, size })}</>

  if (isSvgAvailable)
    return <LucideIcon name={name} color={color} size={size} />

  return <>{fallback}</>
}
