import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

// SSRF allowlist: only known push gateway hostnames accepted
const PUSH_ENDPOINT_ALLOWLIST = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
]

const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

function isAllowedEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:')                      return false
    if (PRIVATE_IP_RE.test(url.hostname))               return false
    return PUSH_ENDPOINT_ALLOWLIST.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

const subscribeSchema = z.object({
  endpoint:   z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
  user_agent: z.string().max(500).optional(),
})

/* ── POST /api/push/subscribe — save or refresh a push subscription ── */

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const body = subscribeSchema.parse(await req.json())

    if (!isAllowedEndpoint(body.endpoint)) {
      return NextResponse.json({ error: 'Endpoint no permitido' }, { status: 400 })
    }

    // Delete any previous subscription with same endpoint for this business
    await db.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint }, // business_id inyectado por el tenant layer
    })

    const sub = await db.pushSubscription.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige
        user_id:     session.userId,
        endpoint:    body.endpoint,
        p256dh:      body.keys.p256dh,
        auth_key:    body.keys.auth,
        user_agent:  body.user_agent ?? null,
      },
    })

    return NextResponse.json({ ok: true, id: sub.id }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push subscribe POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── DELETE /api/push/subscribe — remove a push subscription ── */

export async function DELETE(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const body = z.object({ endpoint: z.string().url() }).parse(await req.json())

    await db.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint }, // business_id inyectado por el tenant layer
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push subscribe DELETE:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
