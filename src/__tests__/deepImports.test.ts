import fs from 'fs'
import path from 'path'

// React Native's Babel preset appends a "Deep imports from the 'react-native' package are
// deprecated" warning to any module that names a `react-native/...` path, and it fires when the
// module loads - even for a require inside a fallback that never runs. The library shipped one
// for the old core Clipboard and so warned on every app start.
const listSources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name)
  if (entry.isDirectory())
    return entry.name === '__tests__' ? [] : listSources(full)
  return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
})

describe('library sources', () => {
  it('never import a react-native deep path', () => {
    const offenders = listSources(path.join(__dirname, '..'))
      .filter(file => /(require\(|from\s+)['"]react-native\//.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(path.join(__dirname, '..'), file))
    expect(offenders).toEqual([])
  })
})
