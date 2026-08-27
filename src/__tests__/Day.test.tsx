import React from 'react'
import { render } from '@testing-library/react-native'

import { Day } from '..'
import { ChatContext } from '../ChatContext'
import { DEFAULT_TEST_MESSAGE } from './data'

describe('Day', () => {
  it('should not render <Day /> and compare with snapshot', async () => {
    const { toJSON } = await render(<Day createdAt={DEFAULT_TEST_MESSAGE.createdAt} />)

    expect(toJSON()).toMatchSnapshot()
  })

  it('should render <Day /> and compare with snapshot', async () => {
    const { toJSON } = await render(
      <Day createdAt={DEFAULT_TEST_MESSAGE.createdAt} />
    )
    expect(toJSON()).toMatchSnapshot()
  })

  // Regression test for the bundled-locale fix in dayjsLocales.ts: month names must localize
  // even though this test file never imports `dayjs/locale/fr` itself - only Day (via
  // Chat/index.tsx's `import '../dayjsLocales'`) does.
  it('formats the month name in the locale from getLocale(), not English', async () => {
    const { getByText } = await render(
      <ChatContext.Provider
        value={{
          getLocale: () => 'fr',
          actionSheet: () => ({ showActionSheetWithOptions: () => {} }),
          getColorScheme: () => null,
        }}
      >
        <Day createdAt={DEFAULT_TEST_MESSAGE.createdAt} />
      </ChatContext.Provider>
    )

    // DEFAULT_TEST_MESSAGE.createdAt is April 17 2022 - "avril" is the fr month name.
    expect(getByText(/avril/)).toBeTruthy()
  })
})
