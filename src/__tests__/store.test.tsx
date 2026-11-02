import React from 'react'
import { Text } from 'react-native'
import { act, render } from '@testing-library/react-native'

import { createMessageSelectionStore, MessageSelectionContext, useMessageSelection } from '../components/messageSelection'
import { createKeyedStore, createStore, useKeyedValue, useStore } from '../store'

describe('createStore', () => {
  it('notifies only when the value changes', () => {
    const store = createStore(1)
    const listener = jest.fn()
    store.subscribe(listener)
    store.set(1)
    expect(listener).not.toHaveBeenCalled()
    store.set(v => v + 1)
    expect(store.get()).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('re-renders a reader only when its slice changes', async () => {
    const store = createStore({ a: 1, b: 1 })
    let renders = 0
    const Reader = () => {
      renders++
      return <Text>{useStore(store, s => s.a, 0)}</Text>
    }
    const { getByText } = await render(<Reader />)
    renders = 0
    await act(async () => store.set(s => ({ ...s, b: 2 })))
    expect(renders).toBe(0)
    await act(async () => store.set(s => ({ ...s, a: 5 })))
    expect(getByText('5')).toBeTruthy()
    expect(renders).toBe(1)
  })
})

describe('createKeyedStore', () => {
  it('wakes only the readers of the key that changed', async () => {
    const store = createKeyedStore<number, string>()
    const renders: Record<number, number> = { 1: 0, 2: 0 }
    const Reader = ({ id }: { id: number }) => {
      renders[id]++
      return <Text>{useKeyedValue(store, id) ?? '-'}</Text>
    }
    await render(<><Reader id={1} /><Reader id={2} /></>)
    renders[1] = renders[2] = 0

    await act(async () => store.set(1, 'x'))
    expect(renders).toEqual({ 1: 1, 2: 0 })

    await act(async () => store.clear())
    expect(renders).toEqual({ 1: 2, 2: 0 })
  })
})

describe('message selection', () => {
  it('re-renders only the toggled row once the mode is on', async () => {
    const store = createMessageSelectionStore()
    const renders: Record<number, number> = {}
    const Row = ({ id }: { id: number }) => {
      renders[id] = (renders[id] ?? 0) + 1
      const { isSelected } = useMessageSelection(id)
      return <Text>{`${id}:${isSelected}`}</Text>
    }
    const ids = [1, 2, 3, 4, 5]
    const { getByText } = await render(
      <MessageSelectionContext.Provider value={store}>
        {ids.map(id => <Row key={id} id={id} />)}
      </MessageSelectionContext.Provider>
    )

    await act(async () => store.start(1))
    expect(getByText('1:true')).toBeTruthy()
    ids.forEach(id => {
      renders[id] = 0
    })

    await act(async () => store.toggle(3))
    expect(getByText('3:true')).toBeTruthy()
    expect(renders).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 })
    expect(store.getSelectedIds()).toEqual([1, 3])
  })
})
