# Migrating from react-native-gifted-chat

`@kesha-antonov/react-native-chat` is a rebranded continuation of
[`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat)
(RNGC), built from its latest `master`. **The props and the `IMessage` data
model keep their RNGC names** - migrating is a package swap, a find-and-replace
of the `GiftedChat*` names, and a look at the list and default changes in
[section 3](#3-what-behaves-differently).

> Coming from an older RNGC version? You also pick up everything that landed in
> RNGC `master` (animated day header, swipe-to-reply, quick replies, emoji
> reactions, link parsing, …) plus this fork's **streaming** support.

## 1. Swap the package

```bash
# yarn
yarn remove react-native-gifted-chat
yarn add @kesha-antonov/react-native-chat

# npm
npm uninstall react-native-gifted-chat
npm install @kesha-antonov/react-native-chat
```

The required peers are the same packages as RNGC -
`react-native-gesture-handler` (now **3.x**), `react-native-reanimated`,
`react-native-safe-area-context`, `react-native-keyboard-controller` - on
React Native 0.82+ and React 19. Voice notes, round video notes, the photo
picker and the rest are optional peers; the README's install section lists them.

## 2. Rename the imports / identifiers

| react-native-gifted-chat | @kesha-antonov/react-native-chat |
| --- | --- |
| `react-native-gifted-chat` (package) | `@kesha-antonov/react-native-chat` |
| `GiftedChat` (component + `.append` / `.prepend`) | `Chat` |
| `GiftedAvatar` | `ChatAvatar` |
| `GiftedChatContext` | `ChatContext` |
| `GiftedChatProps` (type) | `ChatProps` |
| `IGiftedChatContext` (type) | `IChatContext` |
| `useChatContext` | `useChatContext` (unchanged) |
| `IMessage`, `User`, `Reply`, `QuickReplies`, … | unchanged |

**Before**

```tsx
import { GiftedChat, IMessage } from 'react-native-gifted-chat'

const onSend = useCallback((msgs: IMessage[] = []) => {
  setMessages(prev => GiftedChat.append(prev, msgs))
}, [])

return <GiftedChat messages={messages} onSend={onSend} user={{ _id: 1 }} />
```

**After**

```tsx
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

const onSend = useCallback((msgs: IMessage[] = []) => {
  setMessages(prev => Chat.append(prev, msgs))
}, [])

return <Chat messages={messages} onSend={onSend} user={{ _id: 1 }} />
```

## Codemod (one-shot find-and-replace)

Run this from your project root against your source directory. **Order matters** -
the compound names must be replaced before the shorter `GiftedChat`:

```bash
grep -rlZ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  react-native-gifted-chat src \
| xargs -0 perl -pi -e '
  s/\bIGiftedChatContext\b/IChatContext/g;
  s/\bGiftedChatContext\b/ChatContext/g;
  s/\bGiftedChatProps\b/ChatProps/g;
  s/\bGiftedAvatarProps\b/ChatAvatarProps/g;
  s/\bGiftedAvatar\b/ChatAvatar/g;
  s/\bGiftedChat\b/Chat/g;
  s#react-native-gifted-chat#\@kesha-antonov/react-native-chat#g;
'
```

Then review the diff and run your type-checker / lint.

## 3. What behaves differently

- **The message list is [Legend List](https://legendapp.com/open-source/list/),
  not `FlatList`.** `listProps` takes Legend List props, `messagesContainerRef`
  is a `LegendListRef`, and the list renders oldest first - indexes count from
  the oldest message and `onEndReached` fires at the newest. Scroll to a
  message with `scrollToKey({ key: String(_id) })`.
- **Message status is yours to set.** Add a message with `pending: true` and
  flip it to `sent` / `received` as your backend confirms; the bubble draws the
  clock, one tick and two ticks.
- **New defaults with opt-outs**: a Telegram-style look (restore yours through
  `theme` / `darkTheme`), the long-press menu (`defaultMessageActions={false}`),
  swipe-to-reply (`reply.swipe.isEnabled: false`), the emoji button and paperclip
  (`emojiKeyboard` / `attachments={false}`), voice and round notes once their
  peers are installed (`audioRecording` / `videoRecording={false}`), and
  avatars and names in group chats only (`isGroupChat`, `isAvatarVisible`).
- **A custom `renderMessage` must not render its own `<Day>`** - the list draws
  the date separator around each row.
- The package publishes compiled output (`lib/`, built with the React Compiler)
  with type declarations; deep imports into `src/...` paths were never public.

The full list is under **💥 Breaking** in [CHANGELOG.md](../CHANGELOG.md).

## What's new beyond RNGC

Streaming (AI) replies - token-by-token with a blinking caret, markdown, and a
Stop button ([docs/STREAMING.md](./STREAMING.md)) - plus a built-in messenger
kit: emoji keyboard, attachment menu, photo viewer, voice and round video notes,
reactions, multi-select, edit mode, drafts, link previews, an unread bar, and
`ChatList` for the list of chats. The README covers each one.
