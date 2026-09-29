import CustomLink from '@/components/common/CustomLink'
import MarkdownContent from '@/components/common/MarkdownContent'
import type { NextPage } from 'next'
import Head from 'next/head'
import SafeTerms from '@/markdown/terms/terms.md'
import type { MDXComponents } from 'mdx/types'
import { BRAND_NAME } from '@/config/constants'

const overrideComponents: MDXComponents = {
  a: CustomLink,
}

const Terms: NextPage = () => {
  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Terms`}</title>
      </Head>

      <main style={{ lineHeight: '1.5' }}>
        <MarkdownContent>
          <SafeTerms components={overrideComponents} />
        </MarkdownContent>
      </main>
    </>
  )
}

export default Terms
