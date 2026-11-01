# Changelog

## [Unreleased]

Voice and round video notes now look and behave like Telegram's (Android source used as the reference).

### 💥 Breaking
- **Voice and round video notes are on by default once their peers are installed** (`expo-audio`; `react-native-vision-camera` 5), so the mic button shows, and toggles to the camera with a tap, with no props. Before, both needed `isEnabled: true`. Turn them off with `audioRecording={false}` / `videoRecording={false}` (or `{ isEnabled: false }`); both props now also take a boolean. The system-camera fallback (`expo-image-picker` without vision-camera) still needs `videoRecording={{ isEnabled: true }}`, since it is a different control that opens another app
- **An empty chat shows Telegram's greeting card** (`ChatGreetingsView`) instead of a blank list: "No messages here yet...", "Send a message or tap the greeting below." and a big 👋 that sends itself when tapped. `renderChatEmpty` still replaces it; `renderChatEmpty={null}` shows nothing, `emptyChatGreeting` changes or (`null`) removes the greeting
- **Emoji-only messages drop the bubble and draw large** (`MessageObject.checkEmojiOnly`, `TYPE_EMOJIS`): 40.8 for one or two emoji, 33.6 for three, 26.4 for four, 22.8 for more, up to 20 emoji, with the time in a service pill underneath. Turn it off with `theme.bubble.bigEmojiMaxCount: 0`. A custom `renderMessageText` or `renderCustomView`, media and quotes keep the bubble
- **"Select" joins the default long-press actions**, before Delete, when a selection can be acted on (a clipboard, Forward or Delete). Drop it with `defaultMessageActions` or a `messageActions` function
- **The long-press menu no longer covers the message it is for**: when Telegram's placement (at the finger, clamped to the screen) would land the card on the lit message, it moves just below or above it, keeping Telegram's horizontal placement
- **The composer shows an emoji button and a paperclip by default.** The emoji button opens the new built-in emoji keyboard; the paperclip opens the new built-in attachment menu when at least one of its peers is installed (`expo-media-library` or `expo-image-picker`, `expo-document-picker`, `expo-location`), and stays hidden otherwise. Before, both showed only with `onPressEmoji` / `actions`. Hide them with `emojiKeyboard={false}` and `attachments={false}`; `onPressEmoji`, `actions`, `onPressActionButton` and `renderActions` still take over as before
- **The long-press menu follows Telegram Android instead of Telegram iOS** (`ActionBarPopupWindow`, `ReactionsContainerLayout`, `ChatScrimPopupContainerLayout`). The message no longer shrinks while held or lifts: the chat dims under a black 0.2 scrim (no blur) and the pressed message stays lit where it is. The menu opens beside the finger (its right edge 28 left of it, its top at it) rather than under the bubble, unrolls from the top, and is a 200-wide card with 48pt rows, 16 text and 12 corners in `theme.contextMenu` colors (white / `#283848`) instead of `colors.surface`. The reactions bar is a 48pt pill above it with Telegram's "thought bubble" tail, at most 7 emojis plus the expand chevron. `ContextMenu` keeps its props; it takes new optional `touchX` / `touchY` and `reactions.selected`
- **The built-in Delete action is no longer red**, as in Telegram Android's message menu. A `destructive` item you pass is still red, now in `theme.contextMenu.destructive` (`#CC2929` / `#EE686F`)
- **The reactions bar has an expand button by default**: `reactions.renderExpandedPicker` defaults to the built-in emoji grid. Pass `null` to drop the button
- **Default look changed to Telegram Android** (DrKLO/Telegram 13.1.1, day "Blue/classic" and night "Dark Blue"). Every value below comes from that source; restore any of it through `theme` / `darkTheme`:
  - **Colors.** Day outgoing bubbles are pale green `#EFFFDE` with black text and green time and checks; incoming stay white. Night outgoing bubbles draw a purple-to-blue gradient fixed to the screen, with white text. The accent is `#229AF0`, and links are colored, not underlined (`incomingLink` / `outgoingLink`). Restore a solid outgoing color with `colors.outgoingBubble` (setting it turns the gradient off) or `bubble.outgoingGradient: null`
  - **Wallpaper.** The chat draws Telegram's four-color swirl gradient behind the list and the composer, and turns it one step per message you send. Restore the flat background with `wallpaper: { isEnabled: false }` (it shows `colors.background`) or `renderWallpaper={null}`
  - **Bubbles.** 17pt corners (was 18), 6pt on the tail side inside a run, and a curled tail on the last bubble of each run. Restore tail-less bubbles with `bubble.hasTail: false`. Bubbles are now as wide as Telegram's, `min(width, height) - 80` of text (was 70% of the row)
  - **Runs** break after five minutes as well as on a sender change, with 2pt between bubbles in a run and 6pt between runs (was 8). Restore the old gaps with `spacing.betweenGroups`
  - **The time sits on the last line of text** when it fits, with the checks after it, instead of on a row of its own; photos without a caption get it in a dark pill over the corner. Restore the row with `bubble.isTimeInline: false`. A custom `renderTime`, `renderMessageText`, or a custom view at the bottom keeps the row
  - **Typography.** Message text 16 on a 19 line (was 21); names, quotes and pills 14 Medium; the composer 18
  - **Reaction pills sit inside the bubble**, under the text, as 26pt capsules: the bubble's accent at 15.6% when not chosen, solid with white text when chosen, without a border. A custom `reactions.renderReactions` keeps its place below the bubble
  - **The reply quote** is a box tinted with its accent at 10% with a 3pt bar, the quoted author's name in their color, one line of text, and the thumbnail beside it
  - **Date and service pills.** 14 Medium white on a translucent pill, radius 11. System messages lost their border and use the same pill. The floating date fades out 1s after scrolling stops (was 0.6s)
  - **Sender names and initials avatars use Telegram's seven colors, picked by user id** (was one name color, and a palette picked from the name). Avatars are 42 with a vertical gradient. Restore one name color with `colors.senderName` (setting it empties `nameColors`) and flat avatars with `avatar.paletteEnd: []`
  - **The composer is a floating island**: a 44pt pill with radius 22, 7 from the sides and 9 above the bottom inset, over the wallpaper, holding the emoji button, the text, the paperclip and the send/mic button. The reply banner sits inside it. `colors.inputBackground` is the island and `colors.inputBarBackground` (now transparent) the band around it; set the latter back to a color for a solid bar
  - **The send button only shows when there is something to send**, growing in from 0.1 (220ms), and swaps with the mic the same way; the paperclip fades to half size while you type. Keep the send button showing with `isSendButtonAlwaysVisible`
  - **The scroll-to-bottom button** is a 44pt glass circle (blurred with the optional `expo-blur`, opaque without it) with a neutral chevron, 7 from the edge; it rises from 80pt below at 0.7 scale over 280ms
  - **Voice notes** play in the bubble's green (day) or white (night) instead of the accent / bubble-text colors (`incomingVoiceFill`, `outgoingVoiceFill` and their tracks)
  - **Default image size** 240x180 inset 2 in the bubble (was 150x100 with a 3 margin)
  - `colors.error` is Telegram's `#DB3535` / `#F6574E` (was `#E74C3C`)
- **Unread dot comes from `IMessage.isMediaUnread`** instead of local play state, on voice and round notes
- **Round notes no longer autoplay**: they rest on their first frame. Opt back in with `mediaPlayback.isRoundVideoAutoplayEnabled`
- **`theme.voice` distances follow Telegram**: `cancelThreshold` 140 (full slide; was the 80 release point), `lockThreshold` 57 (was 90)
- **Voice takes of 700ms or less are dropped** (was under 800ms)
- **Speed control moved** from each voice bubble into the new "now playing" bar
- **Round notes need `createVideoPlayer`** (expo-video, SDK 52+); without it they fall back to the media card
- **The long-press menu opens after 0.4s** (was the 500ms gesture default), Android's long-press timeout, which Telegram Android uses. Its actions run once the menu's close animation has finished (220ms) and `onDismiss` once the scrim has faded (320ms), rather than straight away
- **`react-native-gesture-handler` 3 is required** (peer `>=3.0.0`, was `>=2.0.0`). The gestures moved to its hook API (`useTapGesture`, `usePanGesture`, `useExclusiveGestures`, `GestureStateManager`...), which 2.x does not have; `BaseButton`, `TextInput`, `FlatList` and `Pressable` now come from 3.x under the same names. Gesture Handler 3 in turn needs **React Native 0.82+** and **React 19**, so the `react-native` peer is now `>=0.82.0` and `react` is `>=19.0.0` (was `*` and `>=18.0.0`). In development, Gesture Handler 3 throws when a `GestureDetector` has no `GestureHandlerRootView` above it: `Chat` still mounts one by default, but a bubble, player or `MessagesContainer` rendered on its own, or a `Chat` with `enableGestureHandlerRootView={false}`, now needs the app's root view
- **Round video notes need `react-native-vision-camera` 5** (peer `>=5.0.0`, was `*`), plus its `react-native-nitro-modules` and `react-native-nitro-image` peers. Version 5 records through a video output and a `Recorder` instead of methods on the camera ref, which the recorder now uses. With vision-camera 4 installed the camera counts as unavailable and the record button falls back to `expo-image-picker`. Version 5 has no Expo config plugin: add `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` (`ios.infoPlist`) and `CAMERA` / `RECORD_AUDIO` (`android.permissions`) yourself
- **`@lodev09/react-native-true-sheet` 3 or newer** for the native attachment sheet (peer `>=3.0.0`, was `*`); see the fix below
- **Long-press opens the context menu by default.** With nothing configured, a long-press shows Reply and Copy (Copy needs `expo-clipboard` or `@react-native-clipboard/clipboard`); before, it did nothing unless `messageActions` or reactions were set. An app that sets `onLongPressMessage` (and not `messageActions`) keeps its own long-press. Opt out with `defaultMessageActions={false}`
- **Swipe-to-reply is on by default**, and follows Telegram Android (`ChatActivity`): it takes over after about 25pt (0.4cm) of mostly sideways travel, the row follows the finger 1:1 up to 80pt, a light haptic ticks at 50pt, and releasing past 50pt replies; the row slides back over 180ms. It no longer uses `ReanimatedSwipeable`: a custom `reply.swipe.renderAction` now draws over the row's trailing edge and gets `progress` as the travelled distance over 50pt. Opt out with `reply={{ swipe: { isEnabled: false } }}` (or `reply={{ isEnabled: false }}` for all replying)
- **The scroll-to-bottom button is on by default** and behaves like Telegram Android's pagedown button: it shows after scrolling back towards the newest message by `scrollToBottomOffset` (now `100`, was `200`) or when a message arrives while you are away, hides at the newest message, and counts new messages in a badge. Opt out with `isScrollToBottomEnabled={false}` (badge alone: `isScrollToBottomBadgeEnabled={false}`). A non-inverted list scrolls to its end on layout only when `isScrollToBottomEnabled` is passed explicitly, as before
- **Avatars and sender names show in group chats only**, as in Telegram. A chat with a single other sender loses its avatars; names are on in groups and drawn once per run of messages (also when `isUsernameVisible` is set explicitly). Restore avatars with `isAvatarVisible` (or `isGroupChat`); a custom `renderAvatar` function keeps them on
- **Tapping a reply quote jumps to the quoted message** and highlights its row (1s, then a 300ms fade, Telegram Android's timing) when `reply.onPress` is not set. Pass `reply.onPress` to handle it yourself
- **`reactions.isEnabled` defaults to on when `reactions.onReactionPress` is passed** (was off). Pass `isEnabled: false` to keep reactions off
- **`textInputRef` is typed `RefObject<ComponentRef<typeof TextInput> | null>`** (was `RefObject<TextInput>`), which React Native 0.88's strict TypeScript API needs and older versions accept

### ✨ Features
- **Multi-select mode**, entered from the menu's "Select" (`ChatMessageCell.setCheckBoxVisible`, `CheckBoxBase`): a tap checks or unchecks a message, incoming rows slide 35 aside for a 21pt check circle (green `#5EC245` when checked), checked rows are tinted `colors.selectionBackground`, and a bar replaces the composer with the count, Copy (texts joined oldest first), Forward and Delete. New `onSelectionChange(messages)`, `onForwardMessages` / `onDeleteMessages` (batch callbacks; without them Forward and Delete call `onForwardMessage` / `onDeleteMessage` per message) and `renderSelectionBar` (`null` keeps the composer). Android's back, the X, or unchecking the last message leaves it; swipe-to-reply pauses meanwhile
- **"Unread Messages" bar** (`ChatUnreadCell`): pass `firstUnreadMessageId` and Telegram's full-width bar (27pt strip in a 40pt cell, 14 bold label, arrow at the right; `colors.unreadSeparatorBackground` / `Text` / `Arrow`) is drawn above that message, and the chat opens scrolled so it is at the top. `renderUnreadSeparator` replaces it (`null` keeps just the scroll). Exported as `UnreadSeparator`
- **Link previews** (`ChatMessageCell.drawLinkPreview`): new `IMessage.linkPreview` (`url`, `siteName`, `title`, `description`, `image`, `imageWidth`, `imageHeight`, `imageSize`) draws Telegram's web page block under the text: a box in the sender's color at 10% with a 3pt bar, the site name in that color, a bold title, up to four lines of description, and the picture full width (or a 48pt thumbnail for square pictures); the time takes the line below it. A tap opens the URL. `fetchLinkPreview(url)` fills it in for messages without one (fetched once per URL per app run), `renderLinkPreview` replaces it (`null` hides it), `onPressLinkPreview` handles the tap. Exported as `LinkPreviewCard` and `findFirstUrl`
- **`ChatEmpty`**, `countEmojiOnly` and the `checkCircle` icon are exported; new theme tokens `bubble.bigEmojiMaxCount`, `bubble.bigEmojiSizes`, `colors.unreadSeparatorBackground`, `colors.unreadSeparatorText`, `colors.unreadSeparatorArrow`, `colors.selectionCheckbox`, `colors.selectionCheckboxCheck`; new labels `emptyChatTitle`, `emptyChatText`, `unreadMessages`, `actionSelect`, `cancelSelection` in all 15 languages
- **Built-in emoji keyboard** (Telegram Android's `EmojiView`), on by default behind the composer's emoji button. It takes the system keyboard's place at the last keyboard height (200 + the bottom inset before one was seen), so keyboard <-> emoji keeps the composer still, and slides up over 250ms from nothing; the button morphs between smile and keyboard. Telegram's tab strip with a sliding indicator, section headers, search (scroll up to reveal it; results stay above the system keyboard), recents by use count (at most 48, seeded with Telegram's defaults), a skin-tone popup on long-press, and a backspace that repeats while held. A tap inserts at the caret whether or not the app controls `text`. Taps on the chat close it; so does Android's back. Configure with **`emojiKeyboard`**: `{ isEnabled, columns, categories, recents: { isEnabled, storageKey, isPersisted }, isSearchEnabled, renderEmojiKeyboard }`. Recents and tones persist through `@react-native-async-storage/async-storage` when installed. New **`theme.emojiKeyboard`** token group, exported **`EmojiGrid`**, `EMOJI_CATEGORY_KEYS`, `DEFAULT_RECENT_EMOJIS`
- **The emoji data ships in the library**: `src/emoji/emojiData.ts`, 52 KB for 1870 emojis (Emoji 16), generated by `scripts/build-emoji-data.cjs` from `emoji-datasource` instead of bundling its 1.3 MB JSON. Rendered rows only, plain `Text` cells, no per-cell animation
- **Built-in attachment menu** (Telegram Android 13's `ChatAttachAlert`), on by default behind the paperclip: a sheet that rises on Telegram's spring over a floating pill of tabs (Gallery, File, Location; Camera when there is no grid). With `expo-media-library` the Gallery tab is a 3-column grid of your newest photos and videos with a camera tile; picks are numbered in blue discs, the photo shrinks to 0.787, and the tabs give way to a caption field and a "Send N" button. Without it, Gallery opens the system picker (`expo-image-picker`). File opens the document picker (`expo-document-picker`); Location finds you and sends your position (`expo-location`); the camera tile and tab use `expo-image-picker`. Each tab shows only when its peer is installed. Picks become messages sent through `onSend` - an `image` or `video` per pick (no albums yet) with the caption on the first, a `file`, or a `location`. Configure with **`attachments`**: `{ isEnabled, tabs, onPick, renderAttachmentMenu }`; `onPick` can upload first and return the messages to send. New **`theme.attachments`** token group; exported `AttachmentMenu`, `buildAttachmentMessages`, `getAttachmentTabs`
- **File messages**: new `IMessage.file` (`{ uri, name, size?, mimeType? }`, type `IMessageFile`) drawn as Telegram's document bubble - a circle with the extension, the name and the size, the time on the size line. A tap opens it in the share sheet (`expo-sharing`) or through `Linking`. **`renderMessageFile`** replaces it; exported `MessageFile` and `formatFileSize`
- **Long-press menu, Telegram Android's way**: the scrim fades in over 320ms (EASE_OUT_QUINT); the card unrolls over 150 + 16 x rows ms with each row dropping 6pt into place over 180ms; it leaves by shrinking to 0.8 over 220ms. The reactions bar pops out over 250ms on Overshoot(0.5), growing from 87.5% across and clipped from the far side, its emojis popping in by distance from 80% across; reactions you already picked sit smaller in a circle. A picked reaction grows, then flies into the message's reaction pill (220ms, EASE_OUT_QUINT across, DEFAULT down). The expand button grows the bar into the emoji panel over 350ms, its corners going from 24 to 12. New **`theme.contextMenu`** token group
- **`getChatCapabilities()`** reports `persistentEmojiRecents`, `mediaLibrary`, `imagePicker`, `documentPicker`, `location` and `sharing`
- **New icons**: `keyboard`, `search`, `backspace`, `emojiAnimals`, `emojiFood`, `emojiActivities`, `emojiTravel`, `emojiObjects`, `emojiSymbols`, `emojiFlags`, `gallery`, `file`, `location`, `download`
- **New labels** for the emoji keyboard and the attachment menu in all 15 locales, and accessibility labels for the emoji, keyboard and attach buttons
- **Telegram Android theme tokens.** New colors: `incomingLink`, `outgoingLink`, `incomingBubbleShadow`, `outgoingBubbleShadow`, `incomingBubbleSelected`, `outgoingBubbleSelected`, `selectionBackground`, `mediaTimeBackground`, `mediaTimeText`, `incomingReplyLine`, `incomingReplyName`, `outgoingReplyLine`, `outgoingReplyName`, `incomingReaction`, `incomingReactionText`, `incomingReactionTextChosen`, `outgoingReaction`, `outgoingReactionText`, `outgoingReactionTextChosen`, `incomingVoiceTrack`, `incomingVoiceFill`, `outgoingVoiceTrack`, `outgoingVoiceFill`, `composerIcon`, `inputCursor`, `scrollToBottomBackground`, `scrollToBottomIcon`, `scrollToBottomBadge`, `scrollToBottomBadgeText`. New radii: `media`, `mediaInner`, `mediaTimePill`, `replyQuote`. New spacing: `bubblePaddingBottom`. New typography: `replyName`, `replyText`, `reactionCount`, `composer`. New groups: `bubble` (`hasTail`, `isTimeInline`, `outgoingGradient`, `outgoingGradientMode`, `maxWidthInset`), `wallpaper` (`isEnabled`, `colors`, `isAnimated`, `pattern`, `patternOpacity`, `patternColor`), `nameColors`, and `avatar.paletteEnd`
- **Wallpaper**: Telegram's `MotionBackgroundDrawable` swirl gradient ported to JS and drawn as a generated image, so it needs no dependency. It turns one step per outgoing message (500ms, bezier(0.33, 0, 0, 1)). Bring your own doodle tile with `wallpaper.pattern` (Telegram's own pattern is GPL and not bundled), replace it with **`renderWallpaper`**, or use the exported **`ChatWallpaper`** component elsewhere
- **Screen-fixed outgoing gradient** (`bubble.outgoingGradient`, the night default): one gradient spans the message list and each bubble shows its slice, tail included, so bubbles shift color as they scroll. `outgoingGradientMode: 'bubble'` gives each bubble the whole gradient instead
- **Bubble tails** on the last bubble of each run, drawn with `react-native-svg` when installed (a straight-edged wedge without it)
- **Inline trailing time**: the time and checks share the last line of text when they fit and wrap below when they do not, without measuring anything (an invisible copy of the time holds its place in the text). The same goes for the last row of reaction pills
- **"edited" mark**: the new `IMessage.isEdited` / `IMessage.editedAt` prefix the time with "edited" (new `edited` label in all 15 locales). `useChatMessages`' edit sets them
- **Failed status**: the new `IMessage.isFailed` draws Telegram's red badge in place of the checks. The checks themselves are now Telegram's thin pair (with `react-native-svg`)
- **Run grouping helper**: `utils.isSameGroup(a, b)` - the same sender, the same day, at most five minutes apart
- **The quote-jump flash tints the bubble too**, in its selected color (`incomingBubbleSelected` / `outgoingBubbleSelected`), alongside the row band (now `colors.selectionBackground`)
- **Swipe-to-reply arrow** draws Telegram's ring as you swipe (with `react-native-svg`), fills the circle at the threshold with a bounce, and sends an outer ring out as it fades
- **Reaction pills bounce** on a tap (0.9 over 60ms, back with an overshoot over 350ms)
- `MessageText` takes a `trailing` node (inline content after the last word), and `MessageReactionsDisplayProps` a `trailing` node and `hasContentAbove`
- **Default message actions**, in Telegram Android's order (`ChatActivity.fillMessageMenu`): Reply, Copy, Forward, Pin / Unpin, Edit, Delete, each with its icon. Forward, Pin, Edit and Delete appear with the new `onForwardMessage`, `onPinMessage`, `onEditMessage` and `onDeleteMessage` callbacks; Unpin reads off the new `IMessage.isPinned`. `defaultMessageActions` picks or orders them by key (`MessageActionKey`), and a `messageActions` function now receives the built-ins as a second argument, so it can extend or filter them (an array still replaces them). Built-in items carry a `key`; new `copy`, `forward` and `pinOff` icons; labels in all 15 locales
- **Edit mode**: Edit puts the message's text in the composer under the "Editing" banner; sending calls `onEditMessage(message, text)` instead of `onSend`, and closing the banner cancels
- **`reply.isEnabled`** and **`reply.onReply`** (a reply started from the menu or a swipe, for controlled reply state)
- **`Chat.toggleReaction(messages, messageId, emoji, userId, { maxPerUser })`** (also exported as `toggleReaction`): the reaction reducer apps used to write themselves. One reaction per user by default, like Telegram
- **`useChatMessages({ initialMessages, user })`**: local message state with `chatProps` wired to sending, reactions, editing and deleting, for prototypes
- **Unread badge on the scroll-to-bottom button**, counting down as new messages scroll into view (Telegram Android's `newUnreadMessageCount`); `isScrollToBottomBadgeEnabled`
- **`isGroupChat`** (auto-detected) and **`isAvatarVisible`**
- **Optional peers resolve through one lazy registry**, and **`getChatCapabilities()`** reports which optional features the installed packages allow. In development a feature that cannot work without its peer logs one hint (`audioRecording` without `expo-audio`, `videoRecording` without a camera package, Copy without a clipboard package). New optional peers: `expo-clipboard`, `@react-native-clipboard/clipboard`
- **Recording**: big record circle with voice-reactive blobs, Telegram's lock (pause once locked), slide to cancel that follows the finger, rolling timer, blinking dot, bin on cancel, and composer transitions
- **Video notes record on the first hold**, with flash, camera switch, pinch zoom and a blurred background (optional `expo-blur`)
- **Pause, resume and trim** a voice take; resuming joins the clips (`react-native-audio-api`), trimming needs optional `expo-file-system`
- **Send animations**: the record circle flies into the new voice bubble, the camera circle into the new round note
- **Voice bubbles** use Telegram's layout and waveform: tap to play, drag to seek, partly played bars, play/pause morph, appear and loading animations
- **Round notes** grow on play, scroll to the middle, hide the avatar, and pause with a scrubbable ring
- **Floating round note** keeps playing when its row scrolls away (`mediaPlayback.isFloatingRoundNoteEnabled`)
- **"Now playing" bar** at the top of the chat (`mediaPlayback.isNowPlayingBarEnabled`)
- **Auto-play next note** and **one shared playback speed** (`mediaPlayback.playbackRate`, `onPlaybackRateChange`)
- **View once**: `audioRecording` / `videoRecording.isViewOnceEnabled`, `IMessage.isViewOnce`, `mediaPlayback.onViewOnceEnd`
- **Transcription**: `mediaPlayback.onTranscribe` and `IMessage.transcription`
- **Raise to listen** via `mediaPlayback.isNearEar` (feed it from a proximity sensor)
- **Hints and haptics** (optional `expo-haptics`); `onMediaRead`, `videoRecording.onTooShort`; new labels in all 15 locales
- **`reactions.renderExpandedPicker`**: Telegram's expand button. The reactions bar ends in a chevron that grows the bar in place into a panel holding your content (a full emoji grid, say)
- **`ReactionPickerProps.messagePreview`**: a custom `renderReactionPicker` receives a copy of the pressed bubble to draw above its backdrop; while it is rendered, the original is hidden. `ReactionPickerProps` also gets `touchX` / `touchY`
- **`ContextMenu` props for custom pickers**: `messagePreview`, `children`, and `reactions.containerStyle` / `emojiStyle` / `renderAccessory` / `renderExpandedPicker`

### ⚡ Performance
- **The expanded reactions panel no longer re-lays out its content on every frame of the expand.** The content is laid out once at the panel's final size and revealed by the growing, clipped panel, as in Telegram. Before, a grid passed to `reactions.renderExpandedPicker` was resized and re-rendered each frame

### 🐛 Fixes
- **Android: the time no longer prints twice in every bubble.** The invisible copy of the time that keeps its place at the end of the text was colored `'transparent'`; on Android a fully clear color on a nested `Text` counts as unset, so it inherited the bubble's text color and showed next to the real time. It now uses a one-step alpha that is invisible everywhere (`HIDDEN_TEXT_COLOR`)
- **Android: the composer no longer drops onto the gesture bar with a floating keyboard or a stylus toolbar.** The island's bottom inset faded out with the keyboard's progress, which reaches 1 even when the keyboard covers nothing at the bottom; it now follows how much of the inset the keyboard actually covers
- **Android: the emoji keyboard's search opens the soft keyboard.** A field focused in the frame it mounts in got the cursor but never the keyboard on Android; the search field now asks for focus itself once attached
- **Emoji search ranks the emoji named exactly the query first** ("fire" gives 🔥, not the fire engine), as Telegram's keyword search does
- **The long-press reactions bar no longer lands on a short message pressed in its middle.** The check that moves the menu off the lit message looked only at the card, not the pill above it, so on a one-line bubble the pill covered the text (seen first on a Pixel)
- **The attachment menu's caption field is readable over the photo grid**: it floats over the photos, and its faint cell tint let the picture under it show through the text. It now uses the tab bar's frosted fill and stroke
- **`react-native-streamdown` 0.3 renders again.** The integration looked for a `Streamdown` (or default) export, which 0.3 replaced with `StreamdownText`, so an installed streamdown was silently ignored. `StreamdownText` is used now, with the text passed as `markdown`, the bubble's text color, size and link color mapped onto its `markdownStyle` (a `markdownStyle` in `markdownProps` is merged over it per element) and link presses routed to `onPress`. 0.3 runs remend on a worklet runtime, which needs react-native-worklets' Bundle Mode; without it the first render threw "Tried to synchronously call a Remote Function" and took the screen down, so the built-in renderer stays in use (with a one-time dev hint) until the app enables `bundleMode`. The older `Streamdown` export still works
- The empty-chat greeting's button is labelled "Send 👋" for screen readers instead of repeating the hint text above it
- **With markdown on, the time shares the last line when it fits**, as with plain text, instead of always taking a line of its own: the built-in renderer flows it after a closing paragraph, heading or list item, and gives it its own line after a code block or a quote (Telegram does the same for a trailing code or quote block). A streaming reply keeps it below the caret
- **A short message's text no longer slides out of its bubble when it gets a reaction.** The time reserved on the row of reaction pills sat inside the pills' wrapping row; when the pills and the time set the bubble's width (a one-word message), a rounding error wrapped the time onto a row of its own after the bubble had been sized, and the text above was pushed out of the top. The reserved time now sits beside the pills instead of in their row
- **No more "Deep imports from the 'react-native' package are deprecated" warning on app start.** The clipboard lookup kept a last-resort `require` of React Native's old core Clipboard, and React Native's Babel preset warns about any deep import in a loaded module, whether or not it runs. The fallback is gone: Copy uses `expo-clipboard` or `@react-native-clipboard/clipboard`, as documented
- **A long-press on a photo, location card, play button or media card no longer also fires it on release.** The menu opened and then the photo viewer, maps or playback started as the finger lifted. Holding as long as the message long-press now counts as a long-press for those tappables too
- Starting a recording pauses the playing note
- The `expo-audio` fallback player plays one note at a time
- Cancelling a video note closes the recorder
- Resuming a voice take on iOS no longer overwrites the audio recorded before the pause
- **Overlays animate with Reanimated and play their exit before unmounting.** These overlays used the native `Modal` fade and slide, which cut off the moment they closed: the context menu, the reaction picker, the attachment sheet's Modal fallback, the voice speed presets and the round video recorder's layer. The attachment sheet's fallback now runs an action after the sheet has slid away, so a picker it opens no longer presents over a half-closed sheet
- **The context menu can no longer cover a neighbouring message or the home indicator.** It used to open over the message below and ignore the bottom inset under a navigator; it now keeps clear of the window's safe areas
- **The context menu and reaction picker follow RTL**: they align to the side the bubble is drawn on
- **The native attachment sheet reports its dismissal again.** It still passed true-sheet 2's `sizes` and `onDismiss`, which 3.0 renamed to `detents` and `onDidDismiss`, so with true-sheet 3 the sheet ignored its auto height and swiping it away never told the composer it had closed. Closing it natively no longer asks it to dismiss a second time either
- **The library's types compile against React Native 0.88's strict TypeScript API.** It no longer imports `ViewToken`, `ViewabilityConfigCallbackPair` or `CellRendererProps`, which 0.88 stopped exporting, and refs to `View` and `TextInput` are typed through `ComponentRef`, so the published `.d.ts` files work with both the strict and the older typings
- **No more `[Reanimated] dependencies should only be used in web implementation.` from the message list.** Its scroll handler passed a dependency array, which Reanimated warns about on native for every render. It is gone; Reanimated tracks the handler's captures itself

### 📦 Dependencies
- **New optional peers** for the built-in emoji keyboard and attachment menu, each through the optional-peer registry: `@react-native-async-storage/async-storage` (emoji recents), `expo-media-library` (in-sheet gallery; SDK 58's `expo-media-library/legacy` API, or the root of older versions), `expo-document-picker` (File), `expo-location` (Location), `expo-sharing` (opening a received file), `expo-image` (gallery thumbnails from `ph://` assets without copying them first). `expo-image-picker` now also backs the Gallery fallback and the camera
- `emoji-datasource` 16.0.0 is a root dev dependency, for `scripts/build-emoji-data.cjs`
- Library toolchain: React Native **0.86.3 → 0.88.1** (and the `@react-native/*` packages), React **19.2.3 → 19.3.1**, `react-native-gesture-handler` **2.32 → 3.4.0**, `react-native-reanimated` **4.6 → 4.7.1**, `react-native-worklets` **0.12 → 0.13.1**, `react-native-keyboard-controller` 1.22.9, `react-native-safe-area-context` **5.7 → 5.11.0**, `@shopify/flash-list` 2.3.3, `react-native-zoom-reanimated` 1.6.0
- Tests: **Jest 29 → 30.5.2** (with `babel-jest` 30 and `@types/jest` 30), `@testing-library/react-native` 14.1.0, `test-renderer` 1.3.1. `@react-native/jest-preset` 0.88 still lists Jest 29 packages for its environment, but the suite runs unchanged under Jest 30
- Lint: ESLint 10.14, `@typescript-eslint` 8.72.1, `eslint-plugin-perfectionist` 5.13, `eslint-plugin-jest` 29.17, `lint-staged` 17.6
- **Held back**: TypeScript stays on **6.0.3** - `@typescript-eslint` 8.72 supports `typescript >=4.8.4 <6.1.0`, so TypeScript 7 breaks linting. Babel stays on **7.29** - `@react-native/babel-preset` 0.88 is built from Babel 7 plugins, and under `@babel/core` 8 it fails with `Requires Babel "^7.0.0-0", but was loaded with "8.0.10"`

### 📲 Example app
- **Runs on Android.** `example/android` is regenerated with `expo prebuild --clean`, and the example was walked end to end on a Pixel 9 (API 36) emulator in light and dark
- **The AI Bot renders through `react-native-streamdown`**: the worklets Babel plugin runs with `bundleMode: true` and `importForwarding: { moduleNames: ['remend'] }`, and `metro.config.js` is wrapped in `getBundleModeMetroConfig` and watches `react-native-worklets/.worklets`
- **The Chats tab shows the new defaults**: no recording props any more (Basic neither), an "Unread Messages" bar when a chat with unread messages opens (taken from the unread count before opening reads it), link previews in Max Ivanov, Design Digest and RN Releases, big emoji in Anna and Max, and the greeting card in a new chat. The Links example draws a preview from message data and fetches others through a mock `fetchLinkPreview` (send `expo.dev`)
- **New Chats tab**: a Telegram Android chat list built on the defaults (`DialogCell`'s two-line layout: 70pt rows, 52pt letter or photo avatars in Telegram's seven gradients, 16 Medium names, 15 previews with "You: " / sender prefixes and media labels with thumbnails, times, read checks, unread badges in `#229AF0` or grey when muted, pin and mute icons, the green online dot, dividers inset 72). Swipe a row towards the start edge to archive it (blue background, the grey circle grows past 45% of the width with a tick, as in `DialogsActivity.SwipeController`), long-press to select chats and pin, mute, archive or delete them from the header, search by name, open the Archived Chats row, or start a chat from the pencil button. Light and dark follow Telegram's day and "Dark Blue" themes, and the layout mirrors in RTL
- **Each chat is a bare `<Chat>`** fed from a small store in the example: `messages`, `onSend`, `user`, plus `isGroupChat`, `isTyping`, the reaction / edit / delete handlers and the opt-in voice and round video recording. A Telegram-style header shows the avatar, name and "online" / "last seen" / members / subscribers, and channels get a Mute button instead of the composer. Sending moves the chat to the top (under pinned ones), updates its preview, and after a moment the other side types (in the header, the list and the chat) and replies, reading your messages. Opening a chat clears its unread count
- **The examples are slimmed to defaults plus what each one demonstrates.** Reactions drops its own picker (`reactions/EmojiReactionPicker.tsx`, `reactions/FullEmojiPicker.tsx` and its 77 KB `emojiData.ts`) for the built-in bar and grid, and shows a custom quick-reaction set instead. Context Menu adds a custom Info action through the `messageActions` function. Basic, Media, Reply, Day Animated, Slack, AI Bot, Links and Top Aligned lose their background wrappers, `getColorSchemeStyle` (`utils/styleUtils.ts`, deleted), the `_id` / `user` / `createdAt` mapping in `onSend` that `Chat` already does, and `isScrollToBottomEnabled`, which is on by default. Links no longer forces light mode and wraps itself in one `ActionSheetProvider` instead of two
- Theming, Localization and Top Aligned share an `OptionChips` toolbar that follows dark mode; the AI Bot's Stop button uses the theme accent; the Slack screen drops the wallpaper for Slack's plain background, and its names and checks follow the theme in dark mode
- **Basic and Media & Voice use the built-in emoji keyboard and attachment menu.** Their own emoji sheet (`components/EmojiPicker.tsx`), attachment tiles and picker helpers (`example-expo/mediaUtils.ts`), and the controlled `text` they needed to insert emoji are gone. Media & Voice shows a file message
- The example installs `expo-media-library`, `expo-document-picker` and `expo-sharing` (SDK 58 versions) and lists the image picker, media library and location plugins in `app.json` with their usage strings, plus the location and media permissions for Android
- Chat screens no longer pad the bottom inset with the composer's color: the wallpaper runs under the home indicator, and the composer island keeps clear of it
- The theming screen's presets follow the new defaults: "Telegram" is the built-in look, "Blue" and "Purple" set light outgoing text, "WhatsApp green" turns the wallpaper off
- The context-menu screen marks an edited message with `editedAt`
- **Expo SDK 57 → 58**: React Native 0.88.1, React 19.3.1 and the SDK 58 `expo-*` packages. Ahead of what SDK 58 pins: `react-native-gesture-handler` 3.4.0 (pins ~3.3.0), `react-native-worklets` 0.13.1 (0.13.0), `react-native-keyboard-controller` 1.22.9 (1.22.7), `react-native-safe-area-context` 5.11.0 (~5.10.1), `@react-native-async-storage/async-storage` 3.1.1 (2.2.0), `@shopify/flash-list` 2.3.3 (2.3.2)
- **Majors**: `react-native-vision-camera` 5.2.4 (with `react-native-nitro-modules` 0.37.1 and `react-native-nitro-image` 0.15.2), `@react-native-async-storage/async-storage` 3.1.1, `@lodev09/react-native-true-sheet` 4.0.1, `emoji-datasource` 16.0.0 (the emoji panel's data is regenerated from it). Also `react-native-audio-api` 0.13.6, `react-native-streamdown` 0.3.0, `react-native-enriched-markdown` 1.1.1, `katex` 0.19.1, `lucide-react-native` 1.65.0
- **The worklets patches are gone.** `react-native-audio-api` 0.13.6 and `expo-modules-core` 58 call worklets' `runSync` themselves, so `.yarn/patches/` and the `resolutions` entry that wired them are removed
- vision-camera 5 has no config plugin, so the camera and microphone usage strings moved from its plugin entry into `app.json`'s `ios.infoPlist` and `android.permissions`. `edgeToEdgeEnabled` is dropped from `app.json`: SDK 58 no longer reads it, since Android 16 makes edge-to-edge mandatory
- `RectButton` (deprecated in Gesture Handler 3) is replaced by `Touchable` in the Explore list, the collapsible and the Slack bubble
- **The chat screens use an opaque header.** Expo Router 58 draws a transparent Liquid Glass header by default and lets the screen scroll under it; on iOS 26 the system then blurs scroll content beneath it, and on an inverted chat list that blur covered every message. `headerTransparent: false` keeps the list below the header
- Metro resolves package `exports` again (it was switched off): SDK 58 packages import each other through `exports` subpaths, starting with `@expo/metro-runtime` -> `@expo/log-box/LogBox`. The Lucide icons are imported through the package's own `lucide-react-native/icons/<name>` subpaths instead of physical `dist/` files, which also drops a TypeScript path mapping; `trash-2` is `trash` in Lucide 1.65
- The example's `tsconfig` maps `react-native` to its `types_generated` entry, since 0.88 publishes types only through `exports`, and the examples take `useColorScheme` from the app's own hook, which narrows 0.88's nullable result
- **Reactions: the full emoji panel opens without stalling.** The `react-native-emoji-chooser` grid it used mounted ~600 animated touchables at once - about 0.6s of JS (dev build) landing on the expand animation. It is replaced by a small virtualized grid (search, recents and category tabs kept) over a 69 KB dataset generated from `emoji-datasource`, instead of its 1.3 MB JSON. The first expand after launch dropped from ~630ms to ~80ms of JS in a dev build
- **Dark mode follows the theme in every example.** Slack, Reply, AI Bot, Reactions, Day Animated and Top Aligned no longer paint a black list and a `#1a1a1a` input over the built-in Telegram dark palette
- **Basic Example uses the Telegram-style composer** from Media & Voice: emoji button and paperclip in the field, an attachment grid (Gallery, Camera, Location), and voice / round video recording. The old `+` action-sheet button, the bottom icon bar and the hard-coded dark colours are gone, so the built-in light and dark themes apply
- **Slack Style**: the avatar sits beside the author line of a group instead of under its last message, the latest group shows its avatar again, and location messages render instead of showing an empty row
- **Links & Patterns**: timestamps now increase down the list instead of running backwards
- **Top Aligned**: the option chips wrap instead of running off the screen
- **Theming & Icons**: the presets did nothing on a device in dark mode, because they only set `theme`, which applies to light mode. Each preset now sets `darkTheme` too
- **Reactions**: the custom picker is built on `ContextMenu`, so it has the same Telegram feel as the built-in one. Its full emoji browser now opens in place through `renderExpandedPicker`, instead of in a separate sheet
- **Context Menu**: Copy and Delete have icons

### 📝 Docs
- **README screenshots are new**: the chat list (light and dark), a group chat with a photo, a file, a quote and reactions (light and dark), the emoji keyboard, the attachment menu, link previews with a big-emoji message, and the long-press menu, reaction pill and expanded reactions grid. Unused `logo_sponsor.png` and `stream-logo.png` are removed from `media/`
- README: what `react-native-streamdown` 0.3 needs (Bundle Mode) and how `markdownProps.markdownStyle` merges
- README: the emoji keyboard and attachment menu in the Props Reference, `IMessage.file`, the new optional peers, and the iOS / Android permission keys each peer needs
- **README troubleshooting: a blurred message list on iOS 26.** Under a transparent navigation header (Expo Router 58's default) the system's scroll edge effect blurs the whole inverted list; the fix is an opaque header
- README requirements and install steps follow the new peers (React Native 0.82+, React 19, gesture-handler 3, vision-camera 5 with its Nitro packages)
- README documents every `audioRecording`, `videoRecording` and `mediaPlayback` option
- **Troubleshooting entry for "Cannot read property 'Chat' of undefined"** ([#28](https://github.com/kesha-antonov/react-native-chat/issues/28)). The package itself loads fine - the published 5.0.1 renders the Quick start example unchanged in a fresh Expo SDK 58 app - so the error means a dependency threw during import and Metro handed back an empty module. The entry points at the earlier error that names the real cause, usually a native peer that was installed without rebuilding the app or at a version the app does not ship
- **Bare React Native install steps were incomplete.** They left out `react-native-worklets`, which Reanimated 4 requires, pointed at the Reanimated 3 Babel plugin name, and never said to rebuild the native app after installing. All three are covered now

## [5.0.1] - 2026-09-15

### ⚡ Performance
- Message rows no longer allocate a day wrapper or per-commit objects on every render
- The full-screen image viewer mounts only once it is opened, instead of with every message that carries an image
- The link parser and the touchable's style list are memoised
- Bubble press-scale and gestures moved onto the overlay path only, so they are not rebuilt for bubbles that never use them

### 📦 Other
- **Documentation site:** [kesha-antonov.github.io/react-native-chat](https://kesha-antonov.github.io/react-native-chat/), generated from this README so the two cannot drift apart
- **Releases publish from CI through npm trusted publishing.** The tarball now carries provenance - a signed, verifiable link back to the workflow run that built it - and there is no npm token stored in the repository to leak or rotate

## [5.0.0] - 2026-09-03

### 💥 Breaking
- **`disableKeyboardProvider` → `enableKeyboardProvider`, `disableGestureHandlerRootView` → `enableGestureHandlerRootView`.** Both were opt-out flags with inverted (double-negative) naming - `disableX = false` to get the default. Renamed to positive, opt-in flags (default `true`, matching the previous default behavior); pass `false` to get the old opt-out effect. `enableGestureHandlerRootView` only shipped in 4.4.0, two days ago, so this is a straight rename rather than a deprecated alias.

### 🐛 Fixes
- Pinned `collapsable={false}` on the view wrapping the message list and composer. Its only paint prop (`opacity`) is conditional on the chat's ready state, so on every mount that view's Fabric shadow-node flattening eligibility flipped once, right after becoming ready - restructuring the Yoga tree directly above the composer on the same cycle a remounted `Chat` first accepts a keystroke. That matches the timing of the Fabric/Yoga layout assertion still being reported against [#17](https://github.com/kesha-antonov/react-native-chat/issues/17) even with `enableGestureHandlerRootView={false}` set; upstream (facebook/react-native#48203, #52349) remains unresolved, so this narrows one concrete trigger rather than closing out the underlying RN bug.
- **Stopped flooding the dev console with Reanimated warnings.** 16 call sites passed a dependency array to `useAnimatedStyle` / `useDerivedValue` / `useAnimatedReaction`, and Reanimated 4 logs `[Reanimated] dependencies should only be used in web implementation.` once per call per render when one is passed on native. The array on `Item`'s per-row day lookup meant one warning per message row per render, so simply browsing the example app produced over 3000 of them, burying anything else in the log. No behavior change: with the Babel plugin (which every React Native and Expo setup has) the hooks derive their inputs from the worklet's closure on both native and web, so the arrays were only ever read by a plugin-less web build

### 📲 Example app
- **Replaced three dead sample-asset hosts.** `download.blender.org`'s `BigBuckBunny_320x180.mp4` and `file-examples.com`'s sample MP3 now both 404, and `placeimg.com` no longer resolves at all - so Media & Voice rendered black boxes instead of video, the audio bubble in Basic / Reply / Slack / Reactions had nothing to decode, and every avatar plus the sample image in Customized Rendering came up blank. They now point at `test-videos.co.uk` (Big Buck Bunny, 10s), the SoundHelix MP3 the Media example already used, and `picsum.photos`. Same swap in `expoSnack/ExpoSnack.tsx`
- **Slack Style no longer prints a day pill above every message.** Its custom `renderMessage` rendered its own `<Day>` with no same-day guard, while the list already renders a day separator on each day change around whatever `renderMessage` returns - so "Today" repeated between every message and the real separator showed twice. A custom `renderMessage` should not render its own day header
- **Links & Patterns no longer turns dates into phone links.** The screen's deliberately loose phone pattern also matches ISO dates like `2025-12-25`, and the "disabled" branch of its `renderLink` only dropped the underline - the text stayed pressable and was still announced as a link to screen readers. Candidates that libphonenumber-js rejects now render as ordinary text

### 🔧 Deprecations
- **`minComposerHeight`, `maxComposerHeight`, `minInputToolbarHeight` are still here.** 4.4.0 said they would go in `5.0.0`; they stay one more major so this release is a rename-only break, and are now slated for `6.0.0`. Nothing has ever read them, so setting them still does nothing - use `textInputProps.style` to constrain the composer ([#14](https://github.com/kesha-antonov/react-native-chat/issues/14))

### 📝 Docs
- `AGENTS.md` still described the built-in translations as `en, es, fr, de, ru`; there have been 15 since 4.4.0

## [4.4.0] - 2026-08-20

### ✨ Features
- **Right-to-left (RTL) layout support.** `Chat` now auto-detects right-to-left languages (Arabic, Hebrew, Persian, Urdu, and a few others) from the `locale` prop and mirrors the chat accordingly: message bubble side, avatar side and spacing, bubble corner radii, the input toolbar's control order, and the voice-message slide-to-cancel gesture direction. Override the auto-detection with the new `forceRTL` prop. Every consumer-facing `LeftRightStyle` override (bubble colors, per-message style overrides) still resolves by message ownership ("my messages" vs. "theirs"), not by which physical side a message happens to render on. New `useIsRTL()` hook, plus `isRTLLocale` / `mirrorPosition` exports.
- **11 more built-in languages.** Chinese, Arabic, Portuguese, Japanese, Korean, Italian, Turkish, Hindi, Dutch, Polish, and Indonesian join the existing English/Spanish/French/German/Russian translations, bringing built-in `locale` coverage to 15 languages. (Each now lives in its own file under `src/locales/`, with a single source of truth that a locale missing its bundled `dayjs` locale data fails to typecheck against, instead of only failing a runtime test.)

### 🐛 Fixes
- **New `disableGestureHandlerRootView` prop** to skip the `GestureHandlerRootView` Chat mounts around itself, for apps that already mount one (directly, or via something like a bottom sheet library). A nested one can't be auto-detected the way `KeyboardProvider` is - `react-native-gesture-handler` doesn't expose that publicly - so this is an explicit opt-out. Reported alongside a rare Fabric/Yoga layout assertion on iOS that gets more likely with a nested root view ([#17](https://github.com/kesha-antonov/react-native-chat/issues/17)).
- Locked in the "reuse the app's `KeyboardProvider`?" decision on mount instead of re-reading it every render, so `Chat` can no longer be re-parented between a `KeyboardProvider` and a bare fragment mid-lifetime - a structural change React can only handle by unmounting and remounting the whole subtree ([#17](https://github.com/kesha-antonov/react-native-chat/issues/17)).
- The input toolbar no longer briefly renders at offset 0 when the chat mounts with the keyboard already up and isn't full-screen (e.g. below a navigation header). It now stays hidden until the real on-screen position has been measured, instead of revealing as soon as the layout event that kicked off that measurement fires ([#12](https://github.com/kesha-antonov/react-native-chat/issues/12)).
- **`theme.spacing.inputToolbarPaddingV`** themes the input bar's vertical padding, and `theme.spacing.screenEdge` now accepts independent `left`/`right` values (a single number still works, for backward compatibility) ([#18](https://github.com/kesha-antonov/react-native-chat/issues/18)).
- **Day/Time month and day names now actually localize.** They previously fell back to English silently whenever the *host app's* `dayjs` instance had registered the locale rather than this library's own - easy to hit in any workspace/monorepo where more than one physical copy of `dayjs` ends up installed. This library's own `dayjs` instance now always carries the locale data for every language it ships translations for.

### 🔧 Deprecations
- **`minComposerHeight`, `maxComposerHeight`, `minInputToolbarHeight`** are now marked `@deprecated`. None of the three has ever been read anywhere - they're vestigial from `react-native-gifted-chat` - so setting them has always silently done nothing. Use `textInputProps.style` to constrain the composer instead. They'll be removed in `5.0.0` ([#14](https://github.com/kesha-antonov/react-native-chat/issues/14)).

## [4.3.0] - 2026-08-06

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
- **Voice note playback, fully interactive**: drag-to-scrub and tap-to-seek on the waveform, a playback-speed pill (1x / 1.5x / 2x), a disabled control while the file decodes, and a bar count derived from the measured width instead of a fixed 40 (which overflowed its row). `IMessage.duration` labels a note before its file has decoded.
- **Only one thing plays at a time**: a shared playback registry stops whatever else is playing when a voice note or round video note starts, the way Telegram behaves. Previously every bubble owned an independent player.
- **Round video notes redesigned after Telegram**: sized from the screen rather than a fixed puck, with a circular progress ring, a duration + unwatched dot rendered under the circle on the chat background, a mute badge while silent, and a stop target while playing.
- **Video note recorder redesigned after Telegram**: the conversation dims behind the recorder instead of being replaced by near-black, the preview fills most of the screen width, the progress arc is a thin white stroke with no track, camera flip and torch share a pill, a pause control appears mid-take, and the recording bar carries a red dot, an `m:ss,t` timer with tenths and a centred CANCEL beside a large send button.
- **Hold-to-record video notes**: the shutter now uses the same three-way gesture as a voice note - hold to record, slide up to lock, slide left to cancel - so the muscle memory carries between the two recorders.
- **One control for both recorders**: when voice and video are both enabled, a single tap swaps the right-slot control between mic and camera and a hold records, matching Telegram. The inset camera button inside the field is dropped in that case so there is only one camera entry point.
- **Locked voice recording gets real controls**: a 44pt trash target and a live waveform driven by the microphone's metering, replacing the "Cancel" text link. The amplitude halo now tracks measured loudness instead of pulsing on a timer.
- **`isMultiline`** on `<Chat>`: `true` (default) keeps the return key inserting a newline; `false` turns it into Send, which is what a single-line composer should do. The composer previously had no submit handler at all, so the return key could never send.
- New `AudioRecordingProps` options - `maxDurationMs`, `onPermissionDenied`, `onTooShort` - and `VideoRecordingProps` gains `minDurationMs` and `onPermissionDenied`, so a denied permission or a discarded take is no longer silent.

### 🐛 Bug Fixes
Voice recorder:
- **A quick tap left a recording nothing could stop.** `start` awaits three native calls, so a release could land before the recorder was live; `finish` then bailed and `start` went hot with no gesture in progress. Measured on a simulator: a 40ms tap produced a timer at 0:26 and climbing, with the composer replaced by the recording bar and no control on screen that ended it. The release is now remembered and applied once the recorder is actually running.
- **A locked recording silently discarded the *next* take.** `onFinalize` returned early on the locked path, leaving the `cancelArmed` shared value latched, so the following motionless release read as "cancelled" and sent nothing with no explanation.
- **The recorder was never stopped on unmount**, leaving the microphone hot (and the iOS recording indicator lit) after navigating away, with the toolbar stuck showing a frozen bar.
- **The audio session was left in PlayAndRecord**, routing output to the receiver and muffling every voice note played after recording one.
- **A refused microphone permission returned silently**, leaving a permanently dead button on iOS, which never re-prompts.
- The lock pill's chevron pointed **down** while the lock gesture is up.

Video note recorder:
- **The shutter stayed live with no camera device**, so pressing it called `startRecording` on a null ref, threw, and dismissed the entire sheet with no message - what you get on any simulator.
- **Closing mid-recording never stopped the camera.** vision-camera kept recording into an orphaned file and its completion callback could post the note the user had just cancelled.
- The hint read **"Cancel" directly under a button that sends**.
- **Removed the POC path** that sent a hardcoded, Google-hosted sample MP4 as the user's own video note whenever the native module was not linked.

Playback:
- **The waveform never worked.** `ctx.decodeAudioDataSource(uri)` does not exist in `react-native-audio-api` 0.13; every voice note threw during decode, was swallowed by the catch, and silently degraded to a tappable card. Now calls `decodeAudioData`, falling back to the old name for older versions.
- **The play control was invisible on outgoing bubbles**: `colors.accent` and `colors.outgoingBubble` are the same azure in the default light theme, so the circle vanished into the bubble at 1:1 contrast. A shared, position-aware media palette now inverts the control on the sender's side.
- **A round note's timestamp and ticks rendered white on the light chat background**, because the note strips its bubble background while the meta row kept the outgoing palette.
- **Pausing a voice note rewound it to 0:00** - `source.stop()` also fires `ended`, so pause ran the completion handler.
- **Round notes autoplayed muted on a loop from mount**, so every note in a list played at once and none could ever be heard. They now hold their first frame and play with sound on tap.
- **Incoming round notes were pinned to the right edge** by a hardcoded `alignSelf`.

Chat and composer:
- **The input toolbar could sit behind the keyboard.** `useKeyboardVerticalOffset` read the nearest `SafeAreaProvider` frame, but react-native-safe-area-context seeds a nested provider from its parent - so with an app-level provider (the documented setup, and what expo-router does) the offset stayed 0 however far down the screen the chat started. It is now measured from the chat container itself with `measureInWindow`.
- **Every chat mount visibly jumped.** The same nested-provider seeding made the toolbar render once with the window's insets and again with the measured ones - bottom 34 -> 0 on an iPhone. Chat's provider is now seeded with zero insets, so the first frame matches what a chat inside a navigator settles on.
- **The composer never grew with its content** - not on a newline, and not on wrapping text either. It sized itself from `onContentSizeChange` into an explicit height with `scrollEnabled` false until already at maximum, and the two conditions deadlocked: the handler fired once at mount and never again. It now auto-sizes between `minHeight` and `maxHeight`.

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

### 📦 Dependencies (example app)
- The example app moves to **Expo SDK 57** (React Native 0.86.2, React 19.2.3, gesture-handler 2.32, reanimated 4.5.3, worklets 0.10.3), and the library's own toolchain now mirrors it rather than drifting behind. Adds `react-native-audio-api` so the waveform path is actually exercised.

### 🛠️ Tooling
- Migrated the library and the example app to **Yarn 4** (corepack-driven `packageManager`, `nodeLinker: node-modules`, Berry lockfiles). CI now enables corepack and uses `yarn install --immutable`.

### 📝 Docs
- New README sections covering the redesign: "What's new vs react-native-gifted-chat", one-line theming, voice/video/location messages, custom icons (e.g. Lucide), markdown rendering for AI replies, the long-press message-actions menu, and a performance overview.
- Added a migration guide from `react-native-gifted-chat`.

### 📲 Example app
- New demo screens (registered in the chat stack and the "Explore" list): **Context Menu**, **Media & Voice**, **Theming & Icons**, and **Localization (i18n)**.
- Added a lightweight `EmojiPicker` for the composer emoji-button demo, and updated the AI bot and Slack examples for the new theming/composer APIs.

## [4.2.0] - 2026-08-05

### ⚠️ Upgrade notes
Everything new in this release is opt-in, but four fixes change how an existing chat lays out. Read these before upgrading:

1. **Remove `useHeaderHeight()` if you pass it to `keyboardVerticalOffset`.** The default used to be `insets.top`, which could not see a navigation header, so the README recommended compensating with `useHeaderHeight()`. Chat now measures the offset itself - if you keep passing it, the toolbar floats above the keyboard by a header height. This is the only change that requires a code edit.
2. **The message row is full-width now** and the 70% width cap moved from the row onto the bubble. Custom `containerStyle` / `wrapperStyle` overrides that assumed the old row width may render differently; bubbles beside an avatar get slightly more room.
3. **Chat no longer passes `statusBarTranslucent` / `navigationBarTranslucent`** to the `KeyboardProvider` it mounts. If you relied on Chat forcing that, set it yourself through `keyboardProviderProps`.
4. **A `KeyboardProvider` mounted by your app is now detected and reused.** In that setup `keyboardProviderProps` no longer applies - configure the provider where you mount it. `disableKeyboardProvider` still opts out entirely.

### ✨ Features
- **Row-wide press target for reactions**: the long-press surface now spans the whole message row instead of just the bubble, so pressing the empty space beside a bubble opens the reaction picker - matching Telegram on Android. The message row is full-width now and the 70% width cap moved from the row onto the bubble itself (bubbles beside an avatar therefore get slightly more room).
- **`isMessageGestureEnabled`**: opt a message's *bubble* out of that surface (accepts a bool or a per-message predicate) for content that must own its touches - e.g. `isMessageGestureEnabled={message => !message.video}`. The surface moves behind the bubble rather than disappearing, so long-pressing beside the bubble still opens the picker and reactions are never lost for that message.
- **Optional FlashList engine** ([#3](https://github.com/kesha-antonov/react-native-chat/issues/3)): set `isFlashListEnabled` to render messages with `@shopify/flash-list` v2 instead of `FlatList`, which recycles rows and removes the `VirtualizedList: You have a large list that is slow to update` warning on long histories. `@shopify/flash-list` is an **optional** peer dependency - when it is missing the prop is ignored, a warning is logged, and `FlatList` is used. The chat wires FlashList's `maintainVisibleContentPosition` for you (`startRenderingFromBottom` on non-inverted lists, `autoscrollToBottomThreshold: 0.2`), and `listProps` still overrides everything. `isInverted`, the floating day header, infinite scroll and the scroll-to-bottom button all keep working.

- **Keyboard-aware top alignment** ([#2736](https://github.com/FaridSafi/react-native-gifted-chat/issues/2736)): `isAlignedTop` now takes `'auto'` as well as a boolean. In `'auto'` a conversation that fits on screen sits at the top while the keyboard is closed and re-anchors to the bottom while it is open, so a two-message chat starts under the header and moves above the keyboard when the composer is focused. Alignment moved from the wrapper onto the list's content container (`flexGrow` + `justifyContent`), which also fixes `isAlignedTop: true` for long chats: the list used to size itself to its content and get clipped by the chat container, leaving the messages unscrollable. Works with either `isInverted` setting. Only `'auto'` subscribes to keyboard events, so the other modes cost nothing. Ignored (with a warning) when `isFlashListEnabled` is set, since FlashList positions its own items.

### 🐛 Bug Fixes
- **Android navigation bar overlapping the app after leaving the chat** ([#2755](https://github.com/FaridSafi/react-native-gifted-chat/issues/2755)): the `KeyboardProvider` Chat mounts for you passed `statusBarTranslucent` / `navigationBarTranslucent`. On Android those tell the provider the app already draws behind the system bars, and it answers by zeroing the *activity content view's* margins - a window-level change it never undoes, so once a chat screen had been visited the whole app kept drawing under the navigation bar and a bottom tab bar ended up beneath the 3-button navigation. Chat no longer passes them: `react-native-keyboard-controller` turns both on by itself when the app is genuinely edge-to-edge (`react-native-edge-to-edge` installed, or RN's `isEdgeToEdge` constant), so forcing them could only ever mismatch a window that is not - and in an edge-to-edge app they additionally logged *"statusBarTranslucent and navigationBarTranslucent values are ignored"* on every mount. `keyboardProviderProps` still sets them explicitly if you need to.
- **Input toolbar hidden behind the keyboard** ([#11](https://github.com/kesha-antonov/react-native-chat/issues/11)): `keyboardVerticalOffset` means "how far down the screen the chat container starts", and it defaulted to `insets.top`. That value cannot see a navigation header - and because Chat mounts its own `SafeAreaProvider`, whose insets are clamped to the provider's on-screen position, a chat below a header got `0`. The toolbar therefore ended up roughly a header-height too low, i.e. behind the keyboard. Chat now takes the offset from its `SafeAreaProvider` **frame**, which safe-area-context measures natively against the root view (`offsetDescendantRectToMyCoords` on Android, `convertRect:toView:` on iOS) and refreshes on every layout change - so the toolbar sits on the keyboard whether the chat is full-screen or under a header, with no props to set. Passing your own `keyboardAvoidingViewProps.keyboardVerticalOffset` still overrides it. **If you currently pass `useHeaderHeight()` to work around this, remove it** - otherwise the toolbar will now float above the keyboard by that amount.
- **Nested `KeyboardProvider`** ([#11](https://github.com/kesha-antonov/react-native-chat/issues/11)): `Chat` mounted its own `KeyboardProvider` unconditionally, so an app that already mounts one at the root (the setup `react-native-keyboard-controller` documents) ended up with two. That is not harmless on Android: each provider installs an `OnApplyWindowInsetsListener` on the *activity's* root view and rewrites the content view's margins from its own `statusBarTranslucent` / `navigationBarTranslucent` props, so the nested provider relayouts the whole host app - and never restores the listener it replaced, leaving the app affected even after the chat screen is gone. Every keyboard event was also dispatched twice. `Chat` now detects a `KeyboardProvider` above it and reuses it; it still mounts one when the app has none, so no setup changes are needed. `disableKeyboardProvider` keeps working as an explicit opt-out.
- **Video controls no longer dead when reactions are enabled** ([#1](https://github.com/kesha-antonov/react-native-chat/issues/1)): the bubble's reaction gestures ran with the default `cancelsTouchesInView`, so on iOS they cancelled touches on native subviews and a `react-native-video` / `expo-video` player rendered through `renderMessageVideo` never got its play/seek/fullscreen taps. Both the tap and long-press recognizers now set `cancelsTouchesInView(false)`, and the tap gesture is only attached when `onPressMessage` is actually provided instead of always competing for touches.

### 📝 Documentation
- **`keyboardVerticalOffset`**: documented that it no longer needs to be set, and how to tell a too-small offset (toolbar behind the keyboard) from a too-large one (gap above it). Every example screen dropped the `useHeaderHeight()` workaround, and the `keyboardAvoidingViewProps` JSDoc - what you see in editor autocomplete - no longer tells you to set the offset for a header.
- Added an **App KeyboardProvider** example screen: a bare `<Chat>` under an app-level `KeyboardProvider`, the setup reported in [#11](https://github.com/kesha-antonov/react-native-chat/issues/11). The example app now mounts `KeyboardProvider` once at its root, as apps are expected to.
- Added a **Top Aligned (short chat)** example screen: a three-message chat with `isAlignedTop` switchable between `false` / `true` / `'auto'`, plus a toggle for the very tall bubbles from [#2617](https://github.com/FaridSafi/react-native-gifted-chat/issues/2617).
- **README corrected against the code.** The install commands said `react-native-chat`, which is a different package on npm - they now install `@kesha-antonov/react-native-chat`. Four documented props that the implementation never reads are gone: `dayProps` (style the day label through `renderDay`, which is now documented with a `DayProps` example) and `minComposerHeight` / `maxComposerHeight` / `minInputToolbarHeight` (the composer grows with its content; constrain it via `textInputProps.style`). `Chat.updateMessage` was announced in 4.1.0 but never shipped - it is not in the published 4.1.0 tarball - so it is no longer documented in the README or `docs/`; `useStreamingMessages` returns `setMessages` for the same purpose. `disableKeyboardProvider` is documented for the first time.

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
