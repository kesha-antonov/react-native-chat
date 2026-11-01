import { insetsForFrame } from '../Chat/ChatSafeAreaProvider'

// The provider's first frame runs on these seeded insets, so they must match what the native
// measurement reports next - otherwise the composer jumps as the chat opens.
describe('insetsForFrame', () => {
  const window = { height: 874 }
  const windowInsets = { top: 62, bottom: 34 }

  it('keeps the home indicator inset for a chat that reaches the bottom of the window', () => {
    const insets = insetsForFrame({ x: 0, y: 116, width: 402, height: 758 }, window, windowInsets)
    expect(insets.bottom).toBe(34)
    expect(insets.top).toBe(0)
  })

  it('claims no bottom inset above a tab bar', () => {
    const insets = insetsForFrame({ x: 0, y: 116, width: 402, height: 675 }, window, windowInsets)
    expect(insets.bottom).toBe(0)
  })

  it('claims the top inset for a chat without a header', () => {
    const insets = insetsForFrame({ x: 0, y: 0, width: 402, height: 874 }, window, windowInsets)
    expect(insets.top).toBe(62)
    expect(insets.bottom).toBe(34)
  })

  it('covers a frame that only partly overlaps the inset', () => {
    const insets = insetsForFrame({ x: 0, y: 116, width: 402, height: 748 }, window, windowInsets)
    expect(insets.bottom).toBe(24)
  })
})
