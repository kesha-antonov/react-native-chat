import React from 'react'
import { render } from '@testing-library/react-native'

import { PageDownCounter } from '../MessagesContainer/components/PageDownCounter'

describe('the scroll-to-bottom counter', () => {
  it('is absent at zero and shows the count', async () => {
    const empty = await render(<PageDownCounter count={0} />)
    expect(empty.queryByTestId('GC_SCROLL_TO_BOTTOM_COUNTER')).toBeNull()
    await empty.unmount()

    const { getByText } = await render(<PageDownCounter count={3} />)
    expect(getByText('3')).toBeTruthy()
  })

  it('rolls the new number in over the old one', async () => {
    const utils = await render(<PageDownCounter count={1} />)
    await utils.rerender(<PageDownCounter count={2} />)
    expect(utils.getByText('2')).toBeTruthy()
    expect(utils.getByText('1')).toBeTruthy()
  })

  it('caps at 99+', async () => {
    const { getByText } = await render(<PageDownCounter count={120} />)
    expect(getByText('99+')).toBeTruthy()
  })
})
