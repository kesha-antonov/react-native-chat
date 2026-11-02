// The published build: TypeScript stripped and every component run through the React Compiler,
// so memoization reaches apps that do not compile node_modules. JSX and ES modules are left for
// the app's own bundler, as tsc left them before.
module.exports = {
  presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true, onlyRemoveTypeImports: false }]],
  plugins: [
    ['babel-plugin-react-compiler', { target: '19', panicThreshold: 'all_errors' }],
    '@babel/plugin-syntax-jsx',
  ],
}
