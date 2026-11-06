import React from 'react'
import Content from '@theme-original/DocItem/Content'
import ChatShowcaseSlot from '@site/src/components/ChatShowcase'

// Mounts the live chat showcase into the placeholder the README's GIF leaves
// on the generated page (see scripts/sync-docs.mjs). Pages without one are
// untouched.
export default function ContentWrapper (props) {
  return (
    <>
      <Content {...props} />
      <ChatShowcaseSlot />
    </>
  )
}
