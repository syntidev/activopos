import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import webpush from 'web-push'

// VAPID keys must be set in environment variables:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — exposed to client (subscribe flow)
//   VAPID_PRIVATE_KEY             — server only
//   VAPID_SUBJECT                 — mailto: or https: URL for contact
// Generate with: npx web-push generate-vapid-keys

// Only relative paths allowed — prevents open redirect via push notification click
const RELATIVE_PATH_RE = /^\/(?!\/)[^\s]*$/

const sendSchema = z.object({
  title:   z.string().min(1).max(150),
  body:    z.string().min(1).max(500),
  url:     z.string().regex(RELATIVE_PATH_RE, 'URL debe ser ruta relativa').optional(),
  // FIX 4: restrict to relative paths — prevents external tracking via icon fetch
  icon:    z.string().regex(RELATIVE_PATH_RE, 'Icono debe ser ruta relativa').optional(),
})

/* ── POST /api/push/send — send push notification to all business subscribers ── */

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@activopos.com'

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'VAPID keys no configuradas. Genera con: npx web-push generate-vapid-keys' }, { status: 503 })
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)

    const body = sendSchema.parse(await req.json())

    const subscriptions = await db.pushSubscription.findMany({
      // business_id inyectado por el tenant layer
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
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } }, // business_id inyectado por el tenant layer
      })
    }

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ ok: true, sent, failed })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push send POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
