# Changelog

## [Unreleased]

### ✨ Features
- **Modern, Telegram-inspired redesign** of the default look: azure accent (replacing the old Messenger blue), softer 18px bubbles with grouped corners, inline 12px time with vector delivery ticks, rounded composer with an accent send-button, translucent day-separator pill, sender name at the top of a group, and a softened scroll-to-bottom button.
- **Theme system + dark mode**: new `ChatTheme` with `colors` / `radii` / `spacing` / `typography` / `avatar` / `sendButton` tokens, plus `defaultLightTheme` / `defaultDarkTheme`. Override any subset via the `theme` and `darkTheme` props on `<Chat>`; the resolved theme is shared through context and switches at runtime with the color scheme. Explicit per-component style props still win.
  - New `useTheme()` hook and `useThemedStyles(factory)` helper for building theme-aware `StyleSheet`s (both exported).
- **Tighter message grouping**: consecutive messages from the same author get softened inner corners and reduced spacing (Telegram-style), so a run of messages reads as one group.
- **Video & audio messages now have real default renderers** instead of "not implemented" placeholders:
  - Inline playback when the optional `expo-video` / `expo-audio` peers are installed; otherwise a tappable `MediaCard` that opens the media in the system player.
  - `MessageVideo` / `MessageAudio` now receive `currentMessage` (previously rendered with no props).
  - Inline video uses the current `expo-video` `fullscreenOptions` API (no deprecation warning) and shows a dark placeholder while the first frame loads instead of flashing a white box.
- **Voice notes** (optional): Telegram-style hold-to-record mic with slide-to-cancel and a live recording bar (uses `expo-audio`). Playback renders a decoded **waveform** with a progress cursor when `react-native-audio-api` is installed. Enable with `audioRecording={{ isEnabled: true }}`.
- **Video notes** (optional): a round front-camera recorder via `react-native-vision-camera`, falling back to `expo-image-picker`'s system camera. Enable with `videoRecording={{ isEnabled: true }}`.
- **Location messages**: `IMessage.location` now renders a default map card that opens the system maps app on tap, with a `renderMessageLocation` override and `MessageLocation` component.
- **Markdown message text**: render AI/streamed replies as markdown. Opt in with `messageTextProps={{ markdown: true }}` (streamed messages auto-render as markdown unless disabled). Ships a **built-in dependency-free renderer** (headings, bullet/ordered lists, blockquotes, fenced + inline code, bold/italic/strikethrough, and links) that handles streaming-incomplete markdown gracefully, so it works out of the box. When the optional `react-native-streamdown` peer is installed it is used instead for richer streaming-safe rendering; `markdownProps` is forwarded to it. Exposed as `BasicMarkdown`.
- **Animated delivery status**: the "pending" clock now spins while sending; `sent` / `received` render as crisp vector check marks (replacing the `✓` / `🕓` glyphs).
- **Icon override registry**: an `icons` prop on `<Chat>` lets you replace any built-in icon (send, mic, camera, play, pause, check, checkAll, clock, pin, plus, close, chevronLeft, chevronDown, emoji, paperclip, reply, pencil, lock, trash) with your own - e.g. `lucide-react-native`. The built-in icons are the official [Lucide](https://lucide.dev) glyphs, rendered via the optional `react-native-svg` peer; if it isn't installed they fall back to dependency-free drawn icons. Exposed `ChatIcons` type, `useIcons`, and an `Icon` resolver component.
- **Telegram-style long-press context menu**: a new `messageActions` prop (array or per-message function of `{ label, icon?, onPress, destructive? }`) shows a floating, themed action menu anchored to the bubble on long-press, with an optional reactions row on top when reactions are enabled. Exposed the `ContextMenu` component and `MessageMenuItem` type.
- **Themed attachment sheet**: the composer "+" actions now open a dependency-free, themed slide-up sheet (`AttachmentSheet`) instead of the system action sheet. Add `icon`/`color` to an action to render a Telegram-style attachment **grid** (tiles + grab handle) instead of a list.
- **Composer redesign (Telegram field-as-bar)**: the composer is now one rounded field spanning the bar, with inset attachment (paperclip) and camera buttons on the right and an optional emoji button on the left (`onPressEmoji`). The text field grows to a max height then scrolls internally on native (previously unbounded), its `lineHeight` matches sent bubbles, and the bar pads for the home indicator (safe-area). New theme tokens: `composer` (minHeight/maxHeight/fieldPaddingH/insetIconSize), `voice` (cancel/lock thresholds), `colors.inputFieldBorder`, and `radii.inputField` is 18.
- **Send button is always visible**: it shows accent (active) when there's text to send and a muted gray (inactive) when the field is empty, so the right slot is never empty - except when a voice/video/stop control takes its place (e.g. with `audioRecording` enabled, the empty field shows the mic and switches to send once you type). The default send glyph is now the Lucide "send" paper-plane, rendered via `react-native-svg` when available (with a dependency-free triangle fallback) instead of a vertical arrow.
- **Reply/edit banner**: the reply preview is now a flush banner inside the bar (shared background + hairline) with a leading reply glyph, and supports an `edit` mode (pencil glyph) via `mode`.
- New overridable icons: `emoji`, `paperclip`, `reply`, `pencil`, `lock`, `trash` (drawn fallbacks; override via the `icons` prop).
- **Localization (i18n)** for UI strings: a `labels` prop on `<Chat>` overrides any string, and built-in translations ship for `en`/`es`/`fr`/`de`/`ru` (selected by the existing `locale` prop). All previously hardcoded strings (composer placeholder, send, cancel, load earlier, today, voice/video/location labels, slide-to-cancel, reply/edit banner, camera permission) now route through it. Exposed the `ChatLabels` type, `defaultLabels`, `translations`, `resolveLabels`, and the `useLabels` hook.
- **Optional FlashList engine** ([#3](https://github.com/kesha-antonov/react-native-chat/issues/3)): set `isFlashListEnabled` to render messages with `@shopify/flash-list` v2 instead of `FlatList`, which recycles rows and removes the `VirtualizedList: You have a large list that is slow to update` warning on long histories. `@shopify/flash-list` is an **optional** peer dependency - when it is missing the prop is ignored, a warning is logged, and `FlatList` is used. The chat wires FlashList's `maintainVisibleContentPosition` for you (`startRenderingFromBottom` on non-inverted lists, `autoscrollToBottomThreshold: 0.2`), and `listProps` still overrides everything. `isInverted`, the floating day header, infinite scroll and the scroll-to-bottom button all keep working.
- **Row-wide press target for reactions / message actions**: the long-press surface now spans the whole message row instead of just the bubble, so pressing the empty space beside a bubble opens the reaction picker or context menu - matching Telegram on Android. The message row is full-width now and the 70% width cap moved from the row onto the bubble itself (bubbles beside an avatar therefore get slightly more room).
- **`isMessageGestureEnabled`**: opt a message's *bubble* out of that surface (accepts a bool or a per-message predicate) for content that must own its touches - e.g. `isMessageGestureEnabled={message => !message.video}`. The surface moves behind the bubble rather than disappearing, so long-pressing beside the bubble still opens the picker and reactions are never lost for that message.

### 🐛 Bug Fixes
- **Video controls no longer dead when reactions are enabled** ([#1](https://github.com/kesha-antonov/react-native-chat/issues/1)): the bubble's reaction gestures ran with the default `cancelsTouchesInView`, so on iOS they cancelled touches on native subviews and a `react-native-video` / `expo-video` player rendered through `renderMessageVideo` never got its play/seek/fullscreen taps. Both the tap and long-press recognizers now set `cancelsTouchesInView(false)`, and the tap gesture is only attached when `onPressMessage` is actually provided instead of always competing for touches.

### ⚠️ Breaking / Migration
- **Removed `@expo/react-native-action-sheet` as a dependency.** The library no longer bundles or wraps an action sheet. The `actionSheet` prop and `context.actionSheet()` remain as an escape hatch but default to a no-op - if you relied on the built-in action sheet (e.g. calling `context.actionSheet()` in a custom `onLongPressMessage`), either pass your own `actionSheet` implementation (install `@expo/react-native-action-sheet` yourself and wrap your tree in `ActionSheetProvider`) or adopt the new `messageActions` context menu. The composer "+" actions need no change - they now use the built-in themed `AttachmentSheet`.

### ⚡ Performance
- **Memoized message rows.** Each list row (`Item`) is now wrapped in `React.memo` with a conservative comparator: message data is deep-compared (any change to text, status, reactions, etc. re-renders) and every other prop is reference-compared (any new render-function, config, style, or shared-value reference re-renders). The only skip is a genuine no-op, so appending a message no longer re-renders every visible row - and there is no path where new props leave stale content on screen. For best results, memoize custom render props (`renderBubble`, etc.) on your side.
- Missing prev/next messages at the list edges now use a shared frozen empty object instead of a fresh `{}` each render, so the row memo's fast path holds.
- **Tuned FlatList virtualization** defaults for chat lists (`removeClippedSubviews` on Android, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `updateCellsBatchingPeriod`) - all overridable via `listProps`.

### 🔧 Improvements
- Reactions, day pill, typing indicator, reply preview/quote, "Load earlier" pill, attachment button, system messages, and the initials-avatar palette are all theme-driven, with proper dark-mode colors (previously hard-coded; some were broken in dark mode).
- Reply UI now uses the shared accent (fixing the stale `#0084ff` in the reply preview and message-reply quote).
- Styling is consistent and DRY: every component reads design tokens through `useThemedStyles`; inline style objects were replaced with `StyleSheet` factories.

### 🧹 Internal
- Removed dead duplicate `src/MessageReply.tsx` and `src/ReplyPreview.tsx` (the exported components live in `src/components/`).

### 📦 Dependencies
- Added optional `peerDependencies` (all gated by `peerDependenciesMeta.optional`, nothing is required): `expo-video`, `expo-audio`, `expo-image-picker`, `react-native-audio-api`, `react-native-vision-camera`, `react-native-streamdown`, `react-native-svg` (used for the Lucide send glyph; falls back to a drawn icon when absent).

### 🛠️ Tooling
- Migrated the library and the example app to **Yarn 4** (corepack-driven `packageManager`, `nodeLinker: node-modules`, Berry lockfiles). CI now enables corepack and uses `yarn install --immutable`.

### 📝 Docs
- New README sections covering the redesign: "What's new vs react-native-gifted-chat", one-line theming, voice/video/location messages, custom icons (e.g. Lucide), markdown rendering for AI replies, the long-press message-actions menu, and a performance overview.
- Added a migration guide from `react-native-gifted-chat`.

### 📲 Example app
- New demo screens (registered in the chat stack and the "Explore" list): **Context Menu**, **Media & Voice**, **Theming & Icons**, and **Localization (i18n)**.
- Added a lightweight `EmojiPicker` for the composer emoji-button demo, and updated the AI bot and Slack examples for the new theming/composer APIs.

## [4.1.0] - 2026-06-19

### ✨ Features
- **Streaming (AI) messages**: token-by-token streamed replies for AI/chatbot UIs
  - `useStreamingMessages` hook — owns the message list and coalesces token pushes with `requestAnimationFrame` (one render per frame; only the streaming bubble re-renders), with `AbortController`-based stop
  - `IMessage.streaming` flag renders an inline blinking `StreamingCursor`
  - `Chat.updateMessage(messages, id, patch)` — immutable per-message helper for token updates
  - See `docs/STREAMING.md` for a real Claude streaming adapter (backend proxy)
- **Emoji Reactions**: long-press a message to react; selected reactions render as toggleable pills below the bubble
  - `reactions` prop on `<Chat>` with the `MessageReactions` display and a lightweight `ReactionPicker`
  - `MessageReaction` model + `IMessage.reactions`
  - Core ships only the quick picker (no new dependencies); a full emoji browser is demonstrated in the example via the `renderReactionPicker` override

### 🔧 Improvements
- Library is now published as compiled output (`lib/`) with type declarations and declaration maps
- Synced the library with the latest upstream sources (animated day header helpers, fixes)

### 📝 Documentation
- Documented Streaming, Emoji Reactions, and the full `IMessage` shape in the README; linked every feature to its section
- Added example screens: **AI Bot (Streaming)** and **Reactions**

## [4.0.0] - 2026-06-19

### 🔧 Changes
- Renamed and rebranded to `@kesha-antonov/react-native-chat` (`GiftedChat` → `Chat`, `GiftedChatContext` → `ChatContext`, `GiftedAvatar` → `ChatAvatar`)
- Continues development from `react-native-gifted-chat` (MIT)

## [3.3.2] - 2026-01-22

### 🐛 Bug Fixes
- Fixed `React.memo` and `React.forwardRef` components not rendering correctly when passed as render props
  - `renderComponentOrElement` now properly handles components with `$$typeof` property
- Fixed layout jump on initial render - content now renders with `opacity: 0` until initialized
- Fixed keyboard vertical offset documentation and examples

### 🔧 Improvements
- Updated `keyboardVerticalOffset` documentation in README with clearer explanation
- Added `hidden` style for smoother initial render transitions

### 📝 Documentation
- Improved `keyboardVerticalOffset` section explaining that it equals distance from screen top to container top
- Added recommendation to use `useHeaderHeight()` from `@react-navigation/elements`

## [3.3.0] - 2026-01-21

### ✨ Features
- **Swipe to Reply**: New swipe-to-reply functionality using `ReanimatedSwipeable` (based on #2692)
  - Replaced deprecated `Swipeable` with `ReanimatedSwipeable` from react-native-gesture-handler
  - Added `reply` prop to `Chat` with grouped configuration options
  - Swipe direction support: `'left'` (swipe left, icon on right) or `'right'` (swipe right, icon on left)
  - Custom swipe action rendering via `renderAction`
  - Built-in animated `ReplyIcon` component
  - `ReplyPreview` component with smooth enter/exit animations
  - Reply message display in `Bubble` component via `messageReply` prop
- **New Props**:
  - `scrollToBottomContentStyle` - style for scroll to bottom button content

### 🐛 Bug Fixes
- Fixed #2702 - typing issues
- Fixed #2708 - component issues
- Fixed #2607 - edge case handling
- Fixed #2701 - rendering issues
- Fixed #2691 - prop handling
- Fixed #2688 - style issues
- Fixed #2687 - component behavior
- Fixed #2618 - scroll issues
- Fixed #2677, #2682, #2602 - multiple fixes
- Fixed #2684, #2686 - component issues
- Fixed `onScroll` type definition
- Fixed messages padding
- Fixed SystemMessage styles
- Added missing worklets for animations
- Removed `ts-expect-error` for `requestAnimationFrame` (now properly typed for React Native)
- Fixed two typing issues (#2698)

### 🔧 Improvements
- Grouped reply-related props into `ReplyProps` interface for cleaner API
- Added `SwipeToReplyProps` for Message-level swipe configuration
- Added `BubbleReplyProps` for Bubble-level reply message styling
- Added example app to lint command with proper path alias support
- Improved reply animations (enter/exit transitions)
- Changes from #2705

### 📝 Documentation
- Updated README with swipe-to-reply feature documentation and examples
- Updated license link
- Added reply message implementation example (#2690)

### 🧪 Testing
- Updated test snapshots
- Added tests for `MessageReply` component
- Added tests for `ReplyPreview` component

## [3.2.3] - 2025-12-XX

### 🐛 Bug Fixes
- Fixed `onScroll` type definition

## [3.2.0] - 2025-11-25

### ✨ Features
- **Custom Link Parser**: Replaced `react-native-autolink` dependency with custom link parser implementation for better control and performance
  - Removed external dependency on `react-native-autolink`
  - Improved link parsing with custom implementation in `linkParser.tsx`
  - Updated `MessageText` component to use new parser
  - Enhanced links example in example app

### 🐛 Bug Fixes
- Adjusted message bubble styles for better rendering
- Updated test snapshots to reflect parser changes

## [3.1.5] - 2025-11-25

### ✨ Features
- **Color Scheme Support**: Added `colorScheme` prop to `Chat` component
  - New `useColorScheme` hook for consistent color scheme handling
  - Automatically adapts UI elements (Composer, InputToolbar, Send) based on color scheme
  - Added comprehensive tests for color scheme functionality

### 📝 Documentation
- Updated README with `colorScheme` prop documentation

## [3.1.4] - 2025-11-25

### 🐛 Bug Fixes
- Added left padding to `TextInput` when no accessory is present for better visual alignment
- Adjusted input toolbar styles for improved layout

## [3.1.3] - 2025-11-25

### 🔧 Improvements
- Removed unused imports for cleaner codebase

## [3.1.2] - 2025-11-24

### 🐛 Bug Fixes
- Fixed message bubble styles for small messages
- Improved rendering of compact message content

### 🧪 Testing
- Updated test snapshots

## [3.1.1] - 2025-11-24

### 🐛 Bug Fixes
- Fixed Bubble component styles for better message rendering
- Corrected style inconsistencies in message bubbles

### 🧪 Testing
- Updated test snapshots to reflect style fixes

## [3.1.0] - 2025-11-24

### 🔧 Improvements
- Refactored component styles for better maintainability
- Updated Expo Snack example with latest changes

### 🧪 Testing
- Updated test snapshots

## [3.0.1] - 2025-11-24

### 🐛 Bug Fixes
- Fixed Composer auto-resize height behavior on web platform

### 🧪 Testing
- Updated test snapshots

## [3.0.0] - 2025-11-23

This is a major release with significant breaking changes, new features, and improvements. The library has been completely rewritten in TypeScript with improved type safety, better keyboard handling, and enhanced customization options.

### 🚨 Breaking Changes

#### Renamed Props (Chat)
- `onInputTextChanged` → moved to `textInputProps.onChangeText` (follows React Native naming pattern)
- `alwaysShowSend` → `isSendButtonAlwaysVisible` (consistent boolean naming convention)
- `onPress` → `onPressMessage` (more specific naming)
- `onLongPress` → `onLongPressMessage` (more specific naming)
- `options` → `actions` (better semantic naming, different type signature)
- `optionTintColor` → `actionSheetOptionTintColor` (clearer naming)
- `renderUsernameOnMessage` → `isUsernameVisible` (consistent boolean naming)
- `showUserAvatar` → `isUserAvatarVisible` (consistent boolean naming)
- `showAvatarForEveryMessage` → `isAvatarVisibleForEveryMessage` (consistent boolean naming)
- `renderAvatarOnTop` → `isAvatarOnTop` (consistent boolean naming)
- `focusOnInputWhenOpeningKeyboard` → `shouldFocusInputOnKeyboardOpen` (consistent boolean naming)
- `messageContainerRef` → `messagesContainerRef` (typo fix)
- `alignTop` → `isAlignedTop` (consistent boolean naming)
- `inverted` → `isInverted` (consistent boolean naming)

#### Removed Props (Chat)
- `bottomOffset` - use `keyboardAvoidingViewProps.keyboardVerticalOffset` instead
- `disableKeyboardController` - removed keyboard controller configuration
- `isKeyboardInternallyHandled` - keyboard handling now always uses react-native-keyboard-controller
- `lightboxProps` - custom Modal implementation replaced react-native-lightbox-v2
- `placeholder` - moved to `textInputProps.placeholder`
- `disableComposer` - moved to `textInputProps.editable={false}`
- `keyboardShouldPersistTaps` - moved to `listProps.keyboardShouldPersistTaps`
- `maxInputLength` - moved to `textInputProps.maxLength`
- `extraData` - moved to `listProps.extraData`
- `infiniteScroll` - use `loadEarlierMessagesProps.isInfiniteScrollEnabled` instead
- `parsePatterns` - removed, automatic link parsing improved

#### Props Moved to MessagesContainer (via spreading)
These props moved from `ChatProps` to `MessagesContainerProps` but are still accessible on `Chat` via prop spreading:
- `messages` - now in MessagesContainerProps
- `isTyping` - now in MessagesContainerProps (via TypingIndicatorProps)
- `loadEarlier` → `loadEarlierMessagesProps.isAvailable`
- `isLoadingEarlier` → `loadEarlierMessagesProps.isLoading`
- `onLoadEarlier` → `loadEarlierMessagesProps.onPress`
- `renderLoadEarlier` - now in MessagesContainerProps
- `renderDay` - now in MessagesContainerProps
- `renderMessage` - now in MessagesContainerProps
- `renderFooter` - now in MessagesContainerProps
- `renderChatEmpty` - now in MessagesContainerProps
- `scrollToBottomStyle` - now in MessagesContainerProps
- `isScrollToBottomEnabled` - now in MessagesContainerProps
- `scrollToBottomComponent` - now in MessagesContainerProps
- `onQuickReply` - now in MessagesContainerProps
- `listViewProps` → `listProps` (renamed in MessagesContainerProps)

#### Type Signature Changes
- `options`: changed from `{ [key: string]: () => void }` to `Array<{ title: string, action: () => void }>`
- `textInputProps`: changed from `object` to `Partial<React.ComponentProps<typeof TextInput>>`
- `renderInputToolbar`: now accepts `React.ComponentType | React.ReactElement | function | null` (can be component, element, function, or null)
- All callback props now use arrow function syntax instead of function syntax for better type inference

#### Dependency Changes
- Removed `react-native-lightbox-v2` (replaced with custom Modal implementation)
- Removed `react-native-iphone-x-helper` (deprecated)
- Removed `react-native-keyboard-controller` as direct dependency
- Added `react-native-keyboard-controller` as peer dependency (>=1.0.0)
- Added `react-native-gesture-handler` as peer dependency (>=2.0.0)
- Added `react-native-reanimated` support for v3 & v4
- Added `react-native-safe-area-context` as peer dependency (>=5.0.0)

### ✨ New Features

#### TypeScript Migration
- Complete conversion from JavaScript to TypeScript/TSX
- Improved type safety and IntelliSense support
- Better type definitions for all components and props
- Refactored types to arrow functions for better readability

#### Keyboard Handling
- New `keyboardTopToolbarHeight` prop for better keyboard customization
- New `keyboardAvoidingViewProps` to pass props to KeyboardAvoidingView from react-native-keyboard-controller
- Improved keyboard behavior and offset handling
- Consolidated keyboard configuration (removed individual keyboard props in favor of `keyboardAvoidingViewProps`)
- Fixed auto-grow text input behavior
- Better keyboard open/close transitions
- New `OverKeyboardView` component for MessageImage to keep keyboard open

#### Message Rendering
- `isDayAnimationEnabled` prop to control day separator animations
- Support for passing custom components in render functions
- Improved message parsing with better link detection
- Parse links in system messages (fixes #2105)
- Better phone number parsing with custom matchers support
- Improved URL parsing (email, phone, URL detection)

#### UI & Styling
- Dark theme support in example app
- Safe area provider included in library
- Improved LoadEarlier messages logic
- Better themed styles implementation
- Fixed press animation for TouchableOpacity
- Replaced deprecated `TouchableWithoutFeedback` with `Pressable`
- Better scroll to bottom button behavior on Android

#### Image Viewing
- Custom Modal implementation replacing react-native-lightbox-v2
- Better image viewing experience with proper insets handling
- Improved MessageImage component

#### Accessibility & UX
- `renderTicks` prop for message status indicators
- Better scroll to bottom wrapper visibility handling
- `useCallbackThrottled` for improved scroll performance
- Allow passing children to SystemMessage
- Improved load earlier messages functionality

### 🐛 Bug Fixes

- Fixed duplicate paragraph tags in README
- Fixed scroll to bottom when `isScrollToBottomEnabled=false` (#2652)
- Fixed TypeScript type inconsistencies and ESLint errors (#2653)
- Fixed automatic scroll to bottom issues (#2630, #2621, #2644)
- Fixed DayAnimated test import and added proper test coverage for renderDay prop
- Fixed not passed `isDayAnimationEnabled` prop
- Fixed MessageContainer scroll to bottom press on Android
- Fixed safer change ScrollToBottomWrapper visibility
- Fixed dependency cycles in imports
- Fixed MessageText container style
- Fixed reanimated issue in MessageContainer
- Fixed construct messages on send in example
- Fixed web support in example
- Fixed #2659 (memoization issues)
- Fixed #2640 (various bug fixes)
- Fixed show location in example
- Fixed errors in keyboard handling
- Fixed load earlier messages functionality
- Fixed Bubble type parameter to re-enable generics on message prop (#2639)
- Fixed listViewProps typing with Partial<FlatListProps> (#2628)
- Fixed MessageContainer to add renderDay prop and insert DayAnimated Component (#2632)
- Fixed dateFormatCalendar default value in README

### 🔧 Improvements

#### Performance
- Memoized values & functions for better performance
- Better scroll performance with throttled callbacks
- Optimized re-renders

#### Code Quality
- Added ESLint with import sorting
- Fixed all examples with ESLint
- Improved code structure and organization
- Better error handling
- Cleaner prop passing and component structure

#### Testing
- All tests converted to TypeScript
- Updated snapshots for new components
- Run tests in correct timezone (Europe/Paris)
- Improved test coverage
- Added comprehensive copilot instructions with validated commands

#### Documentation
- Improved README structure and formatting
- Better prop documentation and grouping
- Added matchers example
- Added working Expo Snack link
- Better feature documentation
- Added maintainer section
- Improved previews and images
- Added export documentation
- Fixed formatting issues and typos
- Better keyboard props documentation

#### Example App
- Updated to latest React Native and Expo
- Added tabs with different chat examples
- Added working link to Expo Snack
- Better example organization
- Added dark theme support
- Removed padding from bottom of toolbar
- Added custom phone matcher example
- Switch to dev build in README
- Android: transparent navigation & status bars by default
- Better project structure with multiple example types

#### Build & Development
- Better dependency management
- Updated to Node.js >= 20
- Yarn 1.22.22+ as package manager
- Added stale workflow for issue management
- Script to rebuild native dependencies
- Improved local development setup

### 📦 Dependencies

#### Added
- `@expo/react-native-action-sheet`: ^4.1.1
- `@types/lodash.isequal`: ^4.5.8
- `dayjs`: ^1.11.19
- `lodash.isequal`: ^4.5.0
- `react-native-zoom-reanimated`: ^1.4.10

#### Peer Dependencies (now required)
- `react`: >=18.0.0
- `react-native`: *
- `react-native-gesture-handler`: >=2.0.0
- `react-native-keyboard-controller`: >=1.0.0
- `react-native-reanimated`: >=3.0.0 || ^4.0.0
- `react-native-safe-area-context`: >=5.0.0

### 🔄 Migration Guide

#### Update Prop Names
```javascript
// Before (v2.8.1)
<Chat
  messages={messages}
  onInputTextChanged={handleTextChange}
  alwaysShowSend={true}
  onPress={handlePress}
  onLongPress={handleLongPress}
  options={{ 'Option 1': action1, 'Option 2': action2 }}
  optionTintColor="#007AFF"
  bottomOffset={100}
  placeholder="Type a message..."
  maxInputLength={1000}
  renderUsernameOnMessage={true}
  showUserAvatar={false}
  showAvatarForEveryMessage={false}
  renderAvatarOnTop={false}
  alignTop={false}
  inverted={true}
  loadEarlier={true}
  isLoadingEarlier={false}
  onLoadEarlier={handleLoadEarlier}
/>

// After (v3.0.0)
<Chat
  messages={messages}
  textInputProps={{
    onChangeText: handleTextChange,
    placeholder: "Type a message...",
    maxLength: 1000
  }}
  isSendButtonAlwaysVisible={true}
  onPressMessage={handlePress}
  onLongPressMessage={handleLongPress}
  actions={[
    { title: 'Option 1', action: action1 },
    { title: 'Option 2', action: action2 }
  ]}
  actionSheetOptionTintColor="#007AFF"
  keyboardAvoidingViewProps={{ keyboardVerticalOffset: 100 }}
  isUsernameVisible={true}
  isUserAvatarVisible={false}
  isAvatarVisibleForEveryMessage={false}
  isAvatarOnTop={false}
  isAlignedTop={false}
  isInverted={true}
  loadEarlierMessagesProps={{
    isAvailable: true,
    isLoading: false,
    onPress: handleLoadEarlier
  }}
/>
```

#### Install Peer Dependencies
```bash
npm install react-native-gesture-handler react-native-keyboard-controller react-native-reanimated react-native-safe-area-context
# or
yarn add react-native-gesture-handler react-native-keyboard-controller react-native-reanimated react-native-safe-area-context
```

#### Update Image Lightbox
The library now uses a custom Modal implementation instead of react-native-lightbox-v2. If you were customizing the lightbox, you'll need to update your customization approach.

### 📝 Notes

- This version includes 170+ commits since v2.8.1
- Full TypeScript support with improved type definitions
- Better React Native compatibility (tested with RN 0.81.5)
- Improved React 19 support
- Better Expo integration

### 👥 Contributors

Special thanks to all contributors who made this release possible, including fixes and improvements from the community.

---

For detailed commit history, see: https://github.com/kesha-antonov/react-native-chat/compare/2.8.1...3.0.0
