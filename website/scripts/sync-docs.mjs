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
// GIFs load from the release tag, not main: GitHub and npm cache images by
// URL, so a GIF re-recorded under the same main URL keeps showing the old one
const TAG = `v${JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version}`

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

// Where the site is served from: raw HTML in the pages is not run through
// Docusaurus, so links to files in static/ carry the base path themselves.
const BASE = '/react-native-chat'

/**
 * The README's GIFs weigh 5 to 8 MB each, so the site plays mp4 copies from
 * static/media instead: file name to the clip's pixel size. After re-recording
 * a GIF, encode it again:
 *
 *   ffmpeg -i media/NAME.gif -an -c:v libx264 -preset veryslow -crf 26 \
 *     -pix_fmt yuv420p -movflags +faststart website/static/media/NAME.mp4
 */
const CLIPS = {
  showcase: [360, 808],
  'features-light': [1140, 900],
  'features-dark': [1140, 900],
}

/**
 * A muted looping clip that stands where a GIF would. `sources` are clip names,
 * each optionally with the media query it is for; the last one is the default.
 */
function clip (sources, width, label, poster) {
  const [w, h] = CLIPS[sources[sources.length - 1].name]
  const attrs = [
    'autoplay muted loop playsinline',
    `width="${width}" height="${Math.round(width * h / w)}"`,
    poster ? `poster="${BASE}/media/${poster}"` : null,
    `aria-label="${label}"`,
  ].filter(Boolean).join(' ')
  const tags = sources.map(({ name, media }) =>
    `    <source${media ? ` media="${media}"` : ''} src="${BASE}/media/${name}.mp4" type="video/mp4" />`
  )
  return `<video ${attrs}>\n${tags.join('\n')}\n  </video>`
}

/** The demo clip at the top of the README, reused as the site's opening clip. */
const SHOWCASE = `<p align="center">
  ${clip([{ name: 'showcase' }], 300, 'Chat list, photo viewer, reactions, swipe-to-reply, emoji keyboard, photo attachments, a voice note, a streamed AI reply and swipe-to-archive', 'showcase.jpg')}
</p>`

/** Pages, in sidebar order. `from` is either README sections or a whole file. */
const PAGES = [
  {
    id: "intro",
    slug: "/",
    title: "React Native Chat",
    // What search results show; the page heading stays the short title.
    headTitle: "React Native Chat UI - Gifted Chat alternative, AI streaming",
    sidebarLabel: "Introduction",
    description:
      "A complete chat UI for React Native and Web with streaming AI messages, reactions and replies. The maintained successor to react-native-gifted-chat.",
    keywords: ["react native chat ui", "gifted chat alternative", "streaming ai chat react native"],
    // The README's opening lines and hero image sit above its first section,
    // so the page adds them itself.
    lead: () => `${introText()}\n\n${SHOWCASE}`,
    sections: ["✨ Features", "Quick start"],
  },
  {
    id: "whats-new",
    title: "What's new vs Gifted Chat",
    sidebarLabel: "What's new",
    description:
      "What this library adds on top of react-native-gifted-chat: a light and dark theme system, streaming AI messages, emoji reactions, voice notes and more.",
    keywords: ["gifted chat successor", "react native chat reactions"],
    sections: ["🆕 What's new vs react-native-gifted-chat"],
  },
  {
    id: "installation",
    title: "Installation",
    sidebarLabel: "Installation",
    description:
      "Requirements (React Native 0.82+, React 19, Expo SDK 55+) and install steps for Expo and bare React Native projects, plus the optional peer packages.",
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
      "A basic example of rendering the Chat component, and the structure of the message, system message and quick reply objects it expects (IMessage).",
    keywords: ["IMessage react native", "react native chat example"],
    sections: ["🚀 Usage", "📊 Data Structure"],
  },
  {
    id: "props",
    title: "Props reference",
    sidebarLabel: "Props",
    description:
      "Every prop of the Chat component by group: core configuration, keyboard and layout, composer, actions, messages, bubbles, avatars, dates, quick replies.",
    keywords: ["react native chat props"],
    sections: ["📖 Props Reference"],
  },
  {
    id: "guides",
    title: "Guides",
    sidebarLabel: "Guides",
    description:
      "Guides for React Native Chat: chat list, swipe to reply, streaming AI messages, emoji reactions, link parsing, long-press actions, theming and i18n.",
    keywords: ["react native chat guides", "react native chat ui tutorial"],
    sections: ["🧩 Guides"],
  },
  // The largest guides have pages of their own; the Guides page keeps their
  // headings, each with a link to its page.
  {
    id: "chat-list",
    title: "Chat list",
    sidebarLabel: "Chat list",
    description:
      "ChatList renders the list of chats: search, a selection bar, an Archived Chats folder, swipe to archive, draggable pinned chats and unread counters.",
    keywords: ["react native chat list", "react native conversation list"],
    guide: "Chat List",
  },
  {
    id: "reply-to-messages",
    title: "Reply to messages",
    sidebarLabel: "Reply to messages",
    description:
      "Swipe on a message to reply to it: a reply preview in the input toolbar and the replied message above the new bubble. Props, structure and examples.",
    keywords: ["react native swipe to reply", "react native chat reply"],
    guide: "Reply to Messages",
  },
  {
    id: "streaming-ai-messages",
    title: "Streaming AI messages",
    sidebarLabel: "Streaming AI messages",
    description:
      "Render AI assistant replies token by token in React Native: useStreamingMessages, a blinking caret, a Stop control and markdown rendering for replies.",
    keywords: ["streaming chat react native", "react native ai chat ui", "react native streaming markdown"],
    guide: "Streaming (AI) Messages",
  },
  {
    id: "emoji-reactions",
    title: "Emoji reactions",
    sidebarLabel: "Emoji reactions",
    description:
      "Long-press a message to open a quick emoji picker; reactions render as pills in the bubble and toggle on tap. Wiring up the toggle and the prop list.",
    keywords: ["chat reactions react native", "react native emoji reactions"],
    guide: "Emoji Reactions",
  },
  {
    id: "theming",
    title: "Theming and dark mode",
    sidebarLabel: "Theming and dark mode",
    description:
      "Theme the chat with the appearance prop and the theme and darkTheme tokens: four built-in appearances, token groups and switching at runtime.",
    keywords: ["react native chat dark mode", "react native chat theme"],
    guide: "Theming & Dark Mode",
  },
  {
    id: "platform-notes",
    title: "Platform notes",
    sidebarLabel: "Platform notes",
    description:
      "Platform notes for React Native Chat: Android keyboard configuration, running on the web with react-native-web, and use inside a React Strict DOM tree.",
    keywords: ["react native chat web"],
    sections: ["📱 Platform Notes"],
  },
  {
    id: "security",
    title: "Security",
    sidebarLabel: "Security",
    description:
      "How the chat treats message content as untrusted: links open only with safe schemes, malformed messages are left out, long text cannot freeze the list.",
    keywords: ["react native chat security"],
    sections: ["🔒 Security"],
  },
  {
    id: "performance",
    title: "Performance",
    sidebarLabel: "Performance",
    description:
      "How the chat keeps long message lists smooth: a row re-renders only when its own message changes. What to memoize and how to tune list virtualization.",
    keywords: ["react native chat performance"],
    sections: ["⚡ Performance"],
  },
  {
    id: "testing",
    title: "Testing",
    sidebarLabel: "Testing",
    description:
      "Testing a screen built with React Native Chat: the exported TEST_ID constants, and how to trigger the onLayout event that sets the chat container height.",
    keywords: ["react native chat testing"],
    sections: ["🧪 Testing"],
  },
  {
    id: "example-app",
    title: "Example app",
    sidebarLabel: "Example app",
    description:
      "Run the React Native Chat example app on iOS, Android or the web: a small messenger with a chat list built on the defaults. Or try it on Expo Snack.",
    keywords: ["react native chat example app"],
    sections: ["📦 Example App"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    sidebarLabel: "Troubleshooting",
    description:
      "Fixes for common problems: Cannot read property 'Chat' of undefined, a message list blurred on iOS 26, a TextInput hidden on Android, and short how-tos.",
    keywords: ["react native chat troubleshooting"],
    sections: ["❓ Troubleshooting"],
  },
  {
    id: "contributing",
    title: "Contributing",
    sidebarLabel: "Contributing",
    description:
      "How to contribute to React Native Chat: fork, branch and open a pull request. The commands for the development setup, the tests, linting and the build.",
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

const GUIDES = "🧩 Guides"

/**
 * Splits a section into its `###` guides, ignoring headings inside fenced code
 * blocks. Lines above the first one are kept under the `null` key.
 */
function splitGuides (section) {
  const guides = new Map([[null, []]])
  let current = guides.get(null)
  let fenced = false

  for (const line of section.lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced

    const heading = !fenced && /^### (.+?)\s*$/.exec(line)
    if (heading) {
      current = []
      guides.set(heading[1], current)
      continue
    }
    current.push(line)
  }

  return guides
}

/**
 * The opening paragraph of the landing page, in the README's own words: what
 * the library is, what it replaces, and the install command from Quick start.
 */
function introText () {
  const install = /```bash\n[\s\S]*?```/.exec(readmeSections.get('Quick start').lines.join('\n'))
  if (!install) throw new Error('README "Quick start" has no install command. Update website/scripts/sync-docs.mjs.')
  const text = [
    'React Native Chat is a chat UI for React Native and Web, with streaming AI messages, emoji reactions and swipe to reply.',
    'It is a maintained alternative to Gifted Chat: a drop-in replacement for `react-native-gifted-chat` with the same `IMessage`, the same props and a few renamed exports.',
    'Coming from it? [Migrate in one command with the codemod](./migration.md).',
  ].join(' ')
  return `${text}\n\n${install[0]}`
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

const guides = splitGuides(readmeSections.get(GUIDES))
const guidePages = new Map(PAGES.filter((page) => page.guide).map((page) => [page.guide, page]))

/** The body of a `##` section; a guide with its own page is left as a link to it. */
function sectionBody (title) {
  const section = readmeSections.get(title)
  if (!section) throw new Error(`README section not found: "${title}". Update website/scripts/sync-docs.mjs.`)
  if (title !== GUIDES) return `## ${section.title}\n${section.lines.join('\n')}`

  const parts = [...guides].map(([guide, lines]) => {
    if (guide === null) return lines.join('\n')
    const page = guidePages.get(guide)
    if (!page) return `### ${guide}\n${lines.join('\n')}`
    return `### ${guide}\n\n${page.description} Read the guide: [${page.title}](./${page.id}.md).\n`
  })
  return `## ${section.title}\n${parts.join('\n')}`
}

for (const page of PAGES) {
  if (page.guide) {
    const lines = guides.get(page.guide)
    if (!lines) throw new Error(`README guide not found: "${page.guide}". Update website/scripts/sync-docs.mjs.`)
    page.raw = `### ${page.guide}\n${lines.join('\n')}`
  } else {
    page.raw = page.sections ? page.sections.map(sectionBody).join('\n\n') : read(page.file)
  }

  // When a page is built from a single README section or guide, that heading
  // just repeats the page title, so it is dropped and its subheadings are
  // promoted. Links that pointed at it become links to the page.
  page.droppedHeading = page.guide
    ? key(page.guide)
    : page.sections?.length === 1 ? key(page.sections[0]) : null

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
 * Adds the height to the README's screenshots, which only state a width, so
 * the page does not jump while they load. The size is read from the PNG file.
 */
function sizeScreenshots (markdown) {
  return markdown.replace(/<img width="(\d+)" src="([^"]*\/media\/([\w-]+\.png))"/g, (match, width, src, file) => {
    const png = readFileSync(join(ROOT, 'media', file))
    const height = Math.round(width * png.readUInt32BE(20) / png.readUInt32BE(16))
    return `<img width="${width}" height="${height}" src="${src}"`
  })
}

/**
 * The README shows the feature showcase as a GIF between `chat-showcase`
 * comments. On the site that block becomes a `.chat-showcase` slot: the live
 * scene (src/components/ChatShowcase) mounts into it and hides the GIF, which
 * stays inside as the fallback before scripts run. The block is kept free of
 * blank lines so CommonMark reads it as one HTML block.
 */
/**
 * Swaps the README's GIFs for the mp4 clips in static/media. A light/dark
 * `<picture>` pair becomes one clip with a source per color scheme.
 */
function gifsToClips (markdown) {
  const gif = String.raw`[^"]*/media/([\w-]+)\.gif`
  const pair = new RegExp(
    String.raw`<picture>\s*<source media="([^"]+)" srcset="${gif}" />\s*<img width="(\d+)" src="${gif}" alt="([^"]*)" />\s*</picture>`,
    'g'
  )
  const single = new RegExp(String.raw`<img width="(\d+)" src="${gif}" alt="([^"]*)" />`, 'g')

  return markdown
    .replace(pair, (match, media, themed, width, fallback, alt) =>
      CLIPS[themed] && CLIPS[fallback] ? clip([{ name: themed, media }, { name: fallback }], Number(width), alt) : match
    )
    .replace(single, (match, width, name, alt) =>
      CLIPS[name] ? clip([{ name }], Number(width), alt) : match
    )
}

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
  // Read by src/theme/DocItem/Metadata, which puts it in the page's <title>.
  if (page.headTitle) fields.push(`head_title: ${JSON.stringify(page.headTitle)}`)
  if (page.keywords?.length) fields.push(`keywords: [${page.keywords.map((k) => JSON.stringify(k)).join(', ')}]`)
  return `---\n${fields.join('\n')}\n---\n`
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

PAGES.forEach((page, index) => {
  let body = stripTableOfContents(page.raw)
  // Standalone files lead with an `# H1` that the frontmatter title replaces.
  body = body.replace(/^#\s+.+?\n/, '')

  // Same for a single README section or guide: its heading is the page title.
  let depth = 0
  if (page.droppedHeading) {
    body = body.replace(/^###?\s+.+?\n/, '')
    depth = page.guide ? 2 : 1
  }
  // A guide that is one collapsed block in the README opens on its own page.
  if (page.guide) body = body.replace(/^\s*<details>/, '<details open>')

  body = normaliseHeadings(body, depth)
  body = rewriteLinks(body, page.id)
  body = gifsToClips(body)
  body = sizeScreenshots(body)
  body = liveShowcase(body)
  if (page.lead) body = `${page.lead()}\n\n${body.trim()}`

  const source = page.file ?? 'README.md'
  const note = `<!-- Generated from ${source} by website/scripts/sync-docs.mjs - edit that file, not this one. -->\n`

  writeFileSync(join(OUT, `${page.id}.md`), `${frontmatter(page, index)}\n${note}\n${body.trim()}\n`)
})

console.log(`Generated ${PAGES.length} pages into website/docs from README.md`)
