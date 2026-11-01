import { stabilize } from '../MessagesContainer/rowConfig'

const run = (prev: unknown, next: Record<string, unknown>) => {
  const latest = { current: next }
  return { value: stabilize(prev, next, '', () => latest.current) as Record<string, any>, latest }
}

describe('stabilize', () => {
  it('keeps the identity when only inline handlers and equal objects are new', () => {
    const first = run(undefined, { onPress: () => 1, style: { left: { color: 'red' } }, list: [{ onPress: () => 1, title: 'a' }] }).value
    const second = run(first, { onPress: () => 2, style: { left: { color: 'red' } }, list: [{ onPress: () => 2, title: 'a' }] }).value
    expect(second).toBe(first)
  })

  it('calls the latest handler through the stable proxy', () => {
    // One ref for the latest props, as `useStableRowConfig` keeps.
    const latest: { current: Record<string, unknown> } = { current: { onPress: () => 'old', reply: { onPress: () => 'old reply' } } }
    const first = stabilize(undefined, latest.current, '', () => latest.current) as Record<string, any>
    expect(first.onPress()).toBe('old')
    latest.current = { onPress: () => 'new', reply: { onPress: () => 'new reply' } }
    const second = stabilize(first, latest.current, '', () => latest.current) as Record<string, any>
    expect(second).toBe(first)
    expect(second.onPress()).toBe('new')
    expect(second.reply.onPress()).toBe('new reply')
  })

  it('changes when content or a render function changes', () => {
    const renderTime = () => null
    const first = run(undefined, { renderTime, style: { color: 'red' } }).value
    expect(run(first, { renderTime, style: { color: 'blue' } }).value).not.toBe(first)
    expect(run(first, { renderTime: () => null, style: { color: 'red' } }).value).not.toBe(first)
    expect(run(first, { renderTime, style: { color: 'red' } }).value).toBe(first)
  })

  it('changes when a handler appears or goes', () => {
    const first = run(undefined, { onPress: () => {} }).value
    expect(run(first, {}).value).not.toBe(first)
    expect(run(run(first, {}).value, { onPress: () => {} }).value).not.toBe(first)
  })

  it('keeps unchanged branches when another one changes', () => {
    const first = run(undefined, { a: { x: 1 }, b: { y: 1 } }).value
    const second = run(first, { a: { x: 1 }, b: { y: 2 } }).value
    expect(second).not.toBe(first)
    expect(second.a).toBe(first.a)
  })
})
