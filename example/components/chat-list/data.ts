import { IMessage, User } from '@kesha-antonov/react-native-chat'

export type DialogKind = 'user' | 'group' | 'channel'

export interface Dialog {
  id: string
  title: string
  kind: DialogKind
  /** A photo; letter avatars are drawn from `id` otherwise. */
  avatar?: string
  isPinned?: boolean
  isMuted?: boolean
  isArchived?: boolean
  isVerified?: boolean
  unreadCount: number
  /** One-to-one chats: the other person. */
  peer?: User
  isOnline?: boolean
  /** "last seen …" when not online. */
  lastSeen?: string
  /** Groups: everyone but you; they take turns answering. */
  members?: User[]
  subscribers?: number
  draft?: string
  /** A bot: "bot" in the header, an intro card with START in an empty chat, streamed replies. */
  isBot?: boolean
  /** What the bot says it can do, on that card. */
  botDescription?: string
}

export const ME: User = { _id: 'me', name: 'Alex Morgan' }

const photo = (seed: string, width = 800, height = 600) => `https://picsum.photos/seed/${seed}/${width}/${height}`
const face = (index: number) => `https://i.pravatar.cc/200?img=${index}`

const ANNA: User = { _id: 'anna', name: 'Anna Petrova', avatar: face(47) }
const MAX: User = { _id: 'max', name: 'Max Ivanov' }
export const AI_BOT: User = { _id: 'ai', name: 'AI Assistant' }
const SOFIA: User = { _id: 'sofia', name: 'Sofia Garcia', avatar: face(45) }
const LIAM: User = { _id: 'liam', name: 'Liam Chen' }
const EMMA: User = { _id: 'emma', name: 'Emma Wilson', avatar: face(32) }
const NOAH: User = { _id: 'noah', name: 'Noah Brown' }
const OLIVIA: User = { _id: 'olivia', name: 'Olivia Davis' }
const MOM: User = { _id: 'mom', name: 'Mom' }
const DAD: User = { _id: 'dad', name: 'Dad' }
const KATE: User = { _id: 'kate', name: 'Kate Lee' }
const DESIGN: User = { _id: 'design-digest', name: 'Design Digest' }
const RELEASES: User = { _id: 'rn-releases', name: 'RN Releases' }

export const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
export const SAMPLE_VIDEO = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

let counter = 0
interface Seed extends Omit<IMessage, '_id' | 'createdAt' | 'text'> {
  /** How long ago, in ms. */
  ago: number
  text?: string
}

/** Builds a history from oldest to newest, then flips it to Chat's newest-first order. */
function history (chatId: string, seeds: Seed[]): IMessage[] {
  const now = Date.now()
  return seeds
    .map(({ ago, text = '', ...rest }) => ({
      _id: `${chatId}-${++counter}`,
      text,
      createdAt: new Date(now - ago),
      ...rest,
    }))
    .reverse()
}

const read = { sent: true, received: true }

export const DIALOGS: Dialog[] = [
  {
    id: 'ai',
    title: 'AI Assistant',
    kind: 'user',
    peer: AI_BOT,
    isBot: true,
    isVerified: true,
    unreadCount: 0,
    botDescription: 'Ask me anything: I explain things, write and brainstorm with you. My answers stream in as I write them.',
  },
  {
    id: 'rn-chat',
    title: 'React Native Chat',
    kind: 'group',
    isPinned: true,
    unreadCount: 3,
    members: [SOFIA, MAX, LIAM],
  },
  {
    id: 'anna',
    title: 'Anna Petrova',
    kind: 'user',
    avatar: ANNA.avatar as string,
    peer: ANNA,
    isPinned: true,
    isOnline: true,
    unreadCount: 0,
  },
  {
    id: 'design-digest',
    title: 'Design Digest',
    kind: 'channel',
    avatar: photo('digest-logo', 200, 200),
    isVerified: true,
    isMuted: true,
    unreadCount: 12,
    subscribers: 48213,
  },
  {
    id: 'max',
    title: 'Max Ivanov',
    kind: 'user',
    peer: MAX,
    isOnline: true,
    unreadCount: 0,
  },
  {
    id: 'family',
    title: 'Family 🏡',
    kind: 'group',
    isMuted: true,
    unreadCount: 5,
    members: [MOM, DAD, KATE],
  },
  {
    id: 'sofia',
    title: 'Sofia Garcia',
    kind: 'user',
    avatar: SOFIA.avatar as string,
    peer: SOFIA,
    lastSeen: 'last seen recently',
    unreadCount: 1,
  },
  {
    id: 'liam',
    title: 'Liam Chen',
    kind: 'user',
    peer: LIAM,
    lastSeen: 'last seen 2 hours ago',
    unreadCount: 0,
  },
  {
    id: 'hike',
    title: 'Weekend Hike',
    kind: 'group',
    avatar: photo('hike-group', 200, 200),
    unreadCount: 0,
    members: [EMMA, NOAH, OLIVIA],
  },
  {
    id: 'emma',
    title: 'Emma Wilson',
    kind: 'user',
    avatar: EMMA.avatar as string,
    peer: EMMA,
    isOnline: true,
    unreadCount: 2,
  },
  {
    id: 'noah',
    title: 'Noah Brown',
    kind: 'user',
    peer: NOAH,
    lastSeen: 'last seen yesterday at 21:40',
    unreadCount: 0,
    draft: 'Let me check my calendar and',
  },
  {
    id: 'olivia',
    title: 'Olivia Davis',
    kind: 'user',
    peer: OLIVIA,
    lastSeen: 'last seen within a week',
    unreadCount: 0,
  },
  {
    id: 'mom',
    title: 'Mom',
    kind: 'user',
    peer: MOM,
    lastSeen: 'last seen 5 minutes ago',
    unreadCount: 0,
  },
  {
    id: 'rn-releases',
    title: 'RN Releases',
    kind: 'channel',
    isArchived: true,
    isMuted: true,
    unreadCount: 4,
    subscribers: 9120,
  },
  {
    id: 'kate',
    title: 'Kate Lee',
    kind: 'user',
    peer: KATE,
    isArchived: true,
    lastSeen: 'last seen a long time ago',
    unreadCount: 0,
  },
]

/** Suggestions under a bot reply, sent as your next message when tapped. */
export const BOT_SUGGESTIONS = {
  type: 'radio' as const,
  values: [
    { title: '✍️ Write a poem', value: 'Write a short poem about chat apps' },
    { title: '💡 Explain streaming', value: 'How does streaming work?' },
    { title: '😄 Tell a joke', value: 'Tell me a joke' },
  ],
}

export const INITIAL_MESSAGES: Record<string, IMessage[]> = {
  'ai': history('ai', [
    { ago: 30 * MINUTE, user: ME, text: '/start', sent: true, received: true },
    {
      ago: 30 * MINUTE - 2000,
      user: AI_BOT,
      text: '👋 Hi! I am your **AI Assistant**.\n\nAsk me anything, or pick a suggestion below. My replies appear as I write them.',
      quickReplies: BOT_SUGGESTIONS,
    },
  ]),
  'rn-chat': history('rn-chat', [
    { ago: 2 * DAY, user: MAX, text: 'Morning! Who is looking at the FlashList regression?' },
    { ago: 2 * DAY - 5 * MINUTE, user: LIAM, text: 'On it. Looks like the inverted list loses its scroll position after a prepend.' },
    { ago: 2 * DAY - 6 * MINUTE, user: ME, text: 'I can reproduce it on Android too. Pushing a test case.', ...read },
    { ago: 3 * HOUR, user: SOFIA, text: 'The new emoji keyboard is in. Tap the smiley in the composer 😍', reactions: [{ emoji: '🔥', userIds: ['max', 'liam'] }, { emoji: '❤️', userIds: ['me'] }] },
    { ago: 3 * HOUR - MINUTE, user: SOFIA, image: photo('rn-keyboard'), text: 'Screenshot from the iPhone build' },
    { ago: 2 * HOUR, user: ME, text: 'Looks great! The swipe-to-reply feels just right now.', ...read },
    { ago: 40 * MINUTE, user: LIAM, file: { uri: SAMPLE_PDF, name: 'release-checklist.pdf', size: 13264, mimeType: 'application/pdf' } },
    { ago: 12 * MINUTE, user: MAX, text: 'Checklist is green on my side', replyMessage: { _id: 'rn-chat-7', text: 'release-checklist.pdf', user: LIAM } },
    { ago: 3 * MINUTE, user: SOFIA, text: 'Shipping it tonight 🚀' },
  ]),
  'anna': history('anna', [
    { ago: DAY + 3 * HOUR, user: ANNA, text: 'Are we still on for dinner tomorrow?' },
    { ago: DAY + 3 * HOUR - MINUTE, user: ME, text: 'Of course! Found a new place near the river', ...read },
    { ago: DAY + 3 * HOUR - 2 * MINUTE, user: ME, location: { latitude: 59.9343, longitude: 30.3351 }, ...read },
    { ago: DAY + 2 * HOUR, user: ANNA, text: 'Ooh, I walked past it last week. The terrace is lovely', reactions: [{ emoji: '👍', userIds: ['me'] }] },
    { ago: 5 * HOUR, user: ANNA, image: photo('terrace-sunset') },
    { ago: 5 * HOUR - MINUTE, user: ANNA, audio: SAMPLE_AUDIO, duration: 14 },
    { ago: 4 * HOUR, user: ME, text: 'Perfect, booked a table for two 🍝', ...read, reactions: [{ emoji: '❤️', userIds: ['anna'] }] },
    { ago: 25 * MINUTE, user: ME, text: 'See you at 7!', ...read },
    { ago: 24 * MINUTE, user: ANNA, text: '😍' },
  ]),
  'design-digest': history('design-digest', [
    { ago: 3 * DAY, user: DESIGN, text: 'Welcome to Design Digest: one good interface idea a day.' },
    { ago: 2 * DAY, user: DESIGN, image: photo('digest-1'), text: 'Motion with purpose: every animation should answer "where did this come from?"', reactions: [{ emoji: '👍', userIds: ['a', 'b', 'c', 'd'] }, { emoji: '🔥', userIds: ['e', 'f'] }] },
    {
      ago: DAY,
      user: DESIGN,
      text: 'Tip: keep tap targets at least 48dp, even when the icon is 24. More in https://m3.material.io/foundations/designing/structure',
      linkPreview: {
        siteName: 'Material Design',
        title: 'Structure - Material Design 3',
        description: 'Touch targets should be at least 48x48dp, with 8dp of space between them.',
        image: photo('material-touch', 400, 400),
        imageWidth: 400,
        imageHeight: 400,
      },
    },
    { ago: 6 * HOUR, user: DESIGN, image: photo('digest-2'), text: 'Today\'s pick: a chat list that fits 70dp rows without feeling cramped.' },
    { ago: 50 * MINUTE, user: DESIGN, image: photo('digest-3') },
  ]),
  'max': history('max', [
    { ago: 3 * DAY, user: MAX, text: 'Did you see the talk about Fabric?' },
    { ago: 3 * DAY - MINUTE, user: ME, text: 'Yes! The part about synchronous layout was mind-blowing', ...read },
    { ago: 2 * HOUR, user: MAX, text: 'Sending you the slides later' },
    {
      ago: 2 * HOUR - MINUTE,
      user: MAX,
      text: 'Meanwhile, the write-up: https://reactnative.dev/architecture/landing-page',
      // What a server would have fetched from the page's Open Graph tags.
      linkPreview: {
        siteName: 'React Native',
        title: 'About the New Architecture',
        description: 'Since 2018, the React Native team has been redesigning the core internals of React Native to enable developers to create higher-quality experiences.',
        image: photo('new-architecture', 1200, 630),
        imageWidth: 1200,
        imageHeight: 630,
      },
    },
    { ago: 2 * HOUR - 2 * MINUTE, user: ME, text: 'Thanks 🙏', ...read },
    { ago: 2 * HOUR - 3 * MINUTE, user: MAX, text: '👍' },
  ]),
  'family': history('family', [
    { ago: DAY, user: MOM, text: 'Dinner on Sunday at ours?' },
    { ago: DAY - 10 * MINUTE, user: ME, text: 'Count me in!', ...read },
    { ago: 6 * HOUR, user: KATE, image: photo('family-cat') },
    { ago: 6 * HOUR - MINUTE, user: KATE, text: 'Look who learned to open the fridge 😂', reactions: [{ emoji: '😂', userIds: ['mom', 'dad', 'me'] }] },
    { ago: 2 * HOUR, user: MOM, text: 'Bring a jacket, it will be chilly' },
    { ago: HOUR, user: DAD, audio: SAMPLE_AUDIO, duration: 9 },
    { ago: 30 * MINUTE, user: DAD, text: 'I will make my famous pie 🥧' },
  ]),
  'sofia': history('sofia', [
    { ago: 4 * DAY, user: ME, text: 'How was the conference?', ...read },
    { ago: 4 * DAY - HOUR, user: SOFIA, text: 'Amazing! I will tell you everything' },
    { ago: 70 * MINUTE, user: SOFIA, audio: SAMPLE_AUDIO, duration: 23, isMediaUnread: true },
  ]),
  'liam': history('liam', [
    { ago: DAY + HOUR, user: LIAM, text: 'Can you send me the Q3 numbers?' },
    { ago: DAY, user: ME, file: { uri: SAMPLE_PDF, name: 'Q3-report.pdf', size: 13264, mimeType: 'application/pdf' }, ...read },
    { ago: 3 * HOUR, user: LIAM, text: 'Got it, thanks. One more question about the forecast' },
    { ago: 2 * HOUR + 30 * MINUTE, user: ME, text: 'Sure, call me after lunch', sent: true },
  ]),
  'hike': history('hike', [
    { ago: 5 * DAY, user: EMMA, text: 'Trail options for Saturday 👇' },
    { ago: 5 * DAY - MINUTE, user: EMMA, location: { latitude: 46.5586, longitude: 7.9792 } },
    { ago: 5 * DAY - 30 * MINUTE, user: NOAH, text: 'The lake one! Less climbing, more views' },
    { ago: 4 * DAY, user: OLIVIA, text: 'I am in. Bringing sandwiches 🥪' },
    { ago: 3 * DAY, user: ME, image: photo('mountain-lake'), text: 'From last year', ...read, reactions: [{ emoji: '😍', userIds: ['emma', 'olivia'] }] },
  ]),
  'emma': history('emma', [
    { ago: 2 * DAY, user: ME, text: 'Happy birthday!! 🎉', ...read },
    { ago: 2 * DAY - HOUR, user: EMMA, text: 'Thank you so much ❤️' },
    { ago: 20 * MINUTE, user: EMMA, video: SAMPLE_VIDEO, videoNote: true, duration: 8, isMediaUnread: true },
    { ago: 18 * MINUTE, user: EMMA, text: 'Look what I got 😄' },
  ]),
  'noah': history('noah', [
    { ago: 6 * DAY, user: NOAH, text: 'Are you free next Friday for a game night?' },
  ]),
  'olivia': history('olivia', [
    { ago: 8 * DAY, user: OLIVIA, text: 'I am here' },
    { ago: 8 * DAY, user: OLIVIA, location: { latitude: 40.7484, longitude: -73.9857 } },
  ]),
  'mom': history('mom', [
    { ago: 30 * DAY, user: MOM, text: 'Did you water the plants?' },
    { ago: 30 * DAY - HOUR, user: ME, text: 'Yes mom 🌱', ...read },
    { ago: 10 * DAY, user: MOM, video: SAMPLE_VIDEO },
  ]),
  'rn-releases': history('rn-releases', [
    { ago: 9 * DAY, user: RELEASES, text: 'React Native 0.88 is out: strict TypeScript API, faster startup.' },
    {
      ago: 9 * DAY - MINUTE,
      user: RELEASES,
      text: 'Release notes: https://reactnative.dev/blog',
      linkPreview: {
        siteName: 'React Native',
        title: 'Blog - React Native',
        description: 'Release notes, deep dives and announcements from the React Native team.',
        image: photo('rn-blog', 1200, 630),
        imageWidth: 1200,
        imageHeight: 630,
      },
    },
  ]),
  'kate': history('kate', [
    { ago: 40 * DAY, user: KATE, text: 'Thanks for the help with the move!' },
  ]),
}

/** The bot's answers, by what the question mentions. Markdown, streamed in a few words at a time. */
export function botAnswer (prompt: string): string {
  const text = prompt.toLowerCase()
  if (text === '/start')
    return '👋 Hi again! What would you like to talk about?'
  if (text.includes('poem'))
    return 'Here is a little poem:\n\n*Dots that swell and gently fade,*\n*a message forms, a promise made.*\n*Word by word the answer grows,*\n*and where it ends, nobody knows.*'
  if (text.includes('joke'))
    return 'Why did the React Native developer go broke?\n\nBecause they kept **bridging** the gap. 😄\n\n(Luckily the New Architecture removed the bridge.)'
  if (text.includes('stream'))
    return 'Streaming means you see an answer **while it is being written**:\n\n1. The bot starts a message right away.\n2. New words are appended every few milliseconds.\n3. When it is done, the message is final, like any other.\n\nIn this library a message with `streaming: true` draws a cursor, and the chat list shows the text as it grows.'
  return `Good question! You asked: "${prompt}".\n\nThis demo bot has no real model behind it, but its replies **stream in** exactly like a real AI would. Wire \`onSend\` to your LLM and push its tokens into the message as they arrive.`
}

/** Replies the other side sends back, picked in turn. */
export const CANNED_REPLIES = [
  'Sounds good 👍',
  'Haha, totally',
  'Wait, really? 😮',
  'Let me think about it and get back to you',
  'Agreed!',
  'On my way 🏃',
  'Love it ❤️',
]

/** People you can start a chat with from the pencil button, sorted by name. */
export const CONTACTS: User[] = [ANNA, MAX, SOFIA, LIAM, EMMA, NOAH, OLIVIA, MOM, DAD, KATE]
  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
