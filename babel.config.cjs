module.exports = function (api) {
  api.cache(true)

  return {
    presets: [
      '@babel/preset-env',
      'module:@react-native/babel-preset',
      '@babel/preset-typescript',
    ],
    plugins: [
      // preset-env 8 lowers classes here, and the surrounding node_modules code
      // (Jest 30, @react-native/jest-preset) uses class fields; without these the
      // class transform bails with "Missing class properties transform".
      // `loose` must match across all three or Babel refuses to run - the RN
      // preset enables them in loose mode.
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      '@babel/plugin-transform-unicode-property-regex',
      '@babel/plugin-transform-react-jsx',
      'react-native-reanimated/plugin',
    ],
  }
}
