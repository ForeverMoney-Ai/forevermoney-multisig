import { useRouter } from 'next/router'
import type { UrlObject } from 'url'
import { AppRoutes } from '@/config/routes'

export const useTxBuilderApp = (): { link: UrlObject } => {
  const router = useRouter()
  return {
    link: {
      pathname: AppRoutes.apps.open,
      query: { safe: router.query.safe, appUrl: 'https://safe.forevermoney.ai/tx-builder/' },
    },
  }
}
