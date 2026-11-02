#!/usr/bin/env node
// Fails the build when the React Compiler has turned a shared value's `.value` into a memo
// dependency: it then reads the value during every render (Reanimated warns "Reading from
// `value` during component render") and memoizes on a number that changes on the UI thread.
// It happens when a callback, effect or hook config reads `sv.value`; read it with `sv.get()`.
const fs = require('fs')
const path = require('path')

const PATTERN = /\$\[\d+\] !== ([\w.?]+)\.value\b/g
const found = []
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory())
      walk(file)
    else if (file.endsWith('.js'))
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const match of line.matchAll(PATTERN))
          found.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${match[1]}.value`)
      })
  }
}
walk(path.join(__dirname, '..', 'lib'))

if (found.length) {
  console.error('Shared values read during render (use .get() in the callback instead of .value):')
  found.forEach(line => console.error(`  ${line}`))
  process.exit(1)
}
