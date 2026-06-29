import React from 'react'

import { IconName } from '../Icons'

// Optional react-native-svg, resolved through a try/catch require so the bundle
// works whether or not it's installed. When present, all built-in icons render
// as their official Lucide glyphs (https://lucide.dev); otherwise the caller's
// drawn fallback is used, so there's never a hard dependency.
let Svg: any = null
let Path: any = null
let Circle: any = null
let Rect: any = null
let Line: any = null
let Polyline: any = null
let Polygon: any = null
try {
  const svg = require('react-native-svg')
  Svg = svg.default ?? svg.Svg
  Path = svg.Path
  Circle = svg.Circle
  Rect = svg.Rect
  Line = svg.Line
  Polyline = svg.Polyline
  Polygon = svg.Polygon
} catch {
  Svg = null
}

export const isSvgAvailable = !!(Svg && Path)

// Icons drawn as solid shapes (play/pause read better filled on a button).
const FILLED = new Set<IconName>(['play', 'pause'])

// Lucide glyph geometry (24x24 viewBox), one entry per IconName. Copied verbatim
// from lucide.dev so the icons match the design system exactly.
const glyphs: Record<IconName, () => React.ReactNode> = {
  send: () => [
    <Path key='a' d='M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' />,
    <Path key='b' d='m21.854 2.147-10.94 10.939' />,
  ],
  mic: () => [
    <Path key='a' d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' />,
    <Path key='b' d='M19 10v2a7 7 0 0 1-14 0v-2' />,
    <Line key='c' x1={12} x2={12} y1={19} y2={22} />,
  ],
  camera: () => [
    <Path key='a' d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' />,
    <Circle key='b' cx={12} cy={13} r={3} />,
  ],
  play: () => [
    <Polygon key='a' points='6 3 20 12 6 21 6 3' />,
  ],
  pause: () => [
    <Rect key='a' x={14} y={3} width={4} height={18} rx={1} />,
    <Rect key='b' x={6} y={3} width={4} height={18} rx={1} />,
  ],
  close: () => [
    <Path key='a' d='M18 6 6 18' />,
    <Path key='b' d='m6 6 12 12' />,
  ],
  chevronLeft: () => [
    <Path key='a' d='m15 18-6-6 6-6' />,
  ],
  chevronDown: () => [
    <Path key='a' d='m6 9 6 6 6-6' />,
  ],
  clock: () => [
    <Circle key='a' cx={12} cy={12} r={10} />,
    <Polyline key='b' points='12 6 12 12 16 14' />,
  ],
  check: () => [
    <Path key='a' d='M20 6 9 17l-5-5' />,
  ],
  checkAll: () => [
    <Path key='a' d='M18 6 7 17l-5-5' />,
    <Path key='b' d='m22 10-7.5 7.5L13 16' />,
  ],
  pin: () => [
    <Path key='a' d='M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' />,
    <Circle key='b' cx={12} cy={10} r={3} />,
  ],
  plus: () => [
    <Path key='a' d='M5 12h14' />,
    <Path key='b' d='M12 5v14' />,
  ],
  emoji: () => [
    <Circle key='a' cx={12} cy={12} r={10} />,
    <Path key='b' d='M8 14s1.5 2 4 2 4-2 4-2' />,
    <Line key='c' x1={9} x2={9.01} y1={9} y2={9} />,
    <Line key='d' x1={15} x2={15.01} y1={9} y2={9} />,
  ],
  paperclip: () => [
    <Path key='a' d='m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48' />,
  ],
  reply: () => [
    <Polyline key='a' points='9 17 4 12 9 7' />,
    <Path key='b' d='M20 18v-2a4 4 0 0 0-4-4H4' />,
  ],
  pencil: () => [
    <Path key='a' d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' />,
    <Path key='b' d='m15 5 4 4' />,
  ],
  lock: () => [
    <Rect key='a' x={3} y={11} width={18} height={11} rx={2} ry={2} />,
    <Path key='b' d='M7 11V7a5 5 0 0 1 10 0v4' />,
  ],
  trash: () => [
    <Path key='a' d='M3 6h18' />,
    <Path key='b' d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' />,
    <Path key='c' d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />,
    <Line key='d' x1={10} x2={10} y1={11} y2={17} />,
    <Line key='e' x1={14} x2={14} y1={11} y2={17} />,
  ],
}

export interface LucideIconProps {
  name: IconName
  color: string
  size: number
}

export const LucideIcon = ({ name, color, size }: LucideIconProps): React.ReactElement | null => {
  if (!isSvgAvailable)
    return null

  const filled = FILLED.has(name)

  return (
    <Svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      {glyphs[name]()}
    </Svg>
  )
}
