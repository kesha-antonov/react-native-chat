# AGENTS.md

Guidance for AI coding agents working **inside this repository**.

If you are instead helping someone *use* this library in their own app, read
[`llms.txt`](llms.txt) - it is a compact integration guide and does not require the checkout.

## What this is

`@kesha-antonov/react-native-chat` is a chat UI component library for React Native and
Web - a maintained continuation of `react-native-gifted-chat`. It ships as compiled
JavaScript plus type definitions; there is no native code in this package.

## Setup

Requires **Node >= 20** and **Yarn 4** (pinned via `packageManager`; use `yarn`, never `npm`).

```bash
yarn install          # library
cd example && yarn install && cd ..   # example app - a SEPARATE yarn project
```

The repo is **not** a Yarn workspace. `example/` has its own `package.json`, its own
`yarn.lock`, and its own `node_modules`, and depends on the library via `link:..`. Installing
at the root does not install the example, and vice versa.

## Commands

Run these from the repo root:

| Command | What it does |
| --- | --- |
| `yarn test` | Jest suite. Must stay green. |
| `yarn typecheck` | `tsc --noEmit` over `src/`. Must stay clean. |
| `yarn lint` | ESLint over **both** `src/` and `example/`. Must report 0 errors and 0 warnings. |
| `yarn lint:fix` | Auto-fix what ESLint can. |
| `yarn build` | `rm -rf lib && tsc` - emits `lib/`, which is gitignored and is what gets published. |
| `yarn prepublishOnly` | lint + test + build, i.e. the full gate. |

Inside `example/`: `yarn lint` and `yarn typecheck` cover the example app on its own. Note
that the root `yarn lint` also lints `example/`, under **stricter** rules than the example's
own `expo lint` - so a change that passes `cd example && yarn lint` can still fail at the root.
Always run the root `yarn lint` before you finish.

## Layout

```
src/                     library source - the only thing published (as compiled lib/)
  Chat/                  the top-level <Chat> component
  MessagesContainer/     list engine (FlatList / FlashList), day header, scroll handling
  Bubble/ Message/       a single message row and its bubble
  Reactions/ Reply/      emoji reactions, swipe-to-reply
  components/            shared leaf components (Icon, TouchableOpacity, markdown, voice…)
  hooks/                 useTheme, useLabels, useStreamingMessages, …
  locales/ i18n.ts       15 built-in UI translations, one file per language; en is the default
  Models.ts              IMessage, User, QuickReplies, MessageReaction - the public data model
  index.ts types.ts      public API surface; anything not exported here is internal
  __tests__/             Jest tests, colocated with the source they cover
tests/setup.ts           global Jest mocks (reanimated, worklets, safe-area, keyboard)
example/                 Expo demo app - separate yarn project, consumes the built lib/
docs/                    MIGRATION.md, STREAMING.md
```

## Conventions

Style is enforced by ESLint (`@stylistic`), so run `yarn lint:fix` rather than matching by eye:

- **no semicolons**, single quotes, 2-space indent, single quotes in JSX
- a space before a function's parameter list: `export function useThemeColor (props) {`
- imports are sorted by `perfectionist/sort-imports` - `yarn lint:fix` will reorder them
- comments explain *why*, not *what*; several existing ones cite the issue they fix

Public API changes go through `src/index.ts` / `src/types.ts`. Adding a prop means updating
the README's props reference in the same change.

## Testing

Jest with `@testing-library/react-native` **v14**, so `render`, `fireEvent`, `act` and
`renderHook` are all **async** - `await` them, and make the test function `async`:

```tsx
it('does a thing', async () => {
  const { getByText } = await render(<Chat messages={[]} onSend={() => {}} user={{ _id: 1 }} />)
  await fireEvent.press(getByText('Send'))
})
```

Other things worth knowing before you write a test:

- v14 renders through `test-renderer`, not the deprecated `react-test-renderer`. Only **host**
  elements exist in the tree, so `UNSAFE_getByType`/`UNSAFE_getByProps` are gone - query by
  role, text or testID, or read `toJSON()`.
- v14 enforces React Native's "text strings must be rendered within a `<Text>`" invariant.
  A fixture that returns a bare string will throw.
- `tests/setup.ts` mocks reanimated, worklets, safe-area-context and keyboard-controller. It
  also neutralises `JSReanimated.setCSSEventHandler`, because Reanimated's own `/mock` entry
  throws on import under Jest since 4.6. Leave that in place.
- `resetMocks: true` is on, so set up spies inside each test.

## Running the example app

The example consumes the **built `lib/`**, not `src/`. After editing `src/`:

```bash
yarn build                                   # from the root - lib/ is what the app imports
cd example && npx expo start --dev-client --clear
```

The `--clear` matters: Metro treats the linked `lib/` as a node_module and does not watch it,
so without a cache reset the app keeps serving the previous build. Files under `example/`
itself are in the project root and hot-reload normally, with no rebuild.

`example/ios` and `example/android` are generated and gitignored. If they go stale against
`example/node_modules`, regenerate rather than patching them:

```bash
cd example && yarn install && npx expo prebuild --clean
```

On Android the Metro port is baked into the debug build, so pass it at build time
(`npx expo run:android --port <n>`) rather than relying on `adb reverse`.

## Dependency policy

The example is an **Expo SDK 57** app. Keep its natively-linked packages on the versions
`npx expo install --check` expects; that check is the tool of record, and drifting from it
means the committed native projects may not build.

Held back deliberately, with reasons - do not bump these casually:

| Package | Pinned at | Why |
| --- | --- | --- |
| `react-native` | 0.86.x | Expo SDK 57 pins it |
| `react-native-gesture-handler` | 2.x | v3 renames `BaseButton`/`FlatList`/`TextInput`/`Pressable` to `Legacy*`, used across `src/` |
| `react-native-vision-camera` | 4.x | v5 requires the `react-native-nitro-modules` stack |
| `@react-native-async-storage/async-storage` | 2.x | Expo SDK 57 pins it exactly |
| `typescript` | 6.x | `@typescript-eslint` supports `<6.1.0` |
| `@babel/*` | 7.x | the RN 0.86 toolchain is Babel 7 |
| `jest` | 29.x | `@react-native/jest-preset` still depends on jest 29 internals |

Yarn 4.17 applies a 24-hour publish age gate, so a just-released version can be refused as
"quarantined". That is expected - pick the previous version and move on.

## Before you finish

```bash
yarn lint && yarn typecheck && yarn test && yarn build
```

All four must pass. Do not add AI attribution to commits, PR descriptions, or code comments.
