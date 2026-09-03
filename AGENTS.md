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
| `yarn test` | Jest suite, run under `TZ=Europe/Paris` (snapshots contain formatted times, so the timezone is pinned). Must stay green. |
| `yarn test:watch` / `yarn test:coverage` | Same suite, watching or with coverage. |
| `yarn typecheck` | `tsc --noEmit` over `src/`. Must stay clean. |
| `yarn lint` | ESLint over **both** `src/` and `example/`. Must report 0 errors and 0 warnings. |
| `yarn lint:fix` | Auto-fix what ESLint can. |
| `yarn build` | `rm -rf lib && tsc` - emits `lib/`, which is gitignored and is what gets published. |
| `yarn prepublishOnly` | lint + test + build, i.e. the full gate. |

Inside `example/`: `yarn lint` and `yarn typecheck` cover the example app on its own. Note
that the root `yarn lint` also lints `example/`, under **stricter** rules than the example's
own `expo lint` - so a change that passes `cd example && yarn lint` can still fail at the root.
Always run the root `yarn lint` before you finish.

A husky `pre-commit` hook runs `lint-staged`. Its glob is `src/*.{json,js,jsx,ts,tsx}`, which
matches only the **top level** of `src/` - a change under `src/MessagesContainer/` or
`src/components/` is committed without `lint:fix` touching it. Do not rely on the hook; run
the root `yarn lint` yourself.

## Layout

```
src/                     library source - the only thing published (as compiled lib/)
  Chat/                  the top-level <Chat> component
  MessagesContainer/     list engine (FlatList / FlashList), day header, scroll handling
  Bubble/ Message/       a single message row and its bubble
  Day/                   the date separator; the animated floating header lives in
                         MessagesContainer/components/DayAnimated
  Reactions/ Reply/      emoji reactions, swipe-to-reply
  TypingIndicator/       the three-dot bubble
  components/            shared leaf components (Icon, TouchableOpacity, markdown, voice…)
  hooks/                 useTheme, useLabels, useStreamingMessages, …
  locales/ i18n.ts       15 built-in UI translations, one file per language; en is the default
  Theme.ts Icons.ts      theme tokens and the overridable icon registry
  rtl.ts                 RTL detection and position mirroring
  linkParser.tsx         URL / phone / email / mention / hashtag matching for MessageText
  logging.ts             branded warning() / error() helpers
  Models.ts              IMessage, User, QuickReplies, MessageReaction - the public data model
  index.ts types.ts      public API surface; anything not exported here is internal
  __tests__/             Jest tests, colocated with the source they cover
tests/setup.ts           global Jest mocks (reanimated, worklets, safe-area, keyboard)
example/                 Expo demo app - separate yarn project, consumes the built lib/
expoSnack/               single-file demo for snack.expo.dev; not linted or built by CI
docs/                    MIGRATION.md, STREAMING.md
```

A day separator is rendered by the list itself (`MessagesContainer/components/Item`), guarded
by `isSameDay`, *around* whatever `renderMessage` returns. A custom `renderMessage` must not
render its own `<Day>` - it would print a pill above every message.

## Conventions

Style is enforced by ESLint (`@stylistic`), so run `yarn lint:fix` rather than matching by eye:

- **no semicolons**, single quotes, 2-space indent, single quotes in JSX
- a space before a function's parameter list: `export function useThemeColor (props) {`
- **no braces around a single-statement block**, and the statement goes on the next line
  (`curly: multi` + `nonblock-statement-body-position: below`):
  ```ts
  if (!currentMessage?.createdAt || isSameDay(currentMessage, previousMessage))
    return null
  ```
- trailing commas on multiline arrays/objects/imports, none on function args; arrow params
  are unparenthesised when there is exactly one (`arrow-parens: as-needed`)
- imports are sorted by `perfectionist/sort-imports` - `yarn lint:fix` will reorder them
- comments explain *why*, not *what*; several existing ones cite the issue they fix
- user-visible diagnostics go through `logging.ts` (`warning`, `error`), which prefixes them
  with the package name, rather than a bare `console.*`

**Never pass a dependency array to a Reanimated worklet hook.** `useAnimatedStyle`,
`useDerivedValue`, `useAnimatedProps` and `useAnimatedReaction` all log
`[Reanimated] dependencies should only be used in web implementation.` once per call per
render when given one on native, and a hook inside a list row turns that into thousands of
lines. The array is dead weight anyway: with the Babel plugin the hook derives its inputs
from the worklet's closure on both native and web. `react-hooks/exhaustive-deps` does list
`useAnimatedStyle` / `useAnimatedProps` / `useDerivedValue` (and the scroll and gesture
handlers) in `additionalHooks`, but it only fires when an array is already present, so it
will never ask you to add one.

Public API changes go through `src/index.ts` / `src/types.ts`. Adding a prop means updating
the README's props reference (`## 📖 Props Reference`) in the same change.

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
- gesture-handler is set up separately, from `jestSetup.js` listed in `jest.config.cjs`
- the safe-area and keyboard-controller mocks deliberately expose *real* contexts
  (`SafeAreaInsetsContext`, `KeyboardContext`) defaulting to the "no provider mounted" value,
  because `Chat` detects an app-level provider by reading them - a plain stub object would
  make that path untestable
- `resetMocks: true` is on, so set up spies inside each test.
- `testMatch` is `**/*.test.ts?(x)` and `example/` is excluded via `modulePathIgnorePatterns`,
  so the example app has no tests of its own

## Running the example app

The example consumes the **built `lib/`**, not `src/`. After editing `src/`:

```bash
yarn build                # from the root - lib/ is what the app imports
cd example && yarn start  # already means `expo start --dev-client --clear`
```

Use the example's own `yarn start`, not the root one: the root script is a bare `expo start`
and misses the `--clear` a freshly built `lib/` needs. (`expo-dev-client` is not installed
here - the app is an ordinary prebuilt debug build that finds Metro on `localhost:8081`
either way, so `--dev-client` only changes what the CLI advertises; `--clear` is the flag
that matters.)

The `--clear` matters: Metro treats the linked `lib/` as a node_module and does not watch it,
so without a cache reset the app keeps serving the previous build. Files under `example/`
itself are in the project root and hot-reload normally, with no rebuild. `yarn build` also
deletes `lib/` before emitting it, so a Metro left running across a rebuild will fail with
`Failed to get the SHA-1 for: .../lib/...` - restart it rather than debugging that.

The demo screens are `example/app/chat/<id>.tsx` (routes, listed in `_layout.tsx` and the
Explore tab) wrapping `example/components/chat-examples/*Example.tsx` (the actual demos).
Jump straight to one with the app's URL scheme instead of tapping through the list:

```bash
xcrun simctl openurl booted 'example:///chat/media'   # bundle id com.anonymous.example
```

`example/ios` and `example/android` are generated and gitignored. If they go stale against
`example/node_modules`, regenerate rather than patching them:

```bash
cd example && yarn install && npx expo prebuild --clean
```

On Android the Metro port is baked into the debug build, so pass it at build time
(`npx expo run:android --port <n>`) rather than relying on `adb reverse`.

## Dependency policy

The example is an **Expo SDK 57** app. `npx expo install --check` is the first thing to run
when a native build misbehaves, but it is **not** the final word here: the example
deliberately runs ahead of Expo's pins on the animation stack, so the check reports those as
"should be updated" and would downgrade them. Read the table below before acting on it.

Deliberately **ahead** of `expo install --check`:

| Package | Here | Expo SDK 57 wants | Why |
| --- | --- | --- | --- |
| `react-native-reanimated` | 4.6.x | 4.5.1 | the library's own toolchain pins 4.6; downgrading splits the two |
| `react-native-worklets` | 0.12.x | 0.10.1 | ships with reanimated 4.6 |
| `react-native-keyboard-controller` | 1.22.x | 1.21.9 | the version the keyboard work in `src/` targets |

Worklets 0.12 renamed `WorkletRuntime::executeSync` to `runSync`, which two native packages
still call. `example/.yarn/patches/` carries the fixes (`react-native-audio-api` wired on the
dependency spec, `expo-modules-core` through `resolutions`) - without them the iOS build fails
to compile. If you bump either package, re-check the patch still applies; if you downgrade the
worklets stack, the patches become unnecessary and must go.

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

## Releasing

Land the content first as normal commits, then cut the release as its own commit:

1. Move `CHANGELOG.md`'s `## [Unreleased]` heading to `## [X.Y.Z] - YYYY-MM-DD`. Entries are
   grouped under the emoji headings already in the file (`💥 Breaking`, `✨ Features`,
   `🐛 Fixes`, `⚡ Performance`, `🔧 Deprecations`, `📦 Dependencies`, `📝 Docs`,
   `📲 Example app`), and each says what broke, why, and what it is now
2. Bump `version` in `package.json`. On a **major**, also bump the range in
   `expoSnack/package.json` - it is a caret on the library, so `^4.x` will not resolve `5.0.0`
   and the Snack would silently keep installing the old major
3. `yarn prepublishOnly` (lint + test + build) must pass
4. Commit as `chore: release X.Y.Z`, touching only those files, with a body explaining the
   version choice and a `Verified:` line
5. Annotated tag: `git tag -a vX.Y.Z -m "X.Y.Z - short summary"` (the `v` prefix from 4.3.0 on;
   4.2.0 and earlier have none)
6. `git push origin main && git push origin vX.Y.Z`

There is **no publish-on-tag workflow** - `.github/workflows/main.yml` only runs checks on
pushes to `main` and PRs. Publishing to npm is a manual `npm publish` from the root, which
re-runs `prepublishOnly` on the way out.

## Before you finish

```bash
yarn lint && yarn typecheck && yarn test && yarn build
```

All four must pass. Do not add AI attribution to commits, PR descriptions, or code comments.
