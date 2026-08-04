jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock')
)

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
)

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 }
  return {
    // Marks the mock as an ES module so `import * as` hands tests the very object the
    // source imports from, rather than a copy Babel's interop would spy on in vain.
    __esModule: true,
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaInsetsContext: {
      Consumer: ({ children }: any) => children(inset),
    },
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
