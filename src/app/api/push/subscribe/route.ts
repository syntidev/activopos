import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = subscribeSchema.parse(await req.json())

    // Delete any previous subscription with same endpoint for this business
    await prisma.pushSubscription.deleteMany({
      where: { business_id: session.businessId, endpoint: body.endpoint },
    })

    const sub = await prisma.pushSubscription.create({
      data: {
        business_id: session.businessId,
        user_id:     session.userId,
        endpoint:    body.endpoint,
        p256dh:      body.keys.p256dh,
        auth_key:    body.keys.auth,
        user_agent:  body.user_agent ?? null,
      },
    })

    return NextResponse.json({ ok: true, id: sub.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push subscribe POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── DELETE /api/push/subscribe — remove a push subscription ── */

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = z.object({ endpoint: z.string().url() }).parse(await req.json())

    await prisma.pushSubscription.deleteMany({
      where: { business_id: session.businessId, endpoint: body.endpoint },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('push subscribe DELETE:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
