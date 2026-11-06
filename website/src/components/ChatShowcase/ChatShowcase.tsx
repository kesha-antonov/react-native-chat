import {
  ArrowUp, AudioLines, Camera, CheckCheck, ChevronLeft, ChevronUp, File, Image, Lock, MapPin, Mic, MoonStar,
  Paperclip, Play, Radio, Reply, SmilePlus, Smile, Video, X,
} from 'lucide-react'
import { Stage } from './kit/stage'
import type { Act } from './kit/act'
import { Bubble, Stamp, Thread } from './kit/messages'
import { Phone } from './kit/phone'
import { Collapse } from './kit/motion/Collapse'
import { Stream } from './kit/motion/Stream'
import './styles.css'

// How @kesha-antonov/react-native-chat works, told on one conversation with an
// assistant, in the library's own default look (the day theme's green
// wallpaper, white and pale green bubbles, the time and ticks inside them,
// the pill composer with the round mic). A list beside the phone names each
// feature as it happens and says why it matters:
//   1. Reactions: a long press opens the picker, a heart lands on the bubble.
//   2. Swipe to reply: the answer is swiped, its quote opens over the composer.
//   3. Message status: the reply is typed and sent; clock, one tick, two.
//   4. Streaming: the assistant types, then its answer streams in word by word.
//   5. Voice notes: the mic is held, the take timed, a waveform bubble sent.
//   6. Video notes: a tap switches the mic to the camera, a hold records a
//      round note in a circle over the chat, which lands in the thread.
//   7. Attachments: the clip opens the gallery sheet, a photo is picked and
//      sent from the caption bar.
//   8. Themes: the same chat turns to the night theme.
// The payoff holds, then what the story added leaves in one reverse stagger
// as the day theme comes back, and the loop starts on the opening frame.
//
// Real strings: the five feature names and their lines, the conversation.

type Tick = 'clock' | 'sent' | 'read'
type S = {
  step: number
  pressed: boolean
  picker: boolean
  reacted: boolean
  dx: number
  replying: boolean
  draft: string
  sent: boolean
  tick: Tick
  ai: 'none' | 'typing' | 'stream'
  words: number
  preview: boolean
  rec: 'none' | 'voice' | 'round'
  recSec: number
  video: boolean
  voice: boolean
  round: boolean
  sheet: boolean
  picked: boolean
  photo: boolean
  lastTick: Tick
  dark: boolean
  leave: number
}

const initial: S = {
  step: 0,
  pressed: false,
  picker: false,
  reacted: false,
  dx: 0,
  replying: false,
  draft: '',
  sent: false,
  tick: 'clock',
  ai: 'none',
  words: 0,
  preview: false,
  rec: 'none',
  recSec: 0,
  video: false,
  voice: false,
  round: false,
  sheet: false,
  picked: false,
  photo: false,
  lastTick: 'read',
  dark: false,
  leave: 0,
}

const ANSWER = 'Start in Alfama with coffee at a miradouro, lunch at Time Out Market, then sunset from Senhora do Monte.'
const MINE = 'Add something for the evening'
const STREAMED = 'Book a fado dinner in Alfama. Tables fill up by 8, so reserve one today:'
const LINK = 'visitlisboa.com/fado'
const STREAMED_WORDS = STREAMED.split(' ').length

const poster: S = {
  ...initial,
  step: 9,
  reacted: true,
  sent: true,
  tick: 'read',
  ai: 'stream',
  words: STREAMED_WORDS,
  preview: true,
  video: true,
  voice: true,
  round: true,
  photo: true,
}

const FEATURES = [
  { icon: SmilePlus, title: 'Reactions', line: 'Long-press picker, pills on the bubble' },
  { icon: Reply, title: 'Swipe to reply', line: 'The quote opens over the composer' },
  { icon: CheckCheck, title: 'Message status', line: 'Pending, sent and read, in the bubble' },
  { icon: Radio, title: 'Streaming replies', line: 'Token by token, built for AI chats' },
  { icon: AudioLines, title: 'Voice notes', line: 'Hold to record, let go to send' },
  { icon: Video, title: 'Round video notes', line: 'Tap to switch the mic, hold to film' },
  { icon: Paperclip, title: 'Attachments', line: 'Gallery, files and location in one sheet' },
  { icon: MoonStar, title: 'Light and dark themes', line: 'One set of tokens, switched at runtime' },
]
const LAST = FEATURES.length

// What the loop has no beat for, named under the list. The ones the
// conversation does show light up while they are on screen
type Extra = { title: string; on?: (s: S) => boolean; seen?: (s: S) => boolean }
const EXTRAS: Extra[] = [
  { title: 'Quick replies', seen: () => true },
  { title: 'Typing indicator', on: (s) => s.ai === 'typing', seen: (s) => s.ai === 'stream' },
  { title: 'Link previews', on: (s) => s.preview && s.step === 4, seen: (s) => s.preview },
  { title: 'Emoji keyboard' },
  { title: 'Chat list' },
  { title: 'Photo viewer' },
  { title: 'Long-press menu' },
  { title: 'Multi-select' },
  { title: 'Location' },
  { title: 'Big emoji', seen: () => true },
  { title: 'Unread bar' },
  { title: 'Smart links' },
  { title: '16 languages' },
  { title: 'Expo and Web' },
]

// A voice take's bars, fixed so every loop draws the same waveform
const BARS = [4, 7, 12, 9, 15, 19, 13, 8, 11, 17, 20, 14, 9, 6, 10, 16, 18, 12, 7, 5, 9, 14, 17, 11, 8, 12, 15, 9, 6, 4, 6, 3]

const GALLERY: Art[] = ['tram', 'sea', 'tiles', 'sunset', 'lemon', 'night', 'facade', 'coffee', 'sea', 'tiles', 'lemon']

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👎']

async function script(a: Act<S>) {
  await a.wait(900)

  // 1. Long-press the answer, pick a heart
  a.mark('react')
  a.put({ step: 1 })
  await a.move({ at: 'answer', x: 0.62, y: 0.45 })
  const hold = a.drag({ at: 'answer', x: 0.62, y: 0.45 }, undefined, { duration: 520 })
  a.put({ pressed: true })
  await a.wait(320)
  a.put({ picker: true })
  await hold
  await a.wait(380)
  await a.click({ at: 'react-heart', x: 0.5, y: 0.62 })
  await a.set({ picker: false, pressed: false, reacted: true })
  await a.wait(1100)

  // 2. Swipe the same answer to reply
  a.mark('swipe')
  a.put({ step: 2 })
  const msg = a.rect('answer')
  const y = msg.y + msg.height * 0.3
  const from = msg.x + msg.width * 0.8
  await a.move({ x: from, y })
  await a.wait(150)
  await a.drag(
    { x: from - 96, y },
    (at) => a.put({ dx: Math.min(0, at.x - from) }),
    { duration: 380, path: (t, p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y }) },
  )
  await a.set({ dx: 0, replying: true })
  await a.wait(700)

  // 3. Type the reply and send it: clock, one tick, two
  a.mark('send')
  a.put({ step: 3 })
  await a.type('draft', MINE, { interval: 52 })
  await a.wait(250)
  await a.click({ at: 'send', x: 0.5, y: 0.5 })
  await a.set({ sent: true, draft: '', replying: false })
  await a.wait(700)
  await a.set({ tick: 'sent' })
  await a.wait(650)
  await a.set({ tick: 'read' })
  await a.wait(500)

  // 4. The assistant types, then streams its answer
  a.mark('stream')
  a.put({ step: 4, ai: 'typing' })
  await a.wait(1300)
  a.put({ ai: 'stream' })
  await a.wait(260)
  for (let i = 1; i <= STREAMED_WORDS; i++) {
    a.put({ words: i })
    await a.wait(70)
  }
  await a.wait(350)
  await a.set({ preview: true })
  await a.wait(1100)

  // 5. Hold the mic for a voice note, let go to send it
  a.mark('voice')
  a.put({ step: 5 })
  await a.move({ at: 'mic', x: 0.5, y: 0.5 })
  await a.wait(150)
  await holdMic(a, 'voice', 2400)
  await a.set({ rec: 'none', voice: true, lastTick: 'sent' })
  await a.wait(600)
  a.put({ lastTick: 'read' })
  await a.wait(500)

  // 6. A tap turns the mic into the camera, a hold films a round note
  a.mark('round')
  a.put({ step: 6 })
  await a.click({ at: 'mic', x: 0.5, y: 0.5 })
  await a.set({ video: true })
  await a.wait(550)
  await holdMic(a, 'round', 2700)
  await a.set({ rec: 'none', round: true, lastTick: 'sent' })
  await a.wait(600)
  a.put({ lastTick: 'read' })
  await a.wait(500)

  // 7. The clip opens the gallery, a photo is picked and sent
  a.mark('attach')
  a.put({ step: 7 })
  await a.click({ at: 'clip', x: 0.5, y: 0.5 })
  await a.set({ sheet: true })
  await a.wait(750)
  await a.click({ at: 'pick', x: 0.5, y: 0.55 })
  await a.set({ picked: true })
  await a.wait(600)
  await a.click({ at: 'sheet-send', x: 0.5, y: 0.5 })
  await a.set({ sheet: false, photo: true, lastTick: 'sent' })
  a.put({ picked: false })
  await a.wait(600)
  a.put({ lastTick: 'read' })
  await a.wait(600)

  // 8. The same chat in the night theme; the payoff holds
  a.mark('dark')
  await a.set({ step: 8, dark: true })
  await a.wait(1500)
  a.put({ step: 9 })
  await a.wait(1600)

  // What the story added leaves, newest first, as the day theme returns
  a.mark('reset')
  a.put({ step: 0, dark: false, video: false })
  for (let k = 1; k <= 5; k++) {
    a.put({ leave: k })
    await a.wait(70)
  }
  a.put({ reacted: false })
  await a.wait(320)
  await a.set({ sent: false, ai: 'none', preview: false, voice: false, round: false, photo: false, leave: 0, lastTick: 'read' })
  await a.move(a.layout === 'wide' ? { x: 700, y: 585 } : { x: 330, y: 525 })
  await a.snap(initial)
  await a.wait(500)
}

/** Press and hold the mic, the take's timer running while the finger stays down. */
async function holdMic(a: Act<S>, rec: 'voice' | 'round', ms: number) {
  const press = a.drag({ at: 'mic', x: 0.5, y: 0.5 }, undefined, { duration: ms })
  a.put({ rec, recSec: 0 })
  for (let sec = 1; sec * 1000 < ms; sec++) {
    await a.wait(1000)
    a.put({ recSec: sec })
  }
  await press
}

type Art = 'tram' | 'sea' | 'tiles' | 'sunset' | 'lemon' | 'night' | 'facade' | 'coffee'

/** A photo, drawn: a few flat shapes in the colors of a Lisbon day. */
function Photo({ art, className }: { art: Art; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {art === 'tram' && (
        <>
          <rect width="100" height="100" fill="#bfe3f5" />
          <rect y="62" width="100" height="38" fill="#cdbba4" />
          <path d="M0 30 18 26V62H0Z M78 22 100 18V62H78Z" fill="#f2d7c4" />
          <rect x="22" y="34" width="54" height="32" rx="5" fill="#f4c22b" />
          <rect x="22" y="56" width="54" height="5" fill="#e8e1d2" />
          <rect x="27" y="39" width="10" height="11" rx="1.5" fill="#3b4b5a" />
          <rect x="40" y="39" width="10" height="11" rx="1.5" fill="#3b4b5a" />
          <rect x="53" y="39" width="10" height="11" rx="1.5" fill="#3b4b5a" />
          <rect x="66" y="39" width="7" height="11" rx="1.5" fill="#3b4b5a" />
          <circle cx="32" cy="68" r="3.5" fill="#2c2c2c" />
          <circle cx="66" cy="68" r="3.5" fill="#2c2c2c" />
          <path d="M49 34 44 20H56" stroke="#2c2c2c" strokeWidth="1.2" fill="none" />
        </>
      )}
      {art === 'sea' && (
        <>
          <rect width="100" height="100" fill="#9ed4f2" />
          <rect y="52" width="100" height="22" fill="#2f86bd" />
          <path d="M0 74C30 70 60 72 100 68V100H0Z" fill="#ecd7aa" />
          <circle cx="76" cy="26" r="9" fill="#fff6d6" />
        </>
      )}
      {art === 'tiles' && (
        <>
          <rect width="100" height="100" fill="#f4f1ea" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <g key={`${r}${c}`} transform={`translate(${c * 25} ${r * 25})`}>
                <circle cx="12.5" cy="12.5" r="7" fill="none" stroke="#2c5aa0" strokeWidth="2.4" />
                <circle cx="12.5" cy="12.5" r="2.4" fill="#2c5aa0" />
                <path d="M0 0H5L0 5ZM25 0H20L25 5ZM0 25H5L0 20ZM25 25H20L25 20Z" fill="#2c5aa0" />
              </g>
            )),
          )}
        </>
      )}
      {art === 'sunset' && (
        <>
          <defs>
            <linearGradient id="rc-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6b5aa6" />
              <stop offset="0.55" stopColor="#f08a7a" />
              <stop offset="1" stopColor="#ffc983" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#rc-sky)" />
          <circle cx="50" cy="66" r="13" fill="#ffe2a6" />
          <path d="M0 70H10V60H18V66H26V54H34V64H44V72H56V58H62V50H66V58H74V66H84V56H92V64H100V100H0Z" fill="#4a3555" />
        </>
      )}
      {art === 'lemon' && (
        <>
          <rect width="100" height="100" fill="#f5dc5a" />
          <circle cx="34" cy="40" r="17" fill="#fff1a1" />
          <circle cx="66" cy="62" r="20" fill="#fbe56f" stroke="#e9c623" strokeWidth="2" />
          <path d="M70 28C80 22 88 26 90 32 80 34 74 32 70 28Z" fill="#5f9e45" />
        </>
      )}
      {art === 'night' && (
        <>
          <rect width="100" height="100" fill="#1d2a48" />
          <path d="M0 76 30 66 60 72 100 62V100H0Z" fill="#111a2e" />
          {[[16, 20], [38, 12], [62, 28], [84, 16], [72, 44], [26, 42]].map(([x, y]) => (
            <circle key={`${x}`} cx={x} cy={y} r="1.3" fill="#e9eefc" />
          ))}
          <circle cx="78" cy="30" r="7" fill="#f4f0d8" />
        </>
      )}
      {art === 'facade' && (
        <>
          <rect width="100" height="100" fill="#f3b8b0" />
          <rect x="34" width="34" height="100" fill="#f7e0a1" />
          <rect x="68" width="32" height="100" fill="#a9d3c8" />
          {[14, 44, 74].map((y) =>
            [8, 44, 78].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="12" height="18" rx="6" fill="#fff" opacity="0.85" />),
          )}
        </>
      )}
      {art === 'coffee' && (
        <>
          <rect width="100" height="100" fill="#d9b48f" />
          <circle cx="50" cy="52" r="26" fill="#f6efe6" />
          <circle cx="50" cy="52" r="19" fill="#6f4429" />
          <path d="M42 50C46 44 54 44 58 50 54 56 46 56 42 50Z" fill="#c99467" />
        </>
      )}
    </svg>
  )
}

function Ticks({ state }: { state: Tick }) {
  return (
    <svg className="rc-ticks" data-state={state} viewBox="0 0 17 11" width="17" height="11" aria-hidden>
      <g className="rc-ticks__clock">
        <circle cx="6" cy="5.5" r="4.6" />
        <path d="M6 3v2.7l1.7 1" />
      </g>
      <path className="rc-ticks__one" pathLength={1} d="M1.2 5.9 4.1 8.8 10.4 1.6" />
      <path className="rc-ticks__two" pathLength={1} d="M7.4 8.1 8.1 8.8 14.4 1.6" />
    </svg>
  )
}

function Meta({ time, tick, show = true, className = 'rc-meta' }: { time: string; tick?: Tick; show?: boolean; className?: string }) {
  return (
    <span className={className} data-hide={show ? undefined : ''}>
      {time}
      {tick && <Ticks state={tick} />}
    </span>
  )
}

function Features({ s }: { s: S }) {
  const step = s.step
  return (
    <ol className="rc-features">
      {FEATURES.map((f, i) => {
        const n = i + 1
        const state = step === n ? 'on' : step > n ? 'done' : 'next'
        const Glyph = f.icon
        return (
          <li key={f.title} className="rc-feature" data-state={state}>
            <span className="rc-feature__tile">
              <Glyph size={18} strokeWidth={2} />
            </span>
            <span className="rc-feature__words">
              <span className="rc-feature__title">{f.title}</span>
              <span className="rc-feature__line">{f.line}</span>
            </span>
          </li>
        )
      })}
      <li className="rc-more">
        <span className="rc-more__head">Also built in</span>
        <span className="rc-chips">
          {EXTRAS.map((x) => (
            <span key={x.title} className="rc-xchip" data-state={x.on?.(s) ? 'on' : x.seen?.(s) ? 'done' : undefined}>
              {x.title}
            </span>
          ))}
        </span>
      </li>
    </ol>
  )
}

/** Compact: the feature in play, as a caption over the top of the stage. */
function Caption({ step }: { step: number }) {
  const n = Math.min(step, LAST)
  return (
    <div className="rc-caption" data-show={n > 0 || undefined}>
      {FEATURES.map((f, i) => {
        const Glyph = f.icon
        return (
          <span key={f.title} className="rc-caption__item" data-on={n === i + 1 || undefined}>
            <Glyph size={16} strokeWidth={2.2} />
            {f.title}
          </span>
        )
      })}
    </div>
  )
}

export default function ChatShowcase({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <Stage<S>
      width={760}
      height={600}
      compact={{ below: 600, width: 358, height: 540 }}
      initial={initial}
      poster={poster}
      script={script}
      play="loop"
      theme={theme}
      cursor={{ at: { wide: { x: 700, y: 585 }, compact: { x: 330, y: 525 } }, style: 'touch' }}
      className="rc"
    >
      {(s, rect, layout) => {
        // The phone lays its screen out in points; drags arrive in stage px
        const box = rect('screen')
        const k = box.width ? box.width / 402 : 1
        const shift = s.dx / k
        const pull = Math.min(1, Math.max(0, -shift - 12) / 48)
        return (
          <>
            {layout === 'wide' ? <Features s={s} /> : <Caption step={s.step} />}
            <Phone width={layout === 'wide' ? 340 : 326} className="rc-phone" dark={s.dark}>
              <div className="rc-screen" data-dark={s.dark || undefined} data-target="screen">
                <div className="rc-wall rc-wall--day" aria-hidden />
                <div className="rc-wall rc-wall--night" aria-hidden />

                <Thread className="rc-thread">
                  <Stamp className="rc-day">Yesterday</Stamp>
                  <div className="ss-bubble-row rc-big" data-from="me">
                    <span className="rc-big__emoji">👋</span>
                    <Meta time="8:12 PM" tick="read" className="rc-meta rc-chip rc-big__meta" />
                  </div>
                  <Bubble from="them" className="rc-in">
                    Hey! I can plan trips, book tables and answer questions.
                    <Meta time="8:12 PM" />
                  </Bubble>
                  <Stamp className="rc-day">Today</Stamp>
                  <Bubble from="them" className="rc-in">
                    Hi! Where are we heading this weekend?
                    <Meta time="9:37 AM" />
                  </Bubble>
                  <div className="ss-bubble-row rc-quick" data-from="them">
                    <span className="rc-quick__btn" data-chosen="">Lisbon</span>
                    <span className="rc-quick__btn">Porto</span>
                    <span className="rc-quick__btn">Surprise me</span>
                  </div>
                  <Bubble from="me" className="rc-out rc-out--top">
                    Plan a Saturday in Lisbon for two
                    <Meta time="9:38 AM" tick="read" />
                  </Bubble>
                  {/* The answer is drawn here rather than by the kit's Bubble:
                      its fill slides with the swipe and opens a reaction row
                      under the words, which the kit's box morph would lock */}
                  <div className="ss-bubble-row rc-answer" data-from="them">
                    <span className="rc-swipe" data-pressed={s.pressed || undefined} style={{ transform: `translateX(${shift}px)`, transition: s.dx ? 'none' : undefined }}>
                      <span className="rc-lift" data-target="answer">
                        {ANSWER}
                        {/* The time's own line, under the words: a reaction
                            takes its left end rather than a new row */}
                        <span className="rc-foot" data-on={s.reacted || undefined}>
                          <span className="rc-pill">❤️</span>
                        </span>
                      </span>
                      <span className="rc-meta-pin">
                        <Meta time="9:39 AM" />
                      </span>
                    </span>
                    <span className="rc-swipe-icon" style={{ opacity: pull, transform: `scale(${0.6 + 0.4 * pull})` }} aria-hidden>
                      <Reply size={18} strokeWidth={2.4} />
                    </span>
                    <span className="rc-picker" data-show={s.picker || undefined}>
                      {REACTIONS.map((e) => (
                        <span key={e} className="rc-picker__emoji" data-target={e === '❤️' ? 'react-heart' : undefined}>
                          {e}
                        </span>
                      ))}
                    </span>
                  </div>
                  {s.sent && (
                    <Bubble from="me" source="draft" className="rc-out rc-out--mid" data-gone={s.leave >= 5 || undefined}>
                      <span className="rc-quote">
                        <span className="rc-quote__name">Assistant</span>
                        <span className="rc-quote__text">{ANSWER}</span>
                      </span>
                      {MINE}
                      <Meta time="9:41 AM" tick={s.tick} />
                    </Bubble>
                  )}
                  {s.ai !== 'none' && (
                    <Bubble from="them" typing={s.ai === 'typing'} className="rc-in" data-gone={s.leave >= 4 || undefined}>
                      <Stream className="rc-stream" text={STREAMED} count={s.words} />{' '}
                      <span className="rc-link" data-show={s.words >= STREAMED_WORDS || undefined}>
                        {LINK}
                      </span>
                      <Collapse open={s.preview}>
                        <span className="rc-preview">
                          <span className="rc-preview__words">
                            <span className="rc-preview__site">Visit Lisboa</span>
                            <span className="rc-preview__title">Fado houses in Alfama</span>
                            <span className="rc-preview__text">Where to hear fado tonight, and how to book</span>
                          </span>
                          <Photo art="night" className="rc-preview__img" />
                        </span>
                      </Collapse>
                      <Meta time="9:41 AM" show={s.words >= STREAMED_WORDS} />
                    </Bubble>
                  )}
                  {s.voice && (
                    <Bubble from="me" className="rc-out rc-out--low rc-voice" data-gone={s.leave >= 3 || undefined}>
                      <span className="rc-voice__play">
                        <Play size={20} strokeWidth={0} fill="currentColor" />
                      </span>
                      <span className="rc-voice__body">
                        <span className="rc-voice__bars">
                          {BARS.map((h, i) => (
                            <i key={i} style={{ height: h }} />
                          ))}
                        </span>
                        <span className="rc-voice__len">0:02</span>
                      </span>
                      <Meta time="9:42 AM" tick={s.round ? 'read' : s.lastTick} />
                    </Bubble>
                  )}
                  {s.round && (
                    <div className="ss-bubble-row rc-note" data-from="me" data-gone={s.leave >= 2 || undefined}>
                      <span className="rc-note__disc">
                        <Photo art="sunset" className="rc-note__art" />
                        <span className="rc-chip rc-note__len">0:02</span>
                        <Meta time="9:42 AM" tick={s.photo ? 'read' : s.lastTick} className="rc-meta rc-chip rc-note__meta" />
                      </span>
                    </div>
                  )}
                  {s.photo && (
                    <Bubble from="me" tail={false} className="rc-out rc-out--bottom rc-photo" data-gone={s.leave >= 1 || undefined}>
                      <Photo art="tram" className="rc-photo__img" />
                      <Meta time="9:43 AM" tick={s.lastTick} className="rc-meta rc-chip rc-photo__meta" />
                    </Bubble>
                  )}
                </Thread>

                {/* A round note films in a circle over the dimmed chat */}
                <div className="rc-cam" data-show={s.rec === 'round' || undefined} aria-hidden>
                  <span className="rc-cam__disc">
                    <Photo art="sunset" className="rc-cam__art" />
                    <svg className="rc-cam__ring" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="48.5" pathLength={1} />
                    </svg>
                  </span>
                </div>

                <div className="rc-compose">
                  <div className="rc-reply" data-open={s.replying || undefined}>
                    <div className="rc-reply__inner">
                      <Reply size={20} strokeWidth={2.2} className="rc-reply__icon" />
                      <span className="rc-reply__line" />
                      <span className="rc-reply__words">
                        <span className="rc-reply__name">Assistant</span>
                        <span className="rc-reply__text">{ANSWER}</span>
                      </span>
                      <X size={18} strokeWidth={2.2} className="rc-reply__close" />
                    </div>
                  </div>
                  <div className="rc-bar">
                    <span className="rc-field">
                      <Smile size={24} strokeWidth={1.8} className="rc-field__icon" />
                      <span className="rc-field__text" data-target="draft">
                        {s.draft}
                        {(s.draft || s.replying) && <i className="rc-caret" data-snap />}
                      </span>
                      <span className="rc-field__ph" data-hide={s.draft ? '' : undefined}>
                        Type a message...
                      </span>
                      <span className="rc-field__clip" data-target="clip">
                        <Paperclip size={22} strokeWidth={1.8} className="rc-field__icon" />
                      </span>
                      <span className="rc-rec" data-show={s.rec !== 'none' || undefined}>
                        <i className="rc-rec__dot" />
                        <span className="rc-rec__time">0:0{s.recSec}</span>
                        <span className="rc-rec__hint">
                          <ChevronLeft size={16} strokeWidth={2.4} />
                          Slide left to cancel
                        </span>
                      </span>
                    </span>
                    <span className="rc-action" data-target="mic">
                      <span className="rc-lock" data-show={s.rec !== 'none' || undefined}>
                        <Lock size={16} strokeWidth={2.2} />
                        <ChevronUp size={16} strokeWidth={2.4} />
                      </span>
                      <span className="rc-halo" data-on={s.rec !== 'none' || undefined} />
                      <span className="rc-round rc-mic" data-off={s.draft ? '' : undefined} data-rec={s.rec !== 'none' || undefined}>
                        <span className="rc-mic__glyph" data-on={!s.video || undefined}>
                          <Mic size={22} strokeWidth={2} />
                        </span>
                        <span className="rc-mic__glyph" data-on={s.video || undefined}>
                          <Video size={22} strokeWidth={2} />
                        </span>
                      </span>
                      <span className="rc-round rc-send" data-on={s.draft ? '' : undefined} data-target="send">
                        <ArrowUp size={22} strokeWidth={2.6} />
                      </span>
                    </span>
                  </div>
                </div>

                {/* The attachment sheet: the gallery, then the caption bar once a photo is picked */}
                <div className="rc-dim" data-show={s.sheet || undefined} aria-hidden />
                <div className="rc-sheet" data-show={s.sheet || undefined}>
                  <span className="rc-sheet__handle" />
                  <div className="rc-grid">
                    <span className="rc-cell rc-cell--camera">
                      <Camera size={26} strokeWidth={1.8} />
                    </span>
                    {GALLERY.map((art, i) => (
                      <span key={i} className="rc-cell" data-picked={(i === 0 && s.picked) || undefined} data-target={i === 0 ? 'pick' : undefined}>
                        <Photo art={art} className="rc-cell__img" />
                        <span className="rc-check">{i === 0 && s.picked ? '1' : ''}</span>
                      </span>
                    ))}
                  </div>
                  <div className="rc-sheet__foot">
                    <div className="rc-tabs" data-off={s.picked || undefined}>
                      <span className="rc-tab" data-on="">
                        <Image size={24} strokeWidth={1.8} />
                        Gallery
                      </span>
                      <span className="rc-tab">
                        <File size={24} strokeWidth={1.8} />
                        File
                      </span>
                      <span className="rc-tab">
                        <MapPin size={24} strokeWidth={1.8} />
                        Location
                      </span>
                    </div>
                    <div className="rc-caption-bar" data-on={s.picked || undefined}>
                      <span className="rc-caption-bar__field">Add a caption...</span>
                      <span className="rc-round rc-sheet-send" data-target="sheet-send">
                        <ArrowUp size={22} strokeWidth={2.6} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Phone>
          </>
        )
      }}
    </Stage>
  )
}
