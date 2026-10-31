import { act, renderHook } from '@testing-library/react-native'

import { useAnimatedPresence } from '../hooks/useAnimatedPresence'

// A hand-driven exit: the test decides when the "animation" finishes.
const setup = async (initialVisible: boolean) => {
  let finishExit: (() => void) | null = null
  const animateIn = jest.fn()
  const animateOut = jest.fn((onDone: () => void) => {
    finishExit = onDone
  })

  const hook = await renderHook(
    ({ visible }: { visible: boolean }) => useAnimatedPresence(visible, animateIn, animateOut),
    { initialProps: { visible: initialVisible } }
  )

  return { ...hook, animateIn, animateOut, finishExit: () => act(() => finishExit?.()) }
}

describe('useAnimatedPresence', () => {
  it('mounts with `visible` and plays the entrance', async () => {
    const { result, rerender, animateIn } = await setup(false)
    expect(result.current.isMounted).toBe(false)
    expect(animateIn).not.toHaveBeenCalled()

    await rerender({ visible: true })

    expect(result.current.isMounted).toBe(true)
    expect(animateIn).toHaveBeenCalledTimes(1)
  })

  it('stays mounted after `visible` turns false until the exit finishes', async () => {
    const { result, rerender, animateOut, finishExit } = await setup(true)

    await rerender({ visible: false })
    expect(animateOut).toHaveBeenCalledTimes(1)
    expect(result.current.isMounted).toBe(true)

    await finishExit()
    expect(result.current.isMounted).toBe(false)
  })

  it('calls back once the exit it started has finished, and only once', async () => {
    const { result, animateOut, finishExit } = await setup(true)
    const after = jest.fn()

    await act(() => {
      result.current.close(after)
      result.current.close(after)
    })
    expect(animateOut).toHaveBeenCalledTimes(1)
    expect(after).not.toHaveBeenCalled()

    await finishExit()
    expect(after).toHaveBeenCalledTimes(1)
    expect(result.current.isMounted).toBe(false)
  })

  it('does not play an exit for an overlay that never opened', async () => {
    const { animateOut } = await setup(false)
    expect(animateOut).not.toHaveBeenCalled()
  })
})
