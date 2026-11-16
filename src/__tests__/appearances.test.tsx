import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { ChatHeader, ChatList, chatAppearances, defaultDarkTheme, defaultLightTheme, resolveTheme } from '..'
import { contrastRatio, formatColor, parseColor } from '../colorUtils'

// What is drawn: a translucent color over the surface under it.
const over = (fg: string, bg: string) => {
  const f = parseColor(fg)
  const b = parseColor(bg)
  if (!f || !b || f.a === 1)
    return fg
  return formatColor({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 })
}

const SCHEMES = ['light', 'dark'] as const
const presets = Object.entries(chatAppearances).flatMap(([name, appearance]) =>
  SCHEMES.map(scheme => ({ name, scheme, theme: appearance[scheme] })))

describe('appearances', () => {
  it('defaults to plain, with no wallpaper and solid bubbles', () => {
    expect(defaultLightTheme).toBe(chatAppearances.plain.light)
    expect(defaultDarkTheme).toBe(chatAppearances.plain.dark)
    expect(resolveTheme('light')).toBe(chatAppearances.plain.light)
    expect(defaultLightTheme.wallpaper.isEnabled).toBe(false)
    expect(defaultDarkTheme.bubble.outgoingGradient).toBeNull()
  })

  it('keeps the wallpaper look under its own name', () => {
    expect(chatAppearances.wallpaper.light.wallpaper.isEnabled).toBe(true)
    expect(chatAppearances.wallpaper.dark.bubble.outgoingGradient).toEqual(['#9F3EAA', '#8146D7', '#4272DF', '#258DE5'])
  })

  it('resolves a preset by name or a custom pair, with theme overrides on top', () => {
    expect(resolveTheme('dark', undefined, undefined, 'soft')).toBe(chatAppearances.soft.dark)
    const custom = { light: chatAppearances.mono.light, dark: chatAppearances.soft.dark }
    expect(resolveTheme('light', undefined, undefined, custom)).toBe(chatAppearances.mono.light)
    const tuned = resolveTheme('light', { colors: { accent: '#FF0000' } }, undefined, 'mono')
    expect(tuned.colors.accent).toBe('#FF0000')
    expect(tuned.colors.outgoingBubble).toBe(chatAppearances.mono.light.colors.outgoingBubble)
  })

  it.each(presets)('$name $scheme sets every token the wallpaper theme does', ({ theme }) => {
    const reference = chatAppearances.wallpaper.light
    const missing = (Object.keys(reference) as Array<keyof typeof reference>).flatMap(group => {
      const value = reference[group]
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return []
      const has = theme[group] as Record<string, unknown>
      return Object.keys(value).filter(key => has[key] === undefined).map(key => `${group}.${key}`)
    })
    expect(missing).toEqual([])
  })

  // The wallpaper look predates these checks and keeps Telegram's values; the new ones are held
  // to readable contrast.
  const designed = presets.filter(preset => preset.name !== 'wallpaper')
  const checks: Array<[string, keyof typeof defaultLightTheme.colors, keyof typeof defaultLightTheme.colors, number]> = [
    ['message text', 'incomingText', 'incomingBubble', 4.5],
    ['message text', 'outgoingText', 'outgoingBubble', 4.5],
    ['time', 'incomingMeta', 'incomingBubble', 2.5],
    ['time', 'outgoingMeta', 'outgoingBubble', 2.5],
    ['link', 'incomingLink', 'incomingBubble', 3],
    ['link', 'outgoingLink', 'outgoingBubble', 3],
    ['send icon', 'onAccent', 'accent', 3],
    ['composer text', 'inputText', 'inputBackground', 4.5],
    ['date pill', 'dayPillText', 'dayPillBackground', 4],
  ]
  it.each(designed)('$name $scheme is readable', ({ theme }) => {
    const { colors } = theme
    const failures = checks.flatMap(([label, fg, bg, min]) => {
      const surface = over(colors[bg], colors.background)
      const ratio = contrastRatio(over(colors[fg], surface), surface)
      return ratio < min ? [`${label} ${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`] : []
    })
    expect(failures).toEqual([])
  })

  // A header or a list in one style over a chat in another would show the seam.
  const hasBackground = (node: unknown, color: string): boolean => {
    if (!node || typeof node !== 'object')
      return false
    if (Array.isArray(node))
      return node.some(child => hasBackground(child, color))
    const { props, children } = node as { props?: { style?: unknown }, children?: unknown }
    return StyleSheet.flatten(props?.style as never)?.backgroundColor === color || hasBackground(children, color)
  }

  it('reaches ChatHeader and ChatList', async () => {
    const { dark } = chatAppearances.soft
    const header = await render(<ChatHeader title='Anna' appearance='soft' colorScheme='dark' />)
    expect(hasBackground(header.toJSON(), dark.chatList.headerBackground)).toBe(true)
    const list = await render(<ChatList chats={[{ id: 'a', title: 'Anna' }]} appearance='soft' colorScheme='dark' />)
    expect(hasBackground(list.toJSON(), dark.chatList.background)).toBe(true)
    // The default stays plain.
    const plain = await render(<ChatHeader title='Anna' colorScheme='dark' />)
    expect(hasBackground(plain.toJSON(), dark.chatList.headerBackground)).toBe(false)
  })
})
