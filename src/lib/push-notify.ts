import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

interface PushPayload {
  title: string
  body:  string
  url?:  string
  icon?: string
}

export async function sendPushToBusinessSubscribers(
  businessId: number,
  payload: PushPayload
): Promise<void> {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@activopos.com',
    publicKey,
    privateKey
  )

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { business_id: businessId },
  })
  if (subscriptions.length === 0) return

  const serialized = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        serialized
      )
    )
  )

  const expiredEndpoints = subscriptions
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && (r.reason as { statusCode?: number })?.statusCode === 410
    })
    .map(sub => sub.endpoint)

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { business_id: businessId, endpoint: { in: expiredEndpoints } },
    })
  }
}
