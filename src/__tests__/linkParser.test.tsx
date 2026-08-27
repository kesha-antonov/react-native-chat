import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'

import { LinkParser, LinkMatcher } from '../linkParser'

// Reads the rendered tree back as the list of link labels the user can press.
function pressableTexts (json: any): string[] {
  const found: string[] = []

  const walk = (node: any) => {
    if (!node || typeof node !== 'object')
      return

    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }

    if (node.props?.onPress && typeof node.children?.[0] === 'string')
      found.push(node.children[0])
    else
      walk(node.children)

  }

  walk(json)
  return found
}

async function links (text: string, props: Record<string, unknown> = {}): Promise<string[]> {
  const { toJSON } = await render(
    <LinkParser text={text} stripPrefix={false} TextComponent={Text} {...props} />
  )
  return pressableTexts(toJSON())
}

describe('LinkParser patterns', () => {
  // The default matchers used to rely on lookbehind assertions, which
  // JavaScriptCore on iOS/Safari < 16.4 refuses to parse - the SyntaxError
  // fired while loading the module and took the whole app down before <Chat />
  // ever rendered. See issue #19.
  it('does not use lookbehind assertions', () => {
    const source: string = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'linkParser.tsx'),
      'utf8'
    )
    // Block comments are dropped so the ones explaining the fix don't count.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '')

    expect(code).not.toMatch(/\(\?<[=!]/)
  })

  it('links urls with and without a scheme', async () => {
    expect(await links('Check https://example.com now')).toEqual(['https://example.com'])
    expect(await links('visit www.example.com please')).toEqual(['www.example.com'])
    expect(await links(' www.foo.com')).toEqual(['www.foo.com'])
    expect(await links('go to example.com')).toEqual(['example.com'])
    // A bare multi-label domain still stops at the second dot, as it always
    // has - the crash fix deliberately left matching behaviour untouched.
    expect(await links('sub.domain.co.uk/path')).toEqual(['sub.domain'])
  })

  it('links emails without also linking their domain', async () => {
    expect(await links('mail me at john.doe@example.com ok')).toEqual(['john.doe@example.com'])
    expect(await links('foo@bar.co and baz@qux.io')).toEqual(['foo@bar.co', 'baz@qux.io'])
  })

  it('does not link a domain glued to a word or an email', async () => {
    expect(await links('@example.com')).toEqual([])
    expect(await links('xhttp://a.com')).toEqual(['http://a.com'])
  })

  it('links phone numbers but not version strings', async () => {
    expect(await links('call +1 (555) 123-4567 now')).toEqual(['+1 (555) 123-4567'])
    // Long-standing quirk, kept as-is: a dotted version reads as a number.
    expect(await links('Version 1.2.3 released', { phone: true, url: false })).toEqual(['1.2.3'])
    expect(await links('abc123 and 12ab')).toEqual([])
  })

  it('links hashtags and mentions when enabled', async () => {
    expect(await links('#hashtag and #another_one', { hashtag: true })).toEqual([
      '#hashtag',
      '#another_one',
    ])
    expect(await links('@mention and @user-name', { mention: true })).toEqual([
      '@mention',
      '@user-name',
    ])
    // A mention glued to a word - or the local part of an email - is not one.
    expect(await links('write me@ex.com', { mention: true })).toEqual(['me@ex.com'])
  })

  it('honours notPrecededBy on custom matchers', async () => {
    const matcher: LinkMatcher = {
      type: 'url',
      pattern: /cat/g,
      notPrecededBy: /[a-z]/,
      getLinkUrl: (text: string) => `https://example.com/${text}`,
    }

    expect(await links('cat bobcat cat', { matchers: [matcher] })).toEqual(['cat', 'cat'])
  })

  it('rescans from the next character when a match is rejected', async () => {
    // "abc" is rejected at index 1, yet "bc" still matches at index 2 - what a
    // real /(?<!x)a?bc/ produces. Merely skipping the rejected match would
    // resume past it and find nothing.
    const matcher: LinkMatcher = {
      type: 'url',
      pattern: /a?bc/g,
      notPrecededBy: /x/,
      getLinkUrl: (text: string) => text,
    }

    expect(await links('xabc', { matchers: [matcher] })).toEqual(['bc'])
    expect([...'xabc'.matchAll(/(?<!x)a?bc/g)].map(m => m[0])).toEqual(['bc'])
  })

  it('does not leak regex state between renders', async () => {
    const text = 'a.com and b.com'
    expect(await links(text)).toEqual(['a.com', 'b.com'])
    expect(await links(text)).toEqual(['a.com', 'b.com'])
    expect(await links(text)).toEqual(['a.com', 'b.com'])
  })
})
