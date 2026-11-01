const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const rootPak = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

module.exports = function (api) {
  api.cache(true)

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: {
            // For development, we want to alias the library to the source
            [rootPak.name]: path.join(root, rootPak.main),
          },
        },
      ],
      [
        'react-native-worklets/plugin',
        {
          // react-native-streamdown runs remend on a worklet runtime, which needs Bundle Mode
          // and remend forwarded into the generated worklets.
          bundleMode: true,
          importForwarding: {
            moduleNames: ['remend'],
          },
        },
      ],
    ],
  }
}
