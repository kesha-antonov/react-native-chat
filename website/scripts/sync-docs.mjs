// Generates the Docusaurus docs from the markdown that already lives in the
// repository root, so README.md stays the single
// source of truth and the site can never drift away from them.
//
// Run via `yarn sync` (also runs automatically before `start` and `build`).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'docs')

const REPO = 'https://github.com/kesha-antonov/react-native-chat'
const BRANCH = 'main'

/**
 * Canonical key for a heading or a link anchor.
 *
 * GitHub and Docusaurus slugify headings slightly differently (emoji and
 * variation selectors are the painful part), so instead of reimplementing
 * either algorithm we reduce both sides to letters and digits only. That is
 * stable enough to match `#-features` against `## ✨ Features`, and we then
 * emit explicit `{#key}` anchors so the generated site uses these keys too.
 */
const key = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The demo clip at the top of the README, reused as the site's opening image. */
const SHOWCASE = `<p align="center">
  <img width="300" src="https://raw.githubusercontent.com/kesha-antonov/react-native-chat/${BRANCH}/media/showcase.gif" alt="Chat list, photo viewer, reactions, swipe-to-reply, emoji keyboard, photo attachments, a voice note, a streamed AI reply and swipe-to-archive" />
</p>`

/** Pages, in sidebar order. `from` is either README sections or a whole file. */
const PAGES = [
  {
    id: "intro",
    slug: "/",
    title: "React Native Chat",
    sidebarLabel: "Introduction",
    description:
      "A complete chat UI for React Native and Web with streaming AI messages, reactions and replies. The maintained successor to react-native-gifted-chat.",
    keywords: ["react native chat ui", "gifted chat alternative", "streaming ai chat react native"],
    // The README's hero image sits above its first section, so the page adds it itself.
    lead: SHOWCASE,
    sections: ["✨ Features", "Quick start"],
  },
  {
    id: "whats-new",
    title: "What's new vs Gifted Chat",
    sidebarLabel: "What's new",
    description:
      "Everything this library adds on top of react-native-gifted-chat.",
    keywords: ["gifted chat successor", "react native chat reactions"],
    sections: ["🆕 What's new vs react-native-gifted-chat"],
  },
  {
    id: "installation",
    title: "Installation",
    sidebarLabel: "Installation",
    description:
      "Requirements and install steps, including the peer dependencies.",
    keywords: ["react-native-chat install"],
    sections: ["📋 Requirements", "📦 Installation"],
  },
  {
    id: "migration",
    title: "Migrating from Gifted Chat",
    sidebarLabel: "Migration",
    description:
      "A drop-in replacement: the same IMessage, the same props, a few renamed exports, and a codemod that does it in one command.",
    keywords: ["migrate gifted chat", "gifted chat codemod"],
    sections: ["🔄 Migrating from react-native-gifted-chat"],
  },
  {
    id: "usage",
    title: "Usage and data structure",
    sidebarLabel: "Usage",
    description:
      "Render the chat, and the shape of the message objects it expects.",
    keywords: ["IMessage react native", "react native chat example"],
    sections: ["🚀 Usage", "📊 Data Structure"],
  },
  {
    id: "props",
    title: "Props reference",
    sidebarLabel: "Props",
    description:
      "Every prop on the Chat component.",
    keywords: ["react native chat props"],
    sections: ["📖 Props Reference"],
  },
  {
    id: "guides",
    title: "Guides",
    sidebarLabel: "Guides",
    description:
      "Streaming AI replies, reactions, replies, custom bubbles and more.",
    keywords: ["streaming chat react native", "chat reactions react native"],
    sections: ["🧩 Guides"],
  },
  {
    id: "platform-notes",
    title: "Platform notes",
    sidebarLabel: "Platform notes",
    description:
      "iOS, Android and Web differences worth knowing.",
    keywords: ["react native chat web"],
    sections: ["📱 Platform Notes"],
  },
  {
    id: "performance",
    title: "Performance",
    sidebarLabel: "Performance",
    description:
      "Keeping long message lists smooth.",
    keywords: ["react native chat performance"],
    sections: ["⚡ Performance"],
  },
  {
    id: "testing",
    title: "Testing",
    sidebarLabel: "Testing",
    description:
      "Testing a chat UI.",
    keywords: ["react native chat testing"],
    sections: ["🧪 Testing"],
  },
  {
    id: "example-app",
    title: "Example app",
    sidebarLabel: "Example app",
    description:
      "Run the example app, or try it in the browser on Expo Snack.",
    keywords: ["react native chat example app"],
    sections: ["📦 Example App"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    sidebarLabel: "Troubleshooting",
    description:
      "Common problems and their fixes.",
    keywords: ["react native chat troubleshooting"],
    sections: ["❓ Troubleshooting"],
  },
  {
    id: "contributing",
    title: "Contributing",
    sidebarLabel: "Contributing",
    description:
      "How to propose a change.",
    keywords: ["contributing"],
    sections: ["🤝 Contributing"],
  },
]

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')

/**
 * Splits a markdown document into top-level (`##`) sections, ignoring headings
 * that appear inside fenced code blocks.
 */
function splitSections (markdown) {
  const lines = markdown.split('\n')
  const sections = new Map()
  let current = null
  let fenced = false

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced

    const heading = !fenced && /^## (.+?)\s*$/.exec(line)
    if (heading) {
      current = { title: heading[1], lines: [] }
      sections.set(current.title, current)
      continue
    }
    if (current) current.lines.push(line)
  }

  return sections
}

/** Collects every heading in a chunk of markdown, outside of code fences. */
function headingsIn (markdown) {
  const found = []
  let fenced = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const m = !fenced && /^(#{1,6}) (.+?)\s*$/.exec(line)
    if (m) found.push(m[2])
  }
  return found
}

/** Drops a "## Table of Contents" section - Docusaurus renders its own. */
function stripTableOfContents (markdown) {
  return markdown.replace(/^##+ Table of Contents\s*$[\s\S]*?(?=^##? )/m, '')
}

/**
 * Promotes headings by one level and gives each an explicit `{#key}` anchor so
 * that generated links resolve to a slug we control rather than one inferred
 * from emoji.
 */
function normaliseHeadings (markdown, depth) {
  let fenced = false
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced
        return line
      }
      if (fenced) return line

      const m = /^(#{1,6}) (.+?)\s*$/.exec(line)
      if (!m) return line
      if (/\{#[^}]+\}\s*$/.test(m[2])) return line

      const level = Math.max(2, m[1].length - depth)
      return `${'#'.repeat(level)} ${m[2]} {#${key(m[2])}}`
    })
    .join('\n')
}

// Build the anchor -> page map before rendering, so cross-page links resolve.
const readme = read('README.md')
const readmeSections = splitSections(readme)
const anchorToPage = new Map()

for (const page of PAGES) {
  const bodies = page.sections
    ? page.sections.map((title) => {
        const section = readmeSections.get(title)
        if (!section) throw new Error(`README section not found: "${title}". Update website/scripts/sync-docs.mjs.`)
        return `## ${section.title}\n${section.lines.join('\n')}`
      })
    : [read(page.file)]

  page.raw = bodies.join('\n\n')

  // When a page is built from a single README section, that section's own
  // heading just repeats the page title, so it is dropped and its subheadings
  // are promoted one level. Links that pointed at it become links to the page.
  page.droppedHeading = page.sections?.length === 1 ? key(page.sections[0]) : null

  for (const heading of headingsIn(page.raw)) {
    if (!anchorToPage.has(key(heading))) anchorToPage.set(key(heading), page.id)
  }
}

/** Anchors that no longer exist because their heading became the page title. */
const droppedAnchors = new Map(
  PAGES.filter((page) => page.droppedHeading).map((page) => [page.droppedHeading, page.id])
)

/**
 * Resolves a canonical anchor key to a markdown link, or null if it is unknown.
 * Anchors whose heading was dropped resolve to the page itself.
 */
function linkTo (k, pageId) {
  const droppedOn = droppedAnchors.get(k)
  if (droppedOn) return `](./${droppedOn}.md)`

  const target = anchorToPage.get(k)
  if (!target) return null
  return target === pageId ? `](#${k})` : `](./${target}.md#${k})`
}

/** Rewrites README/GitHub-relative links to links between generated pages. */
function rewriteLinks (markdown, pageId) {
  const fileRoutes = []

  let out = markdown

  for (const [pattern, target] of fileRoutes) {
    out = out.replace(pattern, (_match, hash) => {
      const anchor = hash ? `#${key(hash.slice(1))}` : ''
      return `](./${target}.md${anchor})`
    })
  }

  // Links back into README.md from the standalone docs files.
  out = out.replace(/\]\(\.\.?\/?README\.md(#[^)]*)?\)/g, (_match, hash) => {
    if (!hash) return '](./intro.md)'
    return linkTo(key(hash.slice(1)), pageId) ?? '](./intro.md)'
  })

  // Plain in-page anchors, which may now live on a different page.
  out = out.replace(/\]\(#([^)]+)\)/g, (match, anchor) => linkTo(key(anchor), pageId) ?? match)

  // Repository files and folders that have no page of their own: point them at
  // GitHub instead of letting them resolve to a 404 inside the docs site.
  out = out.replace(/\]\(\.?\/?(LICENSE|CHANGELOG\.md|llms\.txt|[A-Z][A-Z_]+(?:\.[a-z]+)?)\)/g, `](${REPO}/blob/${BRANCH}/$1)`)
  out = out.replace(/\]\(\.?\/?(examples?|src|scripts|docs|__tests__)\/?\)/g, `](${REPO}/tree/${BRANCH}/$1)`)
  out = out.replace(/\]\(\.?\/?((?:examples?|src|scripts|docs|__tests__)\/[^)\s]+)\)/g, `](${REPO}/blob/${BRANCH}/$1)`)

  // Root-level markdown with no page of its own (AGENTS.md, MIGRATION.md, ...).
  // Links the generator itself produced point at a page id and are left alone.
  out = out.replace(/\]\(\.?\/?([A-Za-z0-9_.-]+\.md)(#[^)]*)?\)/g, (match, file) => {
    const id = file.replace(/\.md$/, '')
    if (PAGES.some((page) => page.id === id)) return match
    return `](${REPO}/blob/${BRANCH}/${file})`
  })

  return out
}

/**
 * The README shows the feature showcase as a GIF between `chat-showcase`
 * comments. On the site that block becomes a `.chat-showcase` slot: the live
 * scene (src/components/ChatShowcase) mounts into it and hides the GIF, which
 * stays inside as the fallback before scripts run. The block is kept free of
 * blank lines so CommonMark reads it as one HTML block.
 */
function liveShowcase (markdown) {
  return markdown.replace(
    /<!-- chat-showcase:start -->\n([\s\S]*?)\n<!-- chat-showcase:end -->/g,
    (_match, inner) => `<div class="chat-showcase">\n${inner.replace(/\n\s*\n/g, '\n')}\n</div>`
  )
}

function frontmatter (page, index) {
  const fields = [
    `title: ${JSON.stringify(page.title)}`,
    `sidebar_label: ${JSON.stringify(page.sidebarLabel)}`,
    `sidebar_position: ${index + 1}`,
    `description: ${JSON.stringify(page.description)}`,
  ]
  if (page.slug) fields.push(`slug: ${JSON.stringify(page.slug)}`)
  if (page.keywords?.length) fields.push(`keywords: [${page.keywords.map((k) => JSON.stringify(k)).join(', ')}]`)
  return `---\n${fields.join('\n')}\n---\n`
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

PAGES.forEach((page, index) => {
  let body = stripTableOfContents(page.raw)
  // Standalone files lead with an `# H1` that the frontmatter title replaces.
  body = body.replace(/^#\s+.+?\n/, '')

  // Same for a single README section: its `##` heading is the page title.
  let depth = 0
  if (page.droppedHeading) {
    body = body.replace(/^##\s+.+?\n/, '')
    depth = 1
  }

  body = normaliseHeadings(body, depth)
  body = rewriteLinks(body, page.id)
  body = liveShowcase(body)
  if (page.lead) body = `${page.lead}\n\n${body.trim()}`

  const source = page.file ?? 'README.md'
  const note = `<!-- Generated from ${source} by website/scripts/sync-docs.mjs - edit that file, not this one. -->\n`

  writeFileSync(join(OUT, `${page.id}.md`), `${frontmatter(page, index)}\n${note}\n${body.trim()}\n`)
})

console.log(`Generated ${PAGES.length} pages into website/docs from README.md`)
