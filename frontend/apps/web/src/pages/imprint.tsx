import type { NextPage } from 'next'
import Head from 'next/head'
import { Typography } from '@/components/ui/typography'
import NextLink from 'next/link'
import { Link } from '@/components/ui/link'
import { BRAND_NAME } from '@/config/constants'

const OperatorImprint = () => (
  <div>
    <Typography variant="h1" className="mb-4">
      Imprint
    </Typography>
    <Typography className="mb-4">
      {BRAND_NAME} is operated by Tortoise Labs Ltd.
      <br />
      Contact: <Link render={<NextLink href="mailto:legal@forevermoney.ai" />}>legal@forevermoney.ai</Link>
    </Typography>
    <Typography>
      This interface is built on open-source software.{' '}
      <Link render={<NextLink href="/licences.html" />}>See licences and credits.</Link>
    </Typography>
  </div>
)

const Imprint: NextPage = () => {
  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Imprint`}</title>
      </Head>

      <main>
        <OperatorImprint />
      </main>
    </>
  )
}

export default Imprint
