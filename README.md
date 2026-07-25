<p align="center">
  <a href="https://www.npmjs.com/package/@kesha-antonov/react-native-chat"><img alt="npm version" src="https://badge.fury.io/js/@kesha-antonov%2Freact-native-chat.svg"/></a>
  <a href="https://www.npmjs.com/package/@kesha-antonov/react-native-chat"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@kesha-antonov%2Freact-native-chat.svg"/></a>
  <a href="https://npm-stat.com/charts.html?package=%40kesha-antonov%2Freact-native-chat&from=2015-01-01"><img alt="total npm downloads" src="https://img.shields.io/badge/total%20downloads-466-blue.svg"/></a>
  <a href="https://www.npmjs.com/package/@kesha-antonov/react-native-chat"><img alt="npm downloads (last 18 months)" src="https://img.shields.io/npm/dt/@kesha-antonov%2Freact-native-chat.svg?label=18-months%20downloads"/></a>
  <a href="https://github.com/kesha-antonov/react-native-chat/actions/workflows/main.yml"><img src="https://github.com/kesha-antonov/react-native-chat/actions/workflows/main.yml/badge.svg" alt="build"></a>
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Web-lightgrey.svg" alt="platforms">
  <img src="https://img.shields.io/badge/TypeScript-supported-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Expo-compatible-000020.svg" alt="Expo compatible">
</p>

<h1 align="center">React Native Chat</h1>

<p align="center">
  The most complete chat UI for React Native & Web
</p>

<p align="center">
  <a href="https://snack.expo.dev/@kesha-antonov/react-native-chat-playground" target="_blank">
    <img src="https://img.shields.io/badge/▶️_Try_in_Browser-4630EB?style=for-the-badge&logo=expo&logoColor=white" alt="Try Chat on Expo Snack"/>
  </a>
</p>

---

## ✨ Features

> Actively maintained, New Architecture ready, and built for the latest Reanimated/Gesture Handler. A modern, themeable, drop-in successor to `react-native-gifted-chat`. **[See what is new ▸](#-whats-new-vs-react-native-gifted-chat)**

- 🌗 **[Modern UI, Dark Mode & Theming](#-whats-new-vs-react-native-gifted-chat)** - A clean, modern default look with a full light/dark theme system, runtime theme switching, and every token overridable
- 🤖 **[Streaming (AI) Messages](#streaming-ai-messages)** - Token-by-token streamed replies with a typing cursor and stop control
- 🎥 **[Video & Audio Messages](#-whats-new-vs-react-native-gifted-chat)** - Real inline playback (optional `expo-video` / `expo-audio`) with a graceful tappable fallback - no more "implement it yourself"
- 🎙️ **[Voice & Video Recording](#-whats-new-vs-react-native-gifted-chat)** - Telegram-style hold-to-record voice notes and camera video messages (optional, opt-in)
- 📍 **[Location Messages](#-whats-new-vs-react-native-gifted-chat)** - Map card that opens the system maps app on tap
- 🎨 **[Fully Customizable](#-props-reference)** - Override any component with your own implementation
- 📎 **[Composer Actions](#actions--action-sheet)** - Attach photos, files, or trigger custom actions
- ↩️ **[Reply to Messages](#reply-to-messages)** - Swipe-to-reply with reply preview and message threading
- ⏮️ **[Load Earlier Messages](#load-earlier-messages)** - Infinite scroll with pagination support
- 📋 **[Copy to Clipboard](#copy-to-clipboard)** - Long-press messages to copy text
- 🔗 **[Smart Link Parsing](#smart-link-parsing)** - Auto-detect URLs, emails, phone numbers, hashtags, mentions
- 👤 **[Avatars](#avatars)** - User initials or custom avatar images
- 🌍 **[Localized Dates](#date--time)** - Full i18n support via Day.js
- ⌨️ **[Keyboard Handling](#keyboard--layout)** - Smart keyboard avoidance for all platforms
- 💬 **[System Messages](#system-messages)** - Display system notifications in chat
- ⚡ **[Quick Replies](#quick-replies)** - Bot-style quick reply buttons
- 😀 **[Emoji Reactions](#emoji-reactions)** - Long-press to react, with reaction pills and an optional full emoji browser
- ✍️ **[Typing Indicator](#typing-indicator)** - Show when users are typing
- ✅ **[Message Status](#message-status)** - Tick indicators for sent/delivered/read states
- ⬇️ **[Scroll to Bottom](#scroll-to-bottom)** - Quick navigation button
- 🌐 **[Web Support](#web-react-native-web)** - Works with react-native-web
- 📱 **[Expo Support](#expo-projects)** - Easy integration with Expo projects
- 📝 **[TypeScript](#typescript)** - Complete TypeScript definitions included

<p align="center">
  <img width="200" src="https://github.com/user-attachments/assets/c9da88f5-0b20-471c-8cd7-373bdb767517" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img width="200" src="https://github.com/user-attachments/assets/f72b17f1-6c2e-43b5-87e7-477011aa3b07" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img width="200" src="https://github.com/user-attachments/assets/86711e73-ee3c-4527-b38d-e4dab47a44fe" />
</p>

---

## 🆕 What's new vs react-native-gifted-chat

This library is kept in sync with upstream [`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat)'s latest `master`, so you **keep everything it already has** - New Architecture support, the animated sticky day header, Reanimated 3/4, Gesture Handler, TypeScript - and the same `IMessage` model and prop names. **Moving over is a package swap plus a rename** (see [Migrating](#-migrating-from-react-native-gifted-chat)).

On top of that, this fork adds the features people kept asking upstream for, plus a modern look out of the box:

| Added in this fork | react-native-gifted-chat | @kesha-antonov/react-native-chat |
| --- | :---: | :---: |
| Active maintenance | 💤 sporadic | ✅ active |
| Modern default UI (Telegram-inspired) | dated 2020 look | ✅ modern, fully overridable |
| Light/Dark **theme system** | per-component color props | ✅ `theme` / `darkTheme` tokens, runtime switch |
| Streaming (AI) messages | ❌ | ✅ token-by-token + typing cursor |
| Emoji reactions | ❌ | ✅ long-press picker + reaction pills |
| Swipe-to-reply + reply preview | ❌ | ✅ built in |
| **Video / audio messages** | "not implemented, render your own" | ✅ inline players + tappable fallback |
| **Voice notes** (hold-to-record + waveform) | ❌ | ✅ optional, Telegram-style |
| **Video messages** (round camera notes) | ❌ | ✅ optional, Telegram-style |
| **Location messages** | ❌ ignored | ✅ map card → opens system maps |
| Bubble tails + tighter message grouping | flat bubbles | ✅ |

Everything new is **non-breaking and opt-in**: keep passing the same props you do today and you simply get the modern look and the extra features for free. The media/recording features only activate when you install their optional peer deps and enable them - nobody is forced to add a single dependency.

### Theming in one line

```jsx
// Modern defaults out of the box, or override any token (light + dark):
<Chat
  theme={{ colors: { accent: '#3390EC', outgoingBubble: '#EFFEDE' } }}
  darkTheme={{ colors: { background: '#0E1621' } }}
  {...props}
/>
```

### Voice, video and location

```jsx
<Chat
  audioRecording={{ isEnabled: true }}   // hold the mic to record a voice note (needs expo-audio)
  videoRecording={{ isEnabled: true }}   // record a video message (needs expo-image-picker)
  // location messages render automatically for any IMessage with a `location`
  {...props}
/>
```

```bash
# Optional inline media playback + recording:
npx expo install expo-video expo-audio expo-image-picker
```

### Custom icons (e.g. Lucide)

Built-in icons are the official [Lucide](https://lucide.dev) glyphs, rendered via the optional `react-native-svg` peer when it is installed, or drawn with `View`s (no dependency) otherwise. Override any of them via the `icons` prop - for example with [`lucide-react-native`](https://lucide.dev/) - and the built-in icon is used for anything you don't override:

```tsx
import { Send, Mic } from 'lucide-react-native'

<Chat
  icons={{
    send: ({ color, size }) => <Send color={color} size={size} />,
    mic:  ({ color, size }) => <Mic color={color} size={size} />,
  }}
  {...props}
/>
```

Overridable names: `send`, `mic`, `camera`, `play`, `pause`, `check`, `checkAll`, `clock`, `pin`, `plus`, `close`, `chevronLeft`, `chevronDown`, `emoji`, `paperclip`, `reply`, `pencil`, `lock`, `trash`.

---

<h3 align="center">Support This Project</h3>

<p align="center">
  I maintain this project in my free time with no compensation. If you find it useful and want to help keep it alive, please consider sponsoring. Your support means a lot! 💖
  <br><br>
  <a href="https://github.com/sponsors/kesha-antonov">
    <img src="https://img.shields.io/badge/Become_a_Sponsor-💖-ea4aaa?style=for-the-badge" alt="Become a Sponsor"/>
  </a>
</p>

---

## 📖 Table of Contents

- [Features](#-features)
- [What's new vs react-native-gifted-chat](#-whats-new-vs-react-native-gifted-chat)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Migrating from react-native-gifted-chat](#-migrating-from-react-native-gifted-chat)
- [Usage](#-usage)
- [Props Reference](#-props-reference)
- [Data Structure](#-data-structure)
- [Platform Notes](#-platform-notes)
- [Performance](#-performance)
- [Example App](#-example-app)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Authors](#-authors)
- [License](#-license)

---

## 📋 Requirements

| Requirement | Version |
|-------------|---------|
| React Native | >= 0.70.0 |
| iOS | >= 13.4 |
| Android | API 21+ (Android 5.0) |
| Expo | SDK 50+ |
| TypeScript | >= 5.0 (optional) |

---

## 📦 Installation

### Expo Projects

```bash
npx expo install react-native-chat react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-keyboard-controller
```

### Bare React Native Projects

**Step 1:** Install the packages

Using yarn:
```bash
yarn add react-native-chat react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-keyboard-controller
```

Using npm:
```bash
npm install --save react-native-chat react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-keyboard-controller
```

**Step 2:** Install iOS pods

```bash
npx pod-install
```

**Step 3:** Configure react-native-reanimated

Follow the [react-native-reanimated installation guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#step-2-add-reanimateds-babel-plugin) to add the Babel plugin.

---

## 🔄 Migrating from react-native-gifted-chat

This library is a rebranded continuation of [`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat), built from its latest `master`. **The API, props, and `IMessage` model are unchanged** - migrating is a package swap plus renaming the `GiftedChat*` identifiers.

```bash
yarn remove react-native-gifted-chat
yarn add @kesha-antonov/react-native-chat
```

| react-native-gifted-chat | @kesha-antonov/react-native-chat |
| --- | --- |
| `react-native-gifted-chat` | `@kesha-antonov/react-native-chat` |
| `GiftedChat` | `Chat` |
| `GiftedAvatar` | `ChatAvatar` |
| `GiftedChatContext` | `ChatContext` |
| `IMessage`, `User`, `useChatContext`, … | unchanged |

See the full guide (codemod included) in **[docs/MIGRATION.md](docs/MIGRATION.md)**.

---

## 🚀 Usage

### Basic Example

```jsx
import React, { useState, useCallback, useEffect } from 'react'
import { Chat } from '@kesha-antonov/react-native-chat'
import { useHeaderHeight } from '@react-navigation/elements'

export function Example() {
  const [messages, setMessages] = useState([])

  // keyboardVerticalOffset = distance from screen top to Chat container
  // useHeaderHeight() returns status bar + navigation header height
  const headerHeight = useHeaderHeight()

  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: 'Hello developer',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'John Doe',
          avatar: 'https://placeimg.com/140/140/any',
        },
      },
    ])
  }, [])

  const onSend = useCallback((messages = []) => {
    setMessages(previousMessages =>
      Chat.append(previousMessages, messages),
    )
  }, [])

  return (
    <Chat
      messages={messages}
      onSend={messages => onSend(messages)}
      user={{
        _id: 1,
      }}
      keyboardAvoidingViewProps={{ keyboardVerticalOffset: headerHeight }}
    />
  )
}
```

> **💡 Tip:** Check out more examples in the [`example`](example) directory including Slack-style messages, quick replies, and custom components.

---

## 📊 Data Structure

Messages, system messages, and quick replies follow the structure defined in [Models.ts](src/Models.ts).

<details>
<summary><strong>Message Object Structure</strong></summary>

```typescript
interface IMessage {
  _id: string | number
  text: string
  createdAt: Date | number
  user: User
  image?: string
  video?: string
  audio?: string
  system?: boolean
  sent?: boolean
  received?: boolean
  pending?: boolean
  /** True while the text is still streaming in (shows a typing cursor) */
  streaming?: boolean
  quickReplies?: QuickReplies
  replyMessage?: ReplyMessage
  reactions?: MessageReaction[]
  location?: {
    latitude: number
    longitude: number
  }
}

interface ReplyMessage {
  _id: string | number
  text: string
  user: User
  image?: string
  audio?: string
}

interface MessageReaction {
  emoji: string
  userIds: (string | number)[]
}

interface User {
  _id: string | number
  name?: string
  avatar?: string | number | (() => React.ReactNode)
}
```

</details>

---

## 📖 Props Reference

### Core Configuration

- **`messages`** _(Array)_ - Messages to display
- **`user`** _(Object)_ - User sending the messages: `{ _id, name, avatar }`
- **`onSend`** _(Function)_ - Callback when sending a message
- **`messageIdGenerator`** _(Function)_ - Generate an id for new messages. Defaults to a simple random string generator.
- **`locale`** _(String)_ - Locale to localize the dates. You need first to import the locale you need (ie. `require('dayjs/locale/de')` or `import 'dayjs/locale/fr'`)
- **`colorScheme`** _('light' | 'dark')_ - Force color scheme (light/dark mode). When set to `'light'` or `'dark'`, it overrides the system color scheme. When `undefined`, it uses the system color scheme. Default is `undefined`.
- **`theme`** _(Object)_ - Override the default light theme tokens (`colors` / `radii` / `spacing` / `typography` / `avatar` / `sendButton` / `composer` / `voice`). Deep-merged over `defaultLightTheme`; any subset is allowed. See [Theming & Dark Mode](#theming--dark-mode).
- **`darkTheme`** _(Object)_ - Same as `theme`, applied when the resolved color scheme is dark (deep-merged over `defaultDarkTheme`).
- **`icons`** _(Object)_ - Icon override registry. Supply a render function for any built-in icon to replace it (e.g. with `lucide-react-native`). See [Custom icons](#custom-icons-eg-lucide).
- **`labels`** _(Object)_ - Override any UI string. See [Localization (i18n)](#localization-i18n).

### Refs

- **`messagesContainerRef`** _(FlatList ref)_ - Ref to the flatlist
- **`textInputRef`** _(TextInput ref)_ - Ref to the text input

### Keyboard & Layout

- **`keyboardProviderProps`** _(Object)_ - Props to be passed to the [`KeyboardProvider`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/keyboard-provider) for keyboard handling. Default values:
  - `statusBarTranslucent: true` - Required on Android for correct keyboard height calculation when status bar is translucent (edge-to-edge mode)
  - `navigationBarTranslucent: true` - Required on Android for correct keyboard height calculation when navigation bar is translucent (edge-to-edge mode)
- **`keyboardAvoidingViewProps`** _(Object)_ - Props to be passed to the [`KeyboardAvoidingView`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view). See **keyboardVerticalOffset** below for proper keyboard handling.
- **`isAlignedTop`** _(Boolean)_ Controls whether or not the message bubbles appear at the top of the chat (Default is false - bubbles align to bottom)
- **`isInverted`** _(Bool)_ - Reverses display order of `messages`; default is `true`

#### Understanding `keyboardVerticalOffset`

The [`keyboardVerticalOffset`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view#keyboardverticaloffset) tells the KeyboardAvoidingView where its container starts relative to the top of the screen. This is essential when Chat is not positioned at the very top of the screen (e.g., when you have a navigation header).

**Default value:** `insets.top` (status bar height from `useSafeAreaInsets()`). This works correctly only when Chat fills the entire screen without a navigation header. If you have a navigation header, you need to pass the correct offset via `keyboardAvoidingViewProps`.

**What the value means:** The offset equals the distance (in points) from the top of the screen to the top of your Chat container. This typically includes:
- Status bar height
- Navigation header height (on iOS, `useHeaderHeight()` already includes status bar)

**How to use:**

```jsx
import { useHeaderHeight } from '@react-navigation/elements'

function ChatScreen() {
  // useHeaderHeight() returns status bar + navigation header height on iOS
  const headerHeight = useHeaderHeight()

  return (
    <Chat
      keyboardAvoidingViewProps={{ keyboardVerticalOffset: headerHeight }}
      // ... other props
    />
  )
}
```

> **Note:** `useHeaderHeight()` requires your chat component to be rendered inside a proper navigation screen (not conditional rendering). If it returns `0`, ensure your chat screen is a real navigation screen with a visible header.

**Why this matters:** Without the correct offset, the keyboard may overlap the input field or leave extra space. The KeyboardAvoidingView uses this value to calculate how much to shift the content when the keyboard appears.

### Text Input & Composer

- **`text`** _(String)_ - Input text; default is `undefined`, but if specified, it will override Chat's internal state. Useful for managing text state outside of Chat (e.g. with Redux). Don't forget to implement `textInputProps.onChangeText` to update the text state.
- **`initialText`** _(String)_ - Initial text to display in the input field
- **`isSendButtonAlwaysVisible`** _(Bool)_ - Always show send button in input text composer; default `false`, show only when text input is not empty
- **`isTextOptional`** _(Bool)_ - Allow sending messages without text (useful for media-only messages); default `false`. Use with `isSendButtonAlwaysVisible` for media attachments.
- **`minComposerHeight`** _(Object)_ - Custom min-height of the composer.
- **`maxComposerHeight`** _(Object)_ - Custom max height of the composer.
- **`minInputToolbarHeight`** _(Integer)_ - Minimum height of the input toolbar; default is `44`
- **`renderInputToolbar`** _(Component | Function)_ - Custom message composer container
- **`renderComposer`** _(Component | Function)_ - Custom text input message composer
- **`renderSend`** _(Component | Function)_ - Custom send button; you can pass children to the original `Send` component quite easily, for example, to use a custom icon ([example](https://github.com/kesha-antonov/react-native-chat/pull/487))
- **`renderActions`** _(Component | Function)_ - Custom action button on the left of the message composer
- **`renderAccessory`** _(Component | Function)_ - Custom second line of actions below the message composer
- **`onPressEmoji`** _(Function)_ - Callback for the optional emoji button on the left of the composer field. When omitted, the emoji button is hidden.
- **`audioRecording`** _(Object)_ - Enable Telegram-style hold-to-record voice notes. `{ isEnabled, minDurationMs?, onError? }`. Requires the optional `expo-audio` peer (and `react-native-audio-api` for the playback waveform); the mic button is hidden when it is absent.
- **`videoRecording`** _(Object)_ - Enable record-and-send video messages. `{ isEnabled, maxDuration?, onError? }`. Uses `react-native-vision-camera` for round camera notes, falling back to `expo-image-picker`'s system camera.
- **`textInputProps`** _(Object)_ - props to be passed to the [`<TextInput>`](https://reactnative.dev/docs/textinput).

### Actions & Action Sheet

- **`actions`** _(Array)_ - Action options for the composer "+" button. Array of `{ title, action }`; add `icon` (and optional `color`) to an action to render a Telegram-style attachment **grid** (tiles) instead of a list. Opens the built-in themed `AttachmentSheet` - no extra dependency.
- **`onPressActionButton`** _(Function)_ - Callback when the "+" button is pressed (if set, the built-in `AttachmentSheet` is not shown)
- **`actionSheet`** _(Function)_ - Escape hatch for a custom system action sheet. **The bundled `@expo/react-native-action-sheet` dependency was removed**, so `context.actionSheet()` defaults to a no-op; pass your own implementation (with `ActionSheetProvider` in your tree) if you relied on it.
- **`actionSheetOptionTintColor`** _(String)_ - Tint color for action labels in the attachment sheet

### Messages & Message Container

- **`messagesContainerStyle`** _(Object)_ - Custom style for the messages container
- **`renderMessage`** _(Component | Function)_ - Custom message container
- **`renderLoading`** _(Component | Function)_ - Render a loading view when initializing
- **`renderChatEmpty`** _(Component | Function)_ - Custom component to render in the ListView when messages are empty
- **`renderChatFooter`** _(Component | Function)_ - Custom component to render below the MessagesContainer (separate from the ListView)
- **`listProps`** _(Object)_ - Extra props to be passed to the messages [`<FlatList>`](https://reactnative.dev/docs/flatlist). Supports all FlatList props including `maintainVisibleContentPosition` for keeping scroll position when new messages arrive (useful for AI chatbots).
- **`isFlashListEnabled`** _(Bool)_ - Render messages with [`@shopify/flash-list`](https://shopify.github.io/flash-list/) v2 instead of `FlatList`; default is `false`. See [FlashList](#flashlist-opt-in).

### Message Bubbles & Content

- **`renderBubble`** _(Component | Function(`props: BubbleProps`))_ - Custom message bubble. Receives [BubbleProps](src/Bubble/types.ts) as parameter.
- **`renderMessageText`** _(Component | Function)_ - Custom message text
- **`renderMessageImage`** _(Component | Function)_ - Custom message image
- **`renderMessageVideo`** _(Component | Function)_ - Custom message video
- **`renderMessageAudio`** _(Component | Function)_ - Custom message audio
- **`renderMessageLocation`** _(Component | Function)_ - Custom renderer for `IMessage.location`; defaults to a map card that opens the system maps app on tap
- **`messageActions`** _(Array | Function(`message`))_ - Telegram-style long-press context menu. Each item is `{ label, icon?, onPress, destructive? }`. See [Message actions](#message-actions-long-press-context-menu).
- **`renderCustomView`** _(Component | Function)_ - Custom view inside the bubble
- **`isCustomViewBottom`** _(Bool)_ - Determine whether renderCustomView is displayed before or after the text, image and video views; default is `false`
- **`onPressMessage`** _(Function(`context`, `message`))_ - Callback when a message bubble is pressed
- **`onLongPressMessage`** _(Function(`context`, `message`))_ - Callback when a message bubble is long-pressed; you can use this to show action sheets (e.g., copy, delete, reply)
- **`isMessageGestureEnabled`** _(Bool | Function(`message`))_ - Whether the bubble itself is part of the row's tap / long-press surface that `reactions` and `messageActions` rely on; default is `true`. Pass `false`, or a predicate, for messages that render natively interactive content - the row beside the bubble stays pressable either way. See [Interactive content inside bubbles](#interactive-content-inside-bubbles-video-players-maps).
- **`imageProps`** _(Object)_ - Extra props to be passed to the [`<Image>`](https://reactnative.dev/docs/image) component created by the default `renderMessageImage`
- **`imageStyle`** _(Object)_ - Custom style for message images
- **`videoProps`** _(Object)_ - Extra props to be passed to the video component created by the required `renderMessageVideo`
- **`messageTextProps`** _(Object)_ - Extra props to be passed to the MessageText component. Useful for customizing link parsing behavior, text styles, and matchers. Supports the following props:
  - `matchers` - Custom matchers for linking message content (like URLs, phone numbers, hashtags, mentions)
  - `linkStyle` - Custom style for links
  - `email` - Enable/disable email parsing (default: true)
  - `phone` - Enable/disable phone number parsing (default: true)
  - `url` - Enable/disable URL parsing (default: true)
  - `hashtag` - Enable/disable hashtag parsing (default: false)
  - `mention` - Enable/disable mention parsing (default: false)
  - `hashtagUrl` - Base URL for hashtags (e.g., 'https://x.com/hashtag')
  - `mentionUrl` - Base URL for mentions (e.g., 'https://x.com')
  - `stripPrefix` - Strip 'http://' or 'https://' from URL display (default: false)
  - `TextComponent` - Custom Text component to use (e.g., from react-native-gesture-handler)

Example:

```tsx
<Chat
  messageTextProps={{
    phone: false, // Disable default phone number linking
    matchers: [
      {
        type: 'phone',
        pattern: /\+?[1-9][0-9\-\(\) ]{7,}[0-9]/g,
        getLinkUrl: (replacerArgs: ReplacerArgs): string => {
          return replacerArgs[0].replace(/[\-\(\) ]/g, '')
        },
        getLinkText: (replacerArgs: ReplacerArgs): string => {
          return replacerArgs[0]
        },
        style: styles.linkStyle,
        onPress: (match: CustomMatch) => {
          const url = match.getAnchorHref()

          const options: {
            title: string
            action?: () => void
          }[] = [
            { title: 'Copy', action: () => setStringAsync(url) },
            { title: 'Call', action: () => Linking.openURL(`tel:${url}`) },
            { title: 'Send SMS', action: () => Linking.openURL(`sms:${url}`) },
            { title: 'Cancel' },
          ]

          showActionSheetWithOptions({
            options: options.map(o => o.title),
            cancelButtonIndex: options.length - 1,
          }, (buttonIndex?: number) => {
            if (buttonIndex === undefined)
              return

            const option = options[buttonIndex]
            option.action?.()
          })
        },
      },
    ],
    linkStyle: { left: { color: 'blue' }, right: { color: 'lightblue' } },
  }}
/>
```

See full example in [LinksExample](example/components/chat-examples/LinksExample.tsx)

### Avatars

- **`renderAvatar`** _(Component | Function)_ - Custom message avatar; set to `null` to not render any avatar for the message
- **`isUserAvatarVisible`** _(Bool)_ - Whether to render an avatar for the current user; default is `false`, only show avatars for other users
- **`isAvatarVisibleForEveryMessage`** _(Bool)_ - When false, avatars will only be displayed when a consecutive message is from the same user on the same day; default is `false`
- **`onPressAvatar`** _(Function(`user`))_ - Callback when a message avatar is tapped
- **`onLongPressAvatar`** _(Function(`user`))_ - Callback when a message avatar is long-pressed
- **`isAvatarOnTop`** _(Bool)_ - Render the message avatar at the top of consecutive messages, rather than the bottom; default is `false`

### Username

- **`isUsernameVisible`** _(Bool)_ - Indicate whether to show the user's username inside the message bubble; default is `false`
- **`renderUsername`** _(Component | Function)_ - Custom Username container

### Date & Time

- **`timeFormat`** _(String)_ - Format to use for rendering times; default is `'LT'` (see [Day.js Format](https://day.js.org/docs/en/display/format))
- **`dateFormat`** _(String)_ - Format to use for rendering dates; default is `'D MMMM'` (see [Day.js Format](https://day.js.org/docs/en/display/format))
- **`dateFormatCalendar`** _(Object)_ - Format to use for rendering relative times; default is `{ sameDay: '[Today]' }` (see [Day.js Calendar](https://day.js.org/docs/en/plugin/calendar))
- **`renderDay`** _(Component | Function)_ - Custom day above a message
- **`dayProps`** _(Object)_ - Props to pass to the Day component:
  - `containerStyle` - Custom style for the day container
  - `wrapperStyle` - Custom style for the day wrapper
  - `textProps` - Props to pass to the Text component (e.g., `style`, `allowFontScaling`, `numberOfLines`)
- **`renderTime`** _(Component | Function)_ - Custom time inside a message
- **`timeTextStyle`** _(Object)_ - Custom text style for time inside messages (supports left/right styles)
- **`isDayAnimationEnabled`** _(Bool)_ - Enable animated day label that appears on scroll; default is `true`

### System Messages

- **`renderSystemMessage`** _(Component | Function)_ - Custom system message

### Load Earlier Messages

- **`loadEarlierMessagesProps`** _(Object)_ - Props to pass to the LoadEarlierMessages component. The button is only visible when `isAvailable` is `true`. Supports the following props:
  - `isAvailable` - Controls button visibility (default: false)
  - `onPress` - Callback when button is pressed
  - `isLoading` - Display loading indicator (default: false)
  - `isInfiniteScrollEnabled` - Enable infinite scroll up when reaching the top of messages container, automatically calls `onPress` (not yet supported for web)
  - `label` - Override the default "Load earlier messages" text
  - `containerStyle` - Custom style for the button container
  - `wrapperStyle` - Custom style for the button wrapper
  - `textStyle` - Custom style for the button text
  - `activityIndicatorStyle` - Custom style for the loading indicator
  - `activityIndicatorColor` - Color of the loading indicator (default: 'white')
  - `activityIndicatorSize` - Size of the loading indicator (default: 'small')
- **`renderLoadEarlier`** _(Component | Function)_ - Custom "Load earlier messages" button

### Typing Indicator

- **`isTyping`** _(Bool)_ - Typing Indicator state; default `false`. If you use`renderFooter` it will override this.
- **`renderTypingIndicator`** _(Component | Function)_ - Custom typing indicator component
- **`typingIndicatorStyle`** _(StyleProp<ViewStyle>)_ - Custom style for the TypingIndicator component.
- **`renderFooter`** _(Component | Function)_ - Custom footer component on the ListView, e.g. `'User is typing...'`; see [CustomizedFeaturesExample.tsx](example/components/chat-examples/CustomizedFeaturesExample.tsx) for an example. Overrides default typing indicator that triggers when `isTyping` is true.

### Quick Replies

See [Quick Replies example in messages.ts](example/example-expo/data/messages.ts)

- **`onQuickReply`** _(Function)_ - Callback when sending a quick reply (to backend server)
- **`renderQuickReplies`** _(Function)_ - Custom all quick reply view
- **`quickReplyStyle`** _(StyleProp<ViewStyle>)_ - Custom quick reply view style
- **`quickReplyTextStyle`** _(StyleProp<TextStyle>)_ - Custom text style for quick reply buttons
- **`quickReplyContainerStyle`** _(StyleProp<ViewStyle>)_ - Custom container style for quick replies
- **`renderQuickReplySend`** _(Function)_ - Custom quick reply **send** view

### Reply to Messages

React Native Chat supports swipe-to-reply functionality out of the box. When enabled, users can swipe on a message to reply to it, displaying a reply preview in the input toolbar and the replied message above the new message bubble.

> **Note:** This feature uses `ReanimatedSwipeable` from `react-native-gesture-handler` and `react-native-reanimated` for smooth, performant animations.

#### Basic Usage

```tsx
<Chat
  messages={messages}
  onSend={onSend}
  user={{ _id: 1 }}
  reply={{
    swipe: {
      isEnabled: true,
      direction: 'left', // swipe left to reply
    },
  }}
/>
```

#### Reply Props (Grouped)

The `reply` prop accepts an object with the following structure:

```typescript
interface ReplyProps<TMessage> {
  // Swipe gesture configuration
  swipe?: {
    isEnabled?: boolean              // Enable swipe-to-reply; default false
    direction?: 'left' | 'right'     // Swipe direction; default 'left'
    onSwipe?: (message: TMessage) => void  // Callback when swiped
    renderAction?: (                 // Custom swipe action component
      progress: SharedValue<number>,
      translation: SharedValue<number>,
      position: 'left' | 'right'
    ) => React.ReactNode
    actionContainerStyle?: StyleProp<ViewStyle>
  }

  // Reply preview styling (above input toolbar)
  previewStyle?: {
    containerStyle?: StyleProp<ViewStyle>
    textStyle?: StyleProp<TextStyle>
    imageStyle?: StyleProp<ImageStyle>
  }

  // In-bubble reply styling
  messageStyle?: {
    containerStyle?: StyleProp<ViewStyle>
    containerStyleLeft?: StyleProp<ViewStyle>
    containerStyleRight?: StyleProp<ViewStyle>
    textStyle?: StyleProp<TextStyle>
    textStyleLeft?: StyleProp<TextStyle>
    textStyleRight?: StyleProp<TextStyle>
    imageStyle?: StyleProp<ImageStyle>
  }

  // Callbacks and state
  message?: ReplyMessage             // Controlled reply state
  onClear?: () => void               // Called when reply cleared
  onPress?: (message: TMessage) => void  // Called when reply preview tapped

  // Custom renderers
  renderPreview?: (props: ReplyPreviewProps) => React.ReactNode
  renderMessageReply?: (props: MessageReplyProps) => React.ReactNode
}
```

#### ReplyMessage Structure

When a message has a reply, it includes a `replyMessage` property:

```typescript
interface ReplyMessage {
  _id: string | number
  text: string
  user: User
  image?: string
  audio?: string
}
```

#### Advanced Example with External State

```tsx
const [replyMessage, setReplyMessage] = useState<ReplyMessage | null>(null)

<Chat
  messages={messages}
  onSend={messages => {
    const newMessages = messages.map(msg => ({
      ...msg,
      replyMessage: replyMessage || undefined,
    }))
    setMessages(prev => Chat.append(prev, newMessages))
    setReplyMessage(null)
  }}
  user={{ _id: 1 }}
  reply={{
    swipe: {
      isEnabled: true,
      direction: 'right',
      onSwipe: setReplyMessage,
    },
    message: replyMessage,
    onClear: () => setReplyMessage(null),
    onPress: (msg) => scrollToMessage(msg._id),
  }}
/>
```

#### Smooth Animations

The reply preview automatically animates when:
- **Appearing**: Smoothly expands from zero height with fade-in effect
- **Disappearing**: Smoothly collapses with fade-out effect
- **Content changes**: Smoothly transitions when replying to a different message

These animations use `react-native-reanimated` for 60fps performance.

### Scroll to Bottom

- **`isScrollToBottomEnabled`** _(Bool)_ - Enables the scroll to bottom Component (Default is false)
- **`scrollToBottomComponent`** _(Function)_ - Custom Scroll To Bottom Component container
- **`scrollToBottomOffset`** _(Integer)_ - Custom Height Offset upon which to begin showing Scroll To Bottom Component (Default is 200)
- **`scrollToBottomStyle`** _(Object)_ - Custom style for Scroll To Bottom wrapper (position, bottom, right, etc.)
- **`scrollToBottomContentStyle`** _(Object)_ - Custom style for Scroll To Bottom content (size, background, shadow, etc.)

### Maintaining Scroll Position (AI Chatbots)

For AI chat interfaces where long responses arrive and you don't want to disrupt the user's reading position, use [`maintainVisibleContentPosition`](https://reactnative.dev/docs/scrollview#maintainvisiblecontentposition) via `listProps`:

```tsx
// Basic usage - always maintain scroll position
<Chat
  listProps={{
    maintainVisibleContentPosition: {
      minIndexForVisible: 0,
    },
  }}
/>

// With auto-scroll threshold - auto-scroll if within 10 pixels of newest content
<Chat
  listProps={{
    maintainVisibleContentPosition: {
      minIndexForVisible: 0,
      autoscrollToTopThreshold: 10,
    },
  }}
/>

// Conditionally enable based on scroll state (recommended for chatbots)
const [isScrolledUp, setIsScrolledUp] = useState(false)

<Chat
  listProps={{
    onScroll: (event) => {
      setIsScrolledUp(event.contentOffset.y > 50)
    },
    maintainVisibleContentPosition: isScrolledUp
      ? { minIndexForVisible: 0, autoscrollToTopThreshold: 10 }
      : undefined,
  }}
/>
```

### Streaming (AI) Messages

Render AI assistant replies token-by-token. The library batches incoming chunks with `requestAnimationFrame` (one render per frame, only the streaming bubble re-renders) and shows a blinking caret while a message is still streaming.

<p align="center">
  <img width="250" src="https://raw.githubusercontent.com/kesha-antonov/react-native-chat/main/media/ai-streaming-markdown.png" alt="AI reply streaming token-by-token and rendering as markdown, with a blinking caret and a Stop button in the composer" />
</p>

> The reply above streams in token-by-token (note the caret `▋`) and renders as **markdown** - bold, italics, lists, inline and fenced code - while the composer's send button turns into a **Stop** control mid-stream. See [Markdown rendering for AI replies](#markdown-rendering-for-ai-replies) to enable markdown.

- **`IMessage.streaming`** - flag a message as streaming (shows the caret)
- **`Chat.updateMessage(messages, id, patch)`** - immutable per-message update, cheap enough for per-token appends
- **`useStreamingMessages(...)`** - owns the message list, rAF-batches `push()`, and supports stop via `AbortController`

```tsx
import { useCallback } from 'react'
import { Chat, IMessage, useStreamingMessages } from '@kesha-antonov/react-native-chat'

function Bot () {
  const { messages, append, startStream, isStreaming, stop } = useStreamingMessages<IMessage>()

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    append(newMessages[0])                      // show the user's message
    const stream = startStream({ user: { _id: 2, name: 'Assistant' } }) // empty streaming bubble

    runMyModel(newMessages[0].text, {
      signal: stream.signal,                    // aborts when stop() is called
      onToken: token => stream.push(token),     // batched, one render per frame
      onDone: () => stream.done(),              // clears the streaming flag
    })
  }, [append, startStream])

  return <Chat messages={messages} onSend={onSend} user={{ _id: 1 }} />
}
```

See **[docs/STREAMING.md](./docs/STREAMING.md)** for the full hook API and a real Claude streaming adapter (via a backend proxy). A runnable demo lives in `example/components/chat-examples/AIBotExample.tsx`.

#### Markdown rendering for AI replies

AI/LLM replies are usually markdown (bold, lists, fenced code). Enable markdown with `messageTextProps={{ markdown: true }}` (streamed messages auto-render as markdown unless you pass `markdown={false}`):

```tsx
// Force markdown for every message:
<Chat messageTextProps={{ markdown: true }} {...props} />

// Streamed messages auto-render as markdown; disable with markdown: false.
```

There are two renderers and you get the best available one automatically:

- **Built-in, zero-dependency renderer** (default). Covers headings, bullet/ordered lists, blockquotes, fenced + inline code, bold/italic/strikethrough, and links. It handles streaming-incomplete markdown gracefully (a half-written `**bold` or an unclosed code fence renders as plain text until complete), so it's safe to feed token-by-token. Nothing to install. Exposed as `BasicMarkdown` if you want to use it directly.

- **[`react-native-streamdown`](https://github.com/software-mansion-labs/react-native-streamdown)** (optional upgrade). When installed it's used instead, for richer streaming-safe markdown (tables, partial-table handling, etc.). It is a native module with its own peers - install the full set:

  ```bash
  npx expo install react-native-streamdown react-native-enriched-markdown remend katex
  ```

  It also requires `react-native-worklets >= 0.8.3` (i.e. `react-native-reanimated >= 4.3`), and `react-native-enriched-markdown` is a native module, so a dev build / prebuild is required (it does not work in Expo Go). Pass through Streamdown's own theming/rules via `markdownProps`:

  ```tsx
  <Chat messageTextProps={{ markdown: true, markdownProps: { /* ... */ } }} {...props} />
  ```

### Emoji Reactions

Long-press a message to open a quick emoji picker; selected reactions render as pills below the bubble and toggle on tap. The core ships a lightweight quick picker (built on `react-native-gesture-handler` and `react-native-reanimated`, no extra dependencies). A full emoji browser is optional and demonstrated in the example app via the `renderReactionPicker` override.

<p align="center">
  <img width="200" src="https://raw.githubusercontent.com/kesha-antonov/react-native-chat/main/media/reactions-picker.png" />
  &nbsp;&nbsp;
  <img width="200" src="https://raw.githubusercontent.com/kesha-antonov/react-native-chat/main/media/reactions-pills.png" />
  &nbsp;&nbsp;
  <img width="200" src="https://raw.githubusercontent.com/kesha-antonov/react-native-chat/main/media/reactions-emoji-browser.png" />
</p>

Store reactions on each message as a `reactions` array, then enable the feature and handle the toggle. Reaction state is owned by you, so it works with any backend:

```tsx
interface IChatMessage extends IMessage {
  reactions?: MessageReaction[] // { emoji: string, userIds: (string | number)[] }[]
}

const CURRENT_USER_ID = 1

const handleReactionPress = useCallback((message: IChatMessage, emoji: string) => {
  setMessages(prev =>
    prev.map(m => {
      if (m._id !== message._id)
        return m

      const existing = (m.reactions ?? []).find(r => r.emoji === emoji)
      if (!existing)
        return { ...m, reactions: [...(m.reactions ?? []), { emoji, userIds: [CURRENT_USER_ID] }] }

      const userIds = existing.userIds.includes(CURRENT_USER_ID)
        ? existing.userIds.filter(id => id !== CURRENT_USER_ID)
        : [...existing.userIds, CURRENT_USER_ID]

      return {
        ...m,
        reactions: userIds.length === 0
          ? (m.reactions ?? []).filter(r => r.emoji !== emoji)
          : (m.reactions ?? []).map(r => (r.emoji === emoji ? { ...r, userIds } : r)),
      }
    })
  )
}, [])

<Chat
  messages={messages}
  onSend={onSend}
  user={{ _id: CURRENT_USER_ID }}
  reactions={{
    isEnabled: true,
    onReactionPress: handleReactionPress,
    // Optional: provide a richer picker (e.g. a full emoji browser).
    // See example/components/chat-examples/ReactionsExample.tsx
    // renderReactionPicker: props => <MyEmojiPicker {...props} />,
  }}
/>
```

#### Reactions Props (Grouped)

The `reactions` prop accepts:

- **`isEnabled`** _(Bool)_ - Enable emoji reactions (default `false`)
- **`emojis`** _(String[])_ - Emojis shown in the quick picker (default `['👍', '❤️', '😂', '😮', '😢', '👎']`)
- **`onReactionPress`** _(Function)_ - `(message, emoji) => void` called when an emoji is selected or a pill is tapped. Toggle logic is left to you
- **`renderReactions`** _(Function)_ - Override the reactions-display component rendered below the bubble
- **`renderReactionPicker`** _(Function)_ - Override the picker shown on long-press (use for a full emoji browser)
- **`containerStyle`**, **`reactionStyle`**, **`reactionActiveStyle`**, **`reactionTextStyle`**, **`reactionCountStyle`** - Styles for the reaction pills
- **`pickerContainerStyle`**, **`pickerEmojiStyle`** - Styles for the quick picker

### Smart Link Parsing

Message text is automatically scanned for URLs, emails, and phone numbers; hashtags and mentions are opt-in. Configure it via `messageTextProps`:

```tsx
<Chat
  messageTextProps={{
    url: true,        // default true
    email: true,      // default true
    phone: true,      // default true
    hashtag: true,    // default false
    mention: true,    // default false
    hashtagUrl: 'https://example.com/hashtag',
    mentionUrl: 'https://example.com',
    linkStyle: { left: { color: '#1d9bf0' }, right: { color: '#fff' } },
    onPress: (message, url, type) => {
      // type: 'url' | 'email' | 'phone' | 'mention' | 'hashtag'
      Linking.openURL(url)
    },
  }}
/>
```

For full control, pass custom `matchers` (`{ type, pattern, getLinkUrl?, getLinkText?, renderLink?, onPress? }[]`) to add or override patterns. See the Links example in the [example app](#-example-app).

### Message actions (long-press context menu)

Long-press a message to open a floating, themed **context menu** (Telegram style) anchored to the bubble. Provide the actions via `messageActions` - an array, or a function of the message - each `{ label, icon?, onPress, destructive? }`. When reactions are enabled, a reactions row is shown on top of the menu automatically.

```tsx
import { setStringAsync } from 'expo-clipboard'
import { Copy, Trash2 } from 'lucide-react-native' // optional icons

<Chat
  messageActions={message => [
    { label: 'Copy', icon: ({ color, size }) => <Copy color={color} size={size} />, onPress: () => setStringAsync(message.text) },
    { label: 'Delete', destructive: true, onPress: () => deleteMessage(message) },
  ]}
/>
```

### Interactive content inside bubbles (video players, maps)

When `reactions` or `messageActions` are enabled, the long-press surface spans the **whole message row** - the bubble *and* the empty space beside it, the way Telegram behaves on Android. (A tap gesture is added on top only when `onPressMessage` is set.) Those recognizers do not cancel touches on native subviews, so a `react-native-video` / `expo-video` player rendered through `renderMessageVideo` keeps its native `controls` interactive.

If a message must own every touch that lands on it, set `isMessageGestureEnabled` to `false` for it. The gesture surface then drops *behind* the bubble: the bubble's content takes its touches, and long-pressing the row next to the bubble still opens the picker - so reactions are never lost for that message.

```tsx
<Chat
  reactions={{ isEnabled: true, onReactionPress }}
  renderMessageVideo={props => <Video source={{ uri: props.currentMessage.video }} controls style={styles.video} />}
  // the video owns its controls; long-press beside the bubble still reacts
  isMessageGestureEnabled={message => !message.video}
/>
```

> **Note:** This library no longer depends on `@expo/react-native-action-sheet`. Prefer `messageActions` above. If you specifically want a native action sheet, install it yourself, wrap your tree in `ActionSheetProvider`, and either call `useActionSheet()` in your own `onLongPressMessage` or pass an `actionSheet` prop - the `actionSheet` prop / `context.actionSheet()` escape hatch still works when you provide an implementation. The composer "+" actions use the built-in themed `AttachmentSheet` and need no setup.

### Theming & Dark Mode

The chat ships with a modern default look and a full token-based theme. Override any subset of tokens via `theme` (light) and `darkTheme` (dark); your overrides are deep-merged over `defaultLightTheme` / `defaultDarkTheme`, and the resolved theme switches at runtime with the color scheme (system, or forced via `colorScheme`). Explicit per-component style props still win over the theme.

```tsx
<Chat
  theme={{
    colors: { accent: '#3390EC', outgoingBubble: '#EFFEDE' },
    radii: { bubble: 18 },
  }}
  darkTheme={{ colors: { background: '#0E1621', incomingBubble: '#182533' } }}
  // colorScheme="dark"   // optional: force a scheme instead of following the system
  {...props}
/>
```

Token groups: `colors`, `radii`, `spacing`, `typography`, `avatar`, `sendButton`, `composer`, `voice`. Build your own theme-aware components with the exported hooks:

```tsx
import { useTheme, useThemedStyles } from '@kesha-antonov/react-native-chat'
import { StyleSheet } from 'react-native'

const MyBadge = () => {
  const theme = useTheme()
  const styles = useThemedStyles(t => StyleSheet.create({
    badge: { backgroundColor: t.colors.accent, borderRadius: t.radii.bubble },
  }))
  return <View style={styles.badge} />
}
```

Also exported: `defaultLightTheme`, `defaultDarkTheme`, and the `ChatTheme` / `PartialChatTheme` types.

### Localization (i18n)

All built-in UI strings (composer placeholder, send/cancel, load earlier, today, voice/video/location labels, slide-to-cancel, reply/edit banner, camera-permission text) route through a label table. Built-in translations ship for `en`, `es`, `fr`, `de`, and `ru`, selected by the existing `locale` prop. Override any individual string with `labels`:

```tsx
<Chat
  locale="fr"                       // pick a built-in translation
  labels={{ placeholder: 'Votre message...' }}  // override any string
  {...props}
/>
```

Exported helpers: `ChatLabels` (type), `defaultLabels`, `translations`, `resolveLabels`, and the `useLabels` hook for reading the resolved labels in custom components.

### Message Status

Set `sent`, `received`, or `pending` on a message to show its delivery status. By default these render as tick indicators next to the timestamp (`✓` sent, `✓✓` received, `🕓` pending):

```tsx
const message: IMessage = {
  _id: 1,
  text: 'Delivered!',
  createdAt: new Date(),
  user: { _id: 1 },
  sent: true,
  received: true,
}
```

Customize the indicators with `renderTicks` (full override) or `tickStyle` (style only):

```tsx
<Chat
  renderTicks={message => (message.received ? <MyReadIcon /> : null)}
  tickStyle={{ color: '#1d9bf0' }}
/>
```

### TypeScript

Chat ships complete type definitions and is generic over your message type. Extend `IMessage` to add custom fields and everything stays typed end to end:

```tsx
import { Chat, IMessage } from '@kesha-antonov/react-native-chat'

interface MyMessage extends IMessage {
  reactions?: { emoji: string, userIds: (string | number)[] }[]
}

<Chat<MyMessage>
  messages={messages}
  onSend={msgs => {/* msgs is typed as MyMessage[] */}}
  user={{ _id: 1 }}
/>
```

---


---

## 📱 Platform Notes

### Android

<details>
<summary><strong>Keyboard configuration</strong></summary>

If you are using Create React Native App / Expo, no Android specific installation steps are required. Otherwise, we recommend modifying your project configuration:

Make sure you have `android:windowSoftInputMode="adjustResize"` in your `AndroidManifest.xml`:

```xml
<activity
  android:name=".MainActivity"
  android:label="@string/app_name"
  android:windowSoftInputMode="adjustResize"
  android:configChanges="keyboard|keyboardHidden|orientation|screenSize">
```

For **Expo**, you can append `KeyboardAvoidingView` after Chat (Android only):

```jsx
<View style={{ flex: 1 }}>
   <Chat />
   {Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}
</View>
```

</details>

### Web (react-native-web)

<details>
<summary><strong>With create-react-app</strong></summary>

1. Install react-app-rewired: `yarn add -D react-app-rewired`
2. Create `config-overrides.js`:

```js
module.exports = function override(config, env) {
  config.module.rules.push({
    test: /\.js$/,
    exclude: /node_modules[/\\](?!react-native-chat)/,
    use: {
      loader: 'babel-loader',
      options: {
        babelrc: false,
        configFile: false,
        presets: [
          ['@babel/preset-env', { useBuiltIns: 'usage' }],
          '@babel/preset-react',
        ],
        plugins: ['@babel/plugin-proposal-class-properties'],
      },
    },
  })
  return config
}
```

</details>

---

## ⚡ Performance

The chat is built for long lists, but a few habits on your side unlock the most:

**Memoize your render props and config.** Each message row is wrapped in `React.memo` with a comparator that deep-compares the message and reference-compares every other prop. So an unchanged row only skips a re-render when the props you pass it are referentially stable. If you pass inline functions or objects, that row re-renders on every parent render:

```jsx
// ❌ New reference every render - the row can't skip
<Chat renderBubble={props => <MyBubble {...props} />} reactions={{ isEnabled: true, onReactionPress }} />

// ✅ Stable references - unchanged rows skip re-renders
const renderBubble = useCallback(props => <MyBubble {...props} />, [])
const reactions = useMemo(() => ({ isEnabled: true, onReactionPress }), [onReactionPress])
const messageActions = useCallback(message => [{ label: 'Copy', onPress: () => copy(message.text) }], [copy])

<Chat renderBubble={renderBubble} reactions={reactions} messageActions={messageActions} />
```

This applies to all render props (`renderBubble`, `renderMessageText`, `renderAvatar`, ...), the `reactions` / `audioRecording` / `videoRecording` / `messageActions` config objects, and any style objects.

**Keep messages immutable.** Update messages by creating new arrays/objects (e.g. `Chat.append(...)`), never by mutating an existing message in place - the row comparator relies on value changes to detect updates.

**Theme, icons and labels don't need drilling.** `theme` / `darkTheme`, `icons`, and `labels` are read from context (`useTheme`, `useIcons`, `useLabels`), so passing them once on `<Chat>` is enough; they don't cause per-row churn.

**Tune virtualization if needed.** Sensible `FlatList` defaults ship out of the box (`removeClippedSubviews` on Android, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `updateCellsBatchingPeriod`). `windowSize` is measured in screen-heights (not messages); the default keeps a few screens of content mounted around the viewport. Override any of them via `listProps`:

```jsx
<Chat listProps={{ windowSize: 7, removeClippedSubviews: true }} {...props} />
```

### FlashList (opt-in)

On long histories `FlatList` can log `VirtualizedList: You have a large list that is slow to update`. [FlashList](https://shopify.github.io/flash-list/) v2 recycles rows instead of keeping them mounted, which removes that class of stall. It is supported as an **optional** dependency - install it yourself and flip one prop:

```bash
yarn add @shopify/flash-list
```

```jsx
<Chat messages={messages} user={user} isFlashListEnabled />
```

Everything else keeps working: `isInverted`, the floating day header, `loadEarlierMessagesProps` infinite scroll, the scroll-to-bottom button, and `listProps` (spread last, so it overrides the defaults below).

The chat sets FlashList's `maintainVisibleContentPosition` for you - `startRenderingFromBottom` when `isInverted={false}`, plus `autoscrollToBottomThreshold: 0.2` so new messages follow the viewport only when you are already at the bottom. Override it through `listProps` if you want different thresholds:

```jsx
<Chat
  isFlashListEnabled
  listProps={{
    maintainVisibleContentPosition: {
      autoscrollToBottomThreshold: 0.1,
      animateAutoScrollToBottom: false,
    },
  }}
  {...props}
/>
```

Notes:

- FlashList v2 requires the **New Architecture**. On the old architecture it falls back to a slower JS path.
- `FlatList`-only knobs (`windowSize`, `maxToRenderPerBatch`, `initialNumToRender`, `updateCellsBatchingPeriod`, `removeClippedSubviews`) are not forwarded to FlashList - it sizes its own render window.
- If `@shopify/flash-list` is not installed, the prop is ignored, a warning is logged, and `FlatList` is used.

---

## 🧪 Testing

<details>
<summary><strong>Triggering layout events in tests</strong></summary>

`TEST_ID` is exported as constants that can be used in your testing library of choice.

React Native Chat uses `onLayout` to determine the height of the chat container. To trigger `onLayout` during your tests:

```typescript
const WIDTH = 200
const HEIGHT = 2000

const loadingWrapper = getByTestId(TEST_ID.LOADING_WRAPPER)
fireEvent(loadingWrapper, 'layout', {
  nativeEvent: {
    layout: {
      width: WIDTH,
      height: HEIGHT,
    },
  },
})
```

</details>

---

## 📦 Example App

The repository includes a comprehensive example app demonstrating all features:

```bash
# Clone and install
git clone https://github.com/kesha-antonov/react-native-chat.git
cd react-native-chat/example
yarn install

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android

# Run on Web
npx expo start --web
```

The example app showcases:
- 💬 Basic chat functionality
- 🎨 Custom message bubbles and avatars
- ↩️ Reply to messages with swipe gesture
- ⚡ Quick replies (bot-style)
- ✍️ Typing indicators
- 📎 Attachment actions
- 🔗 Link parsing and custom matchers
- 🌐 Web compatibility

---

## ❓ Troubleshooting

<details>
<summary><strong>TextInput is hidden on Android</strong></summary>

Make sure you have `android:windowSoftInputMode="adjustResize"` in your `AndroidManifest.xml`. See [Android configuration](#android) above.

</details>

<details>
<summary><strong>How to set Bubble color for each user?</strong></summary>

See [this issue](https://github.com/kesha-antonov/react-native-chat/issues/672) for examples.

</details>

<details>
<summary><strong>How to customize InputToolbar styles?</strong></summary>

See [this issue](https://github.com/kesha-antonov/react-native-chat/issues/662) for examples.

</details>

<details>
<summary><strong>How to manually dismiss the keyboard?</strong></summary>

See [this issue](https://github.com/kesha-antonov/react-native-chat/issues/647) for examples.

</details>

<details>
<summary><strong>How to use renderLoading?</strong></summary>

See [this issue](https://github.com/kesha-antonov/react-native-chat/issues/298) for examples.

</details>

---

## 🤔 Have a Question?

1. Check this README first
2. Search [existing issues](https://github.com/kesha-antonov/react-native-chat/issues)
3. Ask on [StackOverflow](https://stackoverflow.com/questions/tagged/kesha-antonov/react-native-chat)
4. Open a new issue if needed

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`yarn install`)
4. Make your changes
5. Run tests (`yarn test`)
6. Run linting (`yarn lint`)
7. Build the library (`yarn build`)
8. Commit your changes (`git commit -m 'Add amazing feature'`)
9. Push to the branch (`git push origin feature/amazing-feature`)
10. Open a Pull Request

### Development Setup

```bash
# Install dependencies
yarn install

# Build the library
yarn build

# Run tests
yarn test

# Run linting
yarn lint

# Full validation
yarn prepublishOnly
```

---

## 👥 Authors

Based on [FaridSafi/react-native-gifted-chat](https://github.com/FaridSafi/react-native-gifted-chat), which is no longer actively maintained.

**Maintainer:** [Kesha Antonov](https://github.com/kesha-antonov)

> I maintained the original project solo for 2 years before deciding to continue development in this repository. If you find this library useful, please consider [becoming a sponsor](https://github.com/sponsors/kesha-antonov) to support continued development. 💖

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built with ❤️ by the React Native community</sub>
</p>
