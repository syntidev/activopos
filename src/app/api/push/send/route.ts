import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import webpush from 'web-push'

// VAPID keys must be set in environment variables:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — exposed to client (subscribe flow)
//   VAPID_PRIVATE_KEY             — server only
//   VAPID_SUBJECT                 — mailto: or https: URL for contact
// Generate with: npx web-push generate-vapid-keys

const sendSchema = z.object({
  title:   z.string().min(1).max(150),
  body:    z.string().min(1).max(500),
  url:     z.string().optional(),
  icon:    z.string().optional(),
})

/* ── POST /api/push/send — send push notification to all business subscribers ── */

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@activopos.com'

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'VAPID keys no configuradas. Genera con: npx web-push generate-vapid-keys' }, { status: 503 })
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)

  try {
    const body = sendSchema.parse(await req.json())

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { business_id: session.businessId },
    })

    if (subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'Sin suscriptores activos' })
    }

    const payload = JSON.stringify({
      title: body.title,
      body:  body.body,
      url:   body.url,
      icon:  body.icon,
    })

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        )
      )
    )

    // Remove expired/invalid subscriptions (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number }
        if (err?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint)
        }
      }
    })
    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { business_id: session.businessId, endpoint: { in: expiredEndpoints } },
      })
    }

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ ok: true, sent, failed })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push send POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
