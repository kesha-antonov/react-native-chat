jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock')
)

jest.mock('react-native-reanimated', () => {
  // Reanimated deliberately selects its JS-only module under Jest, but since 4.6 the native
  // initializer unconditionally installs a CSS event handler - and that module's
  // `setCSSEventHandler` throws. Loading the library's own mock crashes on the way in, so
  // neutralise the one method first. Nothing here animates via CSS, so a noop is enough.
  const {
    createJSReanimatedModule,
  } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated')

  Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {}

  return require('react-native-reanimated/mock')
})

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const inset = { top: 0, right: 0, bottom: 0, left: 0 }

  // A real context, defaulting to `null` exactly as the library does when no
  // provider is mounted - Chat's provider detection reads it directly, so a
  // plain stub object would make that check untestable.
  const SafeAreaInsetsContext = React.createContext(null)

  return {
    // Marks the mock as an ES module so `import * as` hands tests the very object the
    // source imports from, rather than a copy Babel's interop would spy on in vain.
    __esModule: true,
    SafeAreaProvider: ({ children }: any) =>
      React.createElement(SafeAreaInsetsContext.Provider, { value: inset }, children),
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  }
})

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react')

  // The official mock doesn't ship `KeyboardContext`. Add one whose default mirrors the
  // library's "no KeyboardProvider mounted" fallback - a single stub object shared by
  // both fields - so Chat's provider detection can be exercised from tests.
  const noProvider = { value: 0 }

  return {
    ...require('react-native-keyboard-controller/jest'),
    KeyboardContext: React.createContext({
      reanimated: { progress: noProvider, height: noProvider },
    }),
  }
})
