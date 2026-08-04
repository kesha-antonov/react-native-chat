# Migrating from react-native-gifted-chat

`@kesha-antonov/react-native-chat` is a rebranded continuation of
[`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat)
(RNGC), built from its latest `master`. **The API, props, and `IMessage` data
model are unchanged** - migrating is a package swap plus a find-and-replace of
the `GiftedChat*` names. There are no prop renames and no behavior changes.

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

Peer dependencies are the same as RNGC, so nothing else to install:
`react-native-gesture-handler`, `react-native-reanimated`,
`react-native-safe-area-context`, `react-native-keyboard-controller`.

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

## 3. Everything else stays the same

- All `<Chat>` props are identical to `<GiftedChat>` (same names, same render
  overrides, same `messages` / `onSend` / `user` shape).
- The `IMessage` model is unchanged. New optional fields - `reactions` and
  `streaming` - are additive and don't affect existing code.
- The package now publishes compiled output (`lib/`) with type declarations.
  This is transparent for normal imports (`import { Chat } from '@kesha-antonov/react-native-chat'`);
  only deep imports into internal `src/...` paths (which were never public) would break.

## What's new beyond RNGC

The one capability not in RNGC is **streaming (AI) messages** - token-by-token
replies for AI/chatbot UIs (`useStreamingMessages`, a blinking `StreamingCursor`).
See [docs/STREAMING.md](./STREAMING.md).
