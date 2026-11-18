import React from 'react'
import Head from '@docusaurus/Head'
import { useDoc } from '@docusaurus/plugin-content-docs/client'
import Metadata from '@theme-original/DocItem/Metadata'

// A page may carry a longer title for search results than the heading it
// shows (head_title in its frontmatter, set by scripts/sync-docs.mjs). It
// replaces the stock "<page> | <site>" title.
export default function MetadataWrapper (props) {
  const { frontMatter } = useDoc()
  const title = frontMatter.head_title
  return (
    <>
      <Metadata {...props} />
      {title && (
        <Head>
          <title>{title}</title>
          <meta property='og:title' content={title} />
        </Head>
      )}
    </>
  )
}
