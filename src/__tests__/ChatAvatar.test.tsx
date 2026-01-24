import React from 'react'
import { render } from '@testing-library/react-native'

import { ChatAvatar } from '..'

it('should render <ChatAvatar /> and compare with snapshot', () => {
  const { toJSON } = render(<ChatAvatar />)

  expect(toJSON()).toMatchSnapshot()
})
