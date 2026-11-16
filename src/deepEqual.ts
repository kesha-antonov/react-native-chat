/**
 * Whether two values hold the same data: primitives (NaN equals NaN), dates by time, arrays
 * and plain objects by their contents, anything else (functions, class instances) by reference.
 *
 * Messages arrive from a server, so the comparison must hold up against hostile data: past
 * `MAX_DEPTH` levels, or on a cycle, it answers "different" instead of recursing on, so a
 * message nested thousands of levels deep costs a re-render, never a stack overflow.
 */
const MAX_DEPTH = 64

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function equal (a: unknown, b: unknown, depth: number, seen: Set<object>): boolean {
  if (a === b)
    return true
  if (typeof a === 'number' && typeof b === 'number')
    return a !== a && b !== b
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object')
    return false
  if (depth > MAX_DEPTH || seen.has(a))
    return false

  if (a instanceof Date || b instanceof Date)
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()

  const isArrayA = Array.isArray(a)
  if (isArrayA !== Array.isArray(b))
    return false

  if (!isArrayA && !(isPlainObject(a) && isPlainObject(b)))
    return false

  seen.add(a)
  let result = true
  if (isArrayA) {
    const listA = a as unknown[]
    const listB = b as unknown[]
    result = listA.length === listB.length && listA.every((item, i) => equal(item, listB[i], depth + 1, seen))
  } else {
    const objectA = a as Record<string, unknown>
    const objectB = b as Record<string, unknown>
    const keys = Object.keys(objectA)
    result = keys.length === Object.keys(objectB).length &&
      keys.every(key => Object.prototype.hasOwnProperty.call(objectB, key) &&
        equal(objectA[key], objectB[key], depth + 1, seen))
  }
  seen.delete(a)
  return result
}

export const deepEqual = (a: unknown, b: unknown): boolean => equal(a, b, 0, new Set())
