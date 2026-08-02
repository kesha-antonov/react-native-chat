# Changelog

## [Unreleased]

### ✨ Features
- **Row-wide press target for reactions**: the long-press surface now spans the whole message row instead of just the bubble, so pressing the empty space beside a bubble opens the reaction picker - matching Telegram on Android. The message row is full-width now and the 70% width cap moved from the row onto the bubble itself (bubbles beside an avatar therefore get slightly more room).
- **`isMessageGestureEnabled`**: opt a message's *bubble* out of that surface (accepts a bool or a per-message predicate) for content that must own its touches - e.g. `isMessageGestureEnabled={message => !message.video}`. The surface moves behind the bubble rather than disappearing, so long-pressing beside the bubble still opens the picker and reactions are never lost for that message.
- **Optional FlashList engine** ([#3](https://github.com/kesha-antonov/react-native-chat/issues/3)): set `isFlashListEnabled` to render messages with `@shopify/flash-list` v2 instead of `FlatList`, which recycles rows and removes the `VirtualizedList: You have a large list that is slow to update` warning on long histories. `@shopify/flash-list` is an **optional** peer dependency - when it is missing the prop is ignored, a warning is logged, and `FlatList` is used. The chat wires FlashList's `maintainVisibleContentPosition` for you (`startRenderingFromBottom` on non-inverted lists, `autoscrollToBottomThreshold: 0.2`), and `listProps` still overrides everything. `isInverted`, the floating day header, infinite scroll and the scroll-to-bottom button all keep working.

### 🐛 Bug Fixes
- **Input toolbar hidden behind the keyboard** ([#11](https://github.com/kesha-antonov/react-native-chat/issues/11)): `keyboardVerticalOffset` means "how far down the screen the chat container starts", and it defaulted to `insets.top`. That value cannot see a navigation header - and because Chat mounts its own `SafeAreaProvider`, whose insets are clamped to the provider's on-screen position, a chat below a header got `0`. The toolbar therefore ended up roughly a header-height too low, i.e. behind the keyboard. Chat now takes the offset from its `SafeAreaProvider` **frame**, which safe-area-context measures natively against the root view (`offsetDescendantRectToMyCoords` on Android, `convertRect:toView:` on iOS) and refreshes on every layout change - so the toolbar sits on the keyboard whether the chat is full-screen or under a header, with no props to set. Passing your own `keyboardAvoidingViewProps.keyboardVerticalOffset` still overrides it. **If you currently pass `useHeaderHeight()` to work around this, remove it** - otherwise the toolbar will now float above the keyboard by that amount.
- **Nested `KeyboardProvider`** ([#11](https://github.com/kesha-antonov/react-native-chat/issues/11)): `Chat` mounted its own `KeyboardProvider` unconditionally, so an app that already mounts one at the root (the setup `react-native-keyboard-controller` documents) ended up with two. That is not harmless on Android: each provider installs an `OnApplyWindowInsetsListener` on the *activity's* root view and rewrites the content view's margins from its own `statusBarTranslucent` / `navigationBarTranslucent` props, so the nested provider relayouts the whole host app - and never restores the listener it replaced, leaving the app affected even after the chat screen is gone. Every keyboard event was also dispatched twice. `Chat` now detects a `KeyboardProvider` above it and reuses it; it still mounts one when the app has none, so no setup changes are needed. `disableKeyboardProvider` keeps working as an explicit opt-out.
- **Video controls no longer dead when reactions are enabled** ([#1](https://github.com/kesha-antonov/react-native-chat/issues/1)): the bubble's reaction gestures ran with the default `cancelsTouchesInView`, so on iOS they cancelled touches on native subviews and a `react-native-video` / `expo-video` player rendered through `renderMessageVideo` never got its play/seek/fullscreen taps. Both the tap and long-press recognizers now set `cancelsTouchesInView(false)`, and the tap gesture is only attached when `onPressMessage` is actually provided instead of always competing for touches.

### 📝 Documentation
- **`keyboardVerticalOffset`**: documented that it no longer needs to be set, and how to tell a too-small offset (toolbar behind the keyboard) from a too-large one (gap above it). Every example screen dropped the `useHeaderHeight()` workaround.
- Added an **App KeyboardProvider** example screen: a bare `<Chat>` under an app-level `KeyboardProvider`, the setup reported in [#11](https://github.com/kesha-antonov/react-native-chat/issues/11). The example app now mounts `KeyboardProvider` once at its root, as apps are expected to.

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
