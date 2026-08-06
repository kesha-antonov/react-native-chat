module.exports = {
  // React Native 0.86 moved its Jest preset into a separate package.
  preset: '@react-native/jest-preset',
  resetMocks: true,
  setupFilesAfterEnv: [
    './node_modules/@react-native/jest-preset/jest-preset.js',
    './node_modules/react-native-gesture-handler/jestSetup.js',
    './tests/setup.ts',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  transform: {
    '\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  // Everything else is transformed on purpose (many RN deps ship untranspiled),
  // but Jest 30's own packages use class properties that this Babel config does
  // not handle - and they never needed transforming in the first place.
  transformIgnorePatterns: ['/node_modules/(?:@jest/|jest-[^/]+/)'],
  testMatch: ['**/*.test.ts?(x)'],
  modulePathIgnorePatterns: ['./example'],
  coveragePathIgnorePatterns: ['./src/__tests__/'],
}
