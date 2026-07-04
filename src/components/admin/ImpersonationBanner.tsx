import { readImpersonation } from '@/lib/impersonation'
import { ImpersonationBannerClient } from './ImpersonationBannerClient'

export async function ImpersonationBanner() {
  const impersonation = await readImpersonation()
  if (!impersonation) return null
  return <ImpersonationBannerClient businessName={impersonation.businessName} />
}
