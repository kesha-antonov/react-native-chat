import React from 'react'

import { IconName } from '../Icons'
import { getSvg } from '../optional'

// Optional react-native-svg, resolved through the optional-peer registry (`src/optional`) so the bundle
// works whether or not it's installed. When present, all built-in icons render
// as their official Lucide glyphs (https://lucide.dev); otherwise the caller's
// drawn fallback is used, so there's never a hard dependency.
const svg = getSvg()
const Svg: any = svg ? svg.default ?? svg.Svg : null
const Path: any = svg?.Path
const Circle: any = svg?.Circle
const Rect: any = svg?.Rect
const Line: any = svg?.Line
const Polyline: any = svg?.Polyline
const Polygon: any = svg?.Polygon

export const isSvgAvailable = !!(Svg && Path)

// Icons drawn as solid shapes (play/pause read better filled on a button).
const FILLED = new Set<IconName>(['play', 'pause', 'verified'])

// Lucide glyph geometry (24x24 viewBox), one entry per IconName. Copied verbatim
// from lucide.dev so the icons match the design system exactly.
const glyphs: Record<IconName, () => React.ReactNode> = {
  // lucide `circle-check`, for the menu's Select.
  checkCircle: () => [
    <Circle key='a' cx={12} cy={12} r={10} />,
    <Path key='b' d='m9 12 2 2 4-4' />,
  ],
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
  copy: () => [
    <Rect key='a' width={14} height={14} x={8} y={8} rx={2} ry={2} />,
    <Path key='b' d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />,
  ],
  pinOff: () => [
    <Path key='a' d='M12 17v5' />,
    <Path key='b' d='M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89' />,
    <Path key='c' d='m2 2 20 20' />,
    <Path key='d' d='M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11' />,
  ],
  forward: () => [
    <Path key='a' d='m15 17 5-5-5-5' />,
    <Path key='b' d='M4 18v-2a4 4 0 0 1 4-4h12' />,
  ],
  keyboard: () => [
    <Path key='a' d='M10 8h.01' />,
    <Path key='b' d='M12 12h.01' />,
    <Path key='c' d='M14 8h.01' />,
    <Path key='d' d='M16 12h.01' />,
    <Path key='e' d='M18 8h.01' />,
    <Path key='f' d='M6 8h.01' />,
    <Path key='g' d='M7 16h10' />,
    <Path key='h' d='M8 12h.01' />,
    <Rect key='i' width={20} height={16} x={2} y={4} rx={2} />,
  ],
  search: () => [
    <Circle key='a' cx={11} cy={11} r={8} />,
    <Path key='b' d='m21 21-4.3-4.3' />,
  ],
  backspace: () => [
    <Path key='a' d='M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z' />,
    <Path key='b' d='m12 9 6 6' />,
    <Path key='c' d='m18 9-6 6' />,
  ],
  emojiAnimals: () => [
    <Path key='a' d='M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z' />,
    <Path key='b' d='M8 14v.5' />,
    <Path key='c' d='M16 14v.5' />,
    <Path key='d' d='M11.25 16.25h1.5L12 17l-.75-.75Z' />,
  ],
  emojiFood: () => [
    <Path key='a' d='M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z' />,
    <Path key='b' d='M10 2c1 .5 2 2 2 5' />,
  ],
  emojiActivities: () => [
    <Circle key='a' cx={12} cy={12} r={10} />,
    <Path key='b' d='M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94' />,
    <Path key='c' d='M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32' />,
    <Path key='d' d='M8.56 2.75c4.37 6 6 9.42 8 17.72' />,
  ],
  emojiTravel: () => [
    <Path key='a' d='M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2' />,
    <Circle key='b' cx={7} cy={17} r={2} />,
    <Path key='c' d='M9 17h6' />,
    <Circle key='d' cx={17} cy={17} r={2} />,
  ],
  emojiObjects: () => [
    <Path key='a' d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' />,
    <Path key='b' d='M9 18h6' />,
    <Path key='c' d='M10 22h4' />,
  ],
  emojiSymbols: () => [
    <Path key='a' d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' />,
  ],
  emojiFlags: () => [
    <Path key='a' d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' />,
    <Line key='b' x1={4} x2={4} y1={22} y2={15} />,
  ],
  gallery: () => [
    <Rect key='a' width={18} height={18} x={3} y={3} rx={2} ry={2} />,
    <Circle key='b' cx={9} cy={9} r={2} />,
    <Path key='c' d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />,
  ],
  file: () => [
    <Path key='a' d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' />,
    <Path key='b' d='M14 2v4a2 2 0 0 0 2 2h4' />,
  ],
  location: () => [
    <Path key='a' d='M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' />,
    <Circle key='b' cx={12} cy={10} r={3} />,
  ],
  download: () => [
    <Path key='a' d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />,
    <Polyline key='b' points='7 10 12 15 17 10' />,
    <Line key='c' x1={12} x2={12} y1={15} y2={3} />,
  ],
  // lucide `pin`: pinning, as opposed to `pin`, the map marker.
  pushpin: () => [
    <Path key='a' d='M12 17v5' />,
    <Path key='b' d='M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z' />,
  ],
  // lucide `archive-arrow-down`
  archive: () => [
    <Rect key='a' width={20} height={5} x={2} y={3} rx={1} />,
    <Path key='b' d='M4 8v11a2 2 0 0 0 2 2h.343' />,
    <Path key='c' d='M20 8v11a2 2 0 0 1-2 2h-.343' />,
    <Path key='d' d='m9 18 3 3 3-3' />,
    <Path key='e' d='M12 12v9' />,
  ],
  // lucide `archive-arrow-up`
  unarchive: () => [
    <Rect key='a' width={20} height={5} x={2} y={3} rx={1} />,
    <Path key='b' d='M4 8v11a2 2 0 0 0 2 2h2' />,
    <Path key='c' d='M20 8v11a2 2 0 0 1-2 2h-2' />,
    <Path key='d' d='m9 15 3-3 3 3' />,
    <Path key='e' d='M12 12v9' />,
  ],
  // lucide `archive`
  archiveFolder: () => [
    <Rect key='a' width={20} height={5} x={2} y={3} rx={1} />,
    <Path key='b' d='M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' />,
    <Path key='c' d='M10 12h4' />,
  ],
  // lucide `volume-off`
  mute: () => [
    <Path key='a' d='M16 9a5 5 0 0 1 .95 2.293' />,
    <Path key='b' d='M19.364 5.636a9 9 0 0 1 1.889 9.96' />,
    <Path key='c' d='m2 2 20 20' />,
    <Path key='d' d='m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11' />,
    <Path key='e' d='M9.828 4.172A.686.686 0 0 1 11 4.657v.686' />,
  ],
  // lucide `volume-2`
  unmute: () => [
    <Path key='a' d='M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' />,
    <Path key='b' d='M16 9a5 5 0 0 1 0 6' />,
    <Path key='c' d='M19.364 18.364a9 9 0 0 0 0-12.728' />,
  ],
  // lucide `badge-check`, filled with a white check (the verified mark).
  verified: () => [
    <Path key='a' d='M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z' stroke='none' />,
    <Path key='b' d='m16 9-5.5 5.5L8 12' fill='none' stroke='#FFFFFF' />,
  ],
  // lucide `menu`, the reorder handle.
  reorder: () => [
    <Path key='a' d='M4 5h16' />,
    <Path key='b' d='M4 12h16' />,
    <Path key='c' d='M4 19h16' />,
  ],
  arrowLeft: () => [
    <Path key='a' d='m12 19-7-7 7-7' />,
    <Path key='b' d='M19 12H5' />,
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
