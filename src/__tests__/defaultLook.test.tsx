import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { Bubble, defaultDarkTheme, defaultLightTheme, mergeTheme, utils } from '..'
import { HIDDEN_TEXT_COLOR } from '../Bubble/styles'
import { useOutgoingStep } from '../components/ChatWallpaper'
import { encodePng, gatherPositions, generateWallpaperPixels, getWallpaperUri } from '../components/wallpaperGradient'
import { IMessage } from '../Models'
import { getNameColor, getUserColorIndex } from '../Theme'
import { formatMessageTime } from '../Time'

const ME = { _id: 1, name: 'Me' }
const THEM = { _id: 2, name: 'Them' }
const T0 = new Date(2026, 9, 25, 14, 0).getTime()

const message = (overrides: Partial<IMessage>): IMessage => ({
  _id: Math.random().toString(36).slice(2),
  text: 'hello',
  user: THEM,
  createdAt: T0,
  ...overrides,
})

// The reserved copy of the time is the hidden text inside the message text.
const findTimeSpacer = (json: ReturnType<Awaited<ReturnType<typeof render>>['toJSON']>): string | null => {
  let found: string | null = null
  const visit = (node: any) => {
    if (!node || found !== null)
      return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node.type === 'Text' && StyleSheet.flatten(node.props.style)?.color === HIDDEN_TEXT_COLOR) {
      found = (node.children ?? []).join('')
      return
    }
    visit(node.children)
  }
  visit(json)
  return found
}

describe('run grouping (isSameGroup)', () => {
  it('groups the same sender within five minutes', () => {
    expect(utils.isSameGroup(message({}), message({ createdAt: T0 + 5 * 60 * 1000 }))).toBe(true)
  })

  it('breaks a run after five minutes', () => {
    expect(utils.isSameGroup(message({}), message({ createdAt: T0 + 5 * 60 * 1000 + 1 }))).toBe(false)
  })

  it('breaks a run on another sender, a system message or a missing neighbour', () => {
    expect(utils.isSameGroup(message({}), message({ user: ME }))).toBe(false)
    expect(utils.isSameGroup(message({}), message({ system: true }))).toBe(false)
    expect(utils.isSameGroup(message({}), undefined)).toBe(false)
    expect(utils.isSameGroup(message({}), {} as IMessage)).toBe(false)
  })

  it('breaks a run across midnight even within five minutes', () => {
    const late = new Date(2026, 9, 25, 23, 59).getTime()
    expect(utils.isSameGroup(message({ createdAt: late }), message({ createdAt: late + 2 * 60 * 1000 }))).toBe(false)
  })
})

describe('bubble shape', () => {
  const wrapperStyle = (json: any) => StyleSheet.flatten(json.children[0].props.style)

  it('rounds a lone bubble 17 with no corner at the tail', async () => {
    const { toJSON } = await render(
      <Bubble user={ME} position='right' currentMessage={message({ user: ME })} />
    )
    expect(wrapperStyle(toJSON())).toMatchObject({
      borderTopLeftRadius: 17,
      borderBottomLeftRadius: 17,
      borderTopRightRadius: 17,
      borderBottomRightRadius: 0,
    })
  })

  it('drops to 6 on the tail side inside a run, without a tail', async () => {
    const current = message({ user: ME, createdAt: T0 + 1000 })
    const { toJSON } = await render(
      <Bubble
        user={ME}
        position='right'
        currentMessage={current}
        previousMessage={message({ user: ME })}
        nextMessage={message({ user: ME, createdAt: T0 + 2000 })}
      />
    )
    expect(wrapperStyle(toJSON())).toMatchObject({
      borderTopRightRadius: 6,
      borderBottomRightRadius: 6,
      borderTopLeftRadius: 17,
    })
  })
})

describe('inline time', () => {
  it('reserves the time and the checks at the end of the last line', async () => {
    const { toJSON } = await render(
      <Bubble user={ME} position='right' currentMessage={message({ user: ME, sent: true })} />
    )
    const spacer = findTimeSpacer(toJSON())
    // A break opportunity, the gap and the checks as no-break spaces, then the time itself.
    expect(spacer).toMatch(/^​ {9}\d{1,2}:\d{2}/)
  })

  it('reserves only the gap when there are no checks', async () => {
    const { toJSON } = await render(
      <Bubble user={ME} position='left' currentMessage={message({})} />
    )
    expect(findTimeSpacer(toJSON())).toMatch(/^​ {2}\d/)
  })

  it('moves the time to its own line when the text runs the other way', async () => {
    const { toJSON } = await render(
      <Bubble user={ME} position='left' currentMessage={message({ text: 'مرحبا بالعالم' })} />
    )
    expect(findTimeSpacer(toJSON())).toMatch(/^\n/)
  })

  it('puts the time on the last row of reaction pills instead', async () => {
    const { toJSON, getByLabelText } = await render(
      <Bubble
        user={ME}
        position='left'
        currentMessage={message({ reactions: [{ emoji: '👍', userIds: [1, 2] }] })}
      />
    )
    expect(getByLabelText('👍 2')).toBeTruthy()
    // No break before it: the pill row wraps it as a whole.
    expect(findTimeSpacer(toJSON())).toMatch(/^ {2}\d/)
  })

  it('keeps the reserved time out of the wrapping row of pills', async () => {
    const { toJSON } = await render(
      <Bubble
        user={ME}
        position='right'
        currentMessage={message({ user: ME, text: 'Hi', reactions: [{ emoji: '🔥', userIds: [1] }] })}
      />
    )
    // Inside the wrapping row, the time wrapped onto a row of its own whenever the pills set
    // the bubble's width, after the bubble had been sized: the text slid out above it.
    const wrapsHoldingSpacer: unknown[] = []
    const visit = (node: any, wrapAncestors: number) => {
      if (!node)
        return
      if (Array.isArray(node)) {
        node.forEach(child => visit(child, wrapAncestors))
        return
      }
      const style = StyleSheet.flatten(node.props?.style) ?? {}
      const depth = wrapAncestors + (style.flexWrap === 'wrap' ? 1 : 0)
      if (node.type === 'Text' && style.color === HIDDEN_TEXT_COLOR && depth > 0)
        wrapsHoldingSpacer.push(node)
      visit(node.children, depth)
    }
    visit(toJSON(), 0)
    expect(findTimeSpacer(toJSON())).toMatch(/\d/)
    expect(wrapsHoldingSpacer).toHaveLength(0)
  })

  it('gives a custom time a row of its own', async () => {
    const { toJSON } = await render(
      <Bubble user={ME} position='left' currentMessage={message({})} renderTime={() => null} />
    )
    expect(findTimeSpacer(toJSON())).toBeNull()
  })

  it('prefixes an edited message with the edited label', () => {
    expect(formatMessageTime(message({ isEdited: true }), 'en', 'HH:mm', 'edited')).toBe('edited 14:00')
    expect(formatMessageTime(message({ editedAt: T0 }), 'en', 'HH:mm', 'edited')).toBe('edited 14:00')
    expect(formatMessageTime(message({}), 'en', 'HH:mm', 'edited')).toBe('14:00')
  })
})

describe('status', () => {
  it.each([
    [{ pending: true }, 'pending'],
    [{ sent: true }, 'sent'],
    [{ sent: true, received: true }, 'read'],
    [{ sent: true, isFailed: true }, 'failed'],
  ])('draws %p as %s', async (flags, status) => {
    const { getByTestId } = await render(
      <Bubble user={ME} position='right' currentMessage={message({ user: ME, ...flags })} />
    )
    expect(getByTestId(`message-status-${status}`, { includeHiddenElements: true })).toBeTruthy()
  })
})

describe('theme', () => {
  it('ships the default day and night colors', () => {
    expect(defaultLightTheme.colors.outgoingBubble).toBe('#EFFFDE')
    expect(defaultLightTheme.bubble.outgoingGradient).toBeNull()
    expect(defaultDarkTheme.bubble.outgoingGradient).toEqual(['#9F3EAA', '#8146D7', '#4272DF', '#258DE5'])
    expect(defaultLightTheme.radii.bubble).toBe(17)
  })

  it('keeps an app-chosen outgoing color solid, and its sender color plain', () => {
    const theme = mergeTheme(defaultDarkTheme, { colors: { outgoingBubble: '#123456', senderName: '#ABCDEF' } })
    expect(theme.bubble.outgoingGradient).toBeNull()
    expect(getNameColor(theme, 5)).toBe('#ABCDEF')
  })

  it('picks per-user name colors by id', () => {
    expect(getUserColorIndex(7, 7)).toBe(0)
    expect(getUserColorIndex(-3, 7)).toBe(3)
    expect(getUserColorIndex('abc', 7)).toBe(getUserColorIndex('abc', 7))
    expect(getNameColor(defaultLightTheme, 1)).toBe('#D67722')
  })
})

describe('wallpaper', () => {
  it('places color i at spot (phase + 2i) mod 8 with y flipped', () => {
    expect(gatherPositions(0)[0]).toEqual([0.8, 0.9])
    expect(gatherPositions(7)[1]).toEqual([0.6, 0.8])
  })

  it('stays inside the colors it blends', () => {
    const pixels = generateWallpaperPixels(['#FF0000', '#00FF00', '#0000FF', '#FFFFFF'], 0, 1, 6, 8)
    expect(pixels.length).toBe(6 * 8 * 3)
    expect(Math.max(...pixels)).toBeLessThanOrEqual(255)
  })

  it('encodes a valid PNG and caches the data URI', () => {
    const png = encodePng(new Uint8Array(2 * 2 * 3), 2, 2)
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const uri = getWallpaperUri(defaultLightTheme.wallpaper.colors, 3)
    expect(uri.startsWith('data:image/png;base64,iVBORw0KGgo')).toBe(true)
    expect(getWallpaperUri(defaultLightTheme.wallpaper.colors, 11)).toBe(uri)
  })

  it('steps once per new outgoing message', async () => {
    let step = -1
    const Probe = ({ messages }: { messages: IMessage[] }) => {
      step = useOutgoingStep(messages, ME._id, true)
      return null
    }
    const first = [message({})]
    const { rerender } = await render(<Probe messages={first} />)
    expect(step).toBe(0)
    await rerender(<Probe messages={[message({ user: THEM }), ...first]} />)
    expect(step).toBe(0)
    await rerender(<Probe messages={[message({ user: ME }), ...first]} />)
    expect(step).toBe(1)
  })
})
