# Architecture

How the library is put together, and the rules that keep it fast by construction. A change that
breaks a rule here needs a reason in its commit, not a later optimisation pass.

## The rules

1. **The published code is memoized for every consumer.** `lib/` is built with the React Compiler,
   so memoization does not depend on whether an app happens to compile `node_modules`. Source is
   written to the compiler's rules (no mutation of props or state, no conditional hooks); a
   component the compiler bails out of is a bug.
2. **A row renders from its id.** The list hands a row only its message id. The row reads its
   message from the keyed row store and its settings through narrow selectors; nothing reaches a
   row by spreading a props bag down the tree.
3. **State lives next to the component that shows it.** A value that changes often (composer text,
   recording time and levels, playback progress, scroll position) is held where it is drawn - a
   store read by one subscriber, or a shared value read on the UI thread - never in `Chat`.
4. **One store primitive.** Per-chat and per-message state goes through `createStore` /
   `createKeyedStore` and `useStore(store, selector)`. A keyed update notifies only that key's
   subscribers. No hand-rolled listener sets.
5. **Nothing invisible is mounted.** Sheets, menus, panels, recorders and players mount on first
   use (`useLazyMount`) and do no native work before that.
6. **One subscription per device signal.** Colour scheme, window size, keyboard and app state are
   read once at the root and passed through context; leaves never call `useColorScheme` or
   `useWindowDimensions` per row.
7. **Shared motion and gesture primitives.** Easings, durations and springs come from `motion.ts`;
   press feedback, swipe rows, scrubbing and presence (fade in/out) each have one implementation.
8. **Small single-purpose components.** A file owns one responsibility. A component past ~300
   lines, or with more than one state machine, is split into a folder of parts.
9. **Animation never goes through React.** Per-frame values are shared values driven by worklets;
   React state changes only when the structure on screen changes.
10. **Guarded by tests.** Render-count tests pin the data flow: a keystroke renders no message
    row, a message update renders exactly that row, opening the composer's panels renders no row.

## Data flow

```
Chat props ──► ChatStores (created once per Chat)
                ├─ rowStore        keyed by message id   → MessageRow(id)
                ├─ composerStore   text, reply, edit, mode → Composer, Send, banners
                ├─ selectionStore  keyed by message id   → SelectionCheck(id)
                ├─ highlightStore  keyed by message id
                ├─ playbackStore   keyed by message id   → players, NowPlayingBar
                └─ settings        narrow selectors       → leaves read what they draw
```

`Chat` writes props into the stores; it does not re-render on store changes. Each leaf subscribes
to the smallest slice it draws.

## Migration plan

Each phase lands as its own commits with the gate green, benchmarked where it touches scrolling.

1. **Compiler build + render-count guards.** Build `lib/` with `babel-plugin-react-compiler`
   (target 19), keep `tsc` for declarations. Add the render-count tests from rule 10.
2. **Store primitive.** Add `createStore` / `createKeyedStore` / `useStore`; move selection,
   highlight, playback, link previews, emoji recents and send-flight onto it.
3. **Root signals and motion tokens.** One colour-scheme and window subscription; `motion.ts`
   with the easings now copied across files.
4. **Composer store.** Text, reply, edit and mode leave `Chat`; recording ticks move to shared
   values; the selection bar stops remounting the composer.
   *Done*: text, reply and edit live in stores `ComposerHost` reads; recording ticks go to a
   meter only the timer, halo and ring read; the composer stays mounted under the selection bar.
5. **Row settings by selector.** Replace the spread row config with `useRowSettings(selector)`;
   split `Bubble` into parts (layout, content, meta, menu, reactions).
   *Done*: settings that concern only some rows (`firstUnreadMessageId`) are read per row through
   `useRowSettings(selector)`; the rest stays in the shared config, which profiling showed rarely
   changes (a streamed token or a reaction already renders one row). `Bubble` is now
   `useBubbleLayout` plus `BubbleBody` (surface, name, `BubbleContent`, `BubbleMeta`),
   `BubbleMenu`, `LiftedBubble` and `PressableBubbleRow`.
6. **Decompose the remaining large files** (`MessageVideo`, `InputToolbar`, `RecordButton`,
   `ContextMenu`, `WaveformPlayer`, `VideoNoteCapture`) and share the gesture primitives with
   `ChatList`.
   *Done*: each is now a folder of parts (most under 300 lines; the two state-machine hooks,
   `useVideoNoteSession` and `useRoundNotePlayback`, stay whole). Swipe-to-reply and the chat
   list's swipe-to-archive share `src/gestures/useRowSwipe.ts`. Those six followed
   (`Chat`, `MessagesContainer`, `VoiceMessageInput`, `AttachmentMenu`, `EmojiGrid`,
   `VideoNoteRecorder`); what stays over 300 lines is theme tokens and drawing (`Theme.ts`,
   `RadialProgress`, `MediaControls`, `RecordCircle`), `mediaPlayback.ts` and `ChatList`.
