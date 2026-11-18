import { LayoutChangeEvent } from 'react-native'
import { renderHook } from '@testing-library/react-native'
import { SharedValue } from 'react-native-reanimated'

import { AnimatedList } from '../MessagesContainer'
import { useKeepBottomEdge } from '../MessagesContainer/useKeepBottomEdge'

// A plain stand-in: the Reanimated mock's `makeMutable` has no `get` / `set`.
const shared = <T,>(initial: T) => {
  const box = {
    value: initial,
    get: () => box.value,
    set: (next: T) => {
      box.value = next
    },
  }
  return box as unknown as SharedValue<T>
}

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height } } }) as LayoutChangeEvent

const setup = async (state: { scroll: number, contentLength: number, scrollLength: number }) => {
  const scrollToOffset = jest.fn()
  const list = { getState: () => ({ isAtEnd: false, isFollowingEnd: false, ...state }), scrollToOffset }
  const listHeight = shared(0)
  const onLayoutList = jest.fn((event: LayoutChangeEvent) => listHeight.set(event.nativeEvent.layout.height))
  const { result } = await renderHook(() => useKeepBottomEdge({
    forwardRef: { current: list as unknown as AnimatedList },
    isScrollAdjusting: shared(false),
    listHeight,
    onLayoutList,
  }))
  return { onLayout: result.current, onLayoutList, scrollToOffset }
}

// #36: the list scrolls from the top, so a list that got shorter (the keyboard's padding) kept
// its top rows and dropped the ones above the composer. The rows at the bottom edge stay put.
describe('useKeepBottomEdge', () => {
  it('does not scroll on the first layout', async () => {
    const { onLayout, onLayoutList, scrollToOffset } = await setup({ scroll: 100, contentLength: 2000, scrollLength: 700 })
    onLayout(layout(700))
    expect(onLayoutList).toHaveBeenCalledTimes(1)
    expect(scrollToOffset).not.toHaveBeenCalled()
  })

  it('scrolls by as much as the list got shorter', async () => {
    const { onLayout, scrollToOffset } = await setup({ scroll: 500, contentLength: 2000, scrollLength: 400 })
    onLayout(layout(700))
    onLayout(layout(400))
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 800, animated: false })
  })

  it('scrolls back by as much as the list grew', async () => {
    const { onLayout, scrollToOffset } = await setup({ scroll: 500, contentLength: 2000, scrollLength: 734 })
    onLayout(layout(700))
    onLayout(layout(734))
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 466, animated: false })
  })

  it('leaves a list that grew at the end where the platform already put it', async () => {
    // Android pulls the offset back to the new end itself: taking the growth off again left the
    // list short of the newest message.
    const { onLayout, scrollToOffset } = await setup({ scroll: 1266, contentLength: 2000, scrollLength: 734 })
    onLayout(layout(700))
    onLayout(layout(734))
    expect(scrollToOffset).not.toHaveBeenCalled()
  })
})
