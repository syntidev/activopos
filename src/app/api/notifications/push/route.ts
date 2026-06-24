import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushToBusinessSubscribers } from '@/lib/push-notify'

const pushSchema = z.object({
  order_id: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: z.infer<typeof pushSchema>
  try {
    body = pushSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  const order = await prisma.order.findFirst({
    where: { id: body.order_id, business_id: session.businessId },
    select: { id: true, order_number: true, client_name: true, total_usd: true },
  })

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const totalUsd = Number(order.total_usd ?? 0).toFixed(2)
  const client   = order.client_name?.trim() || 'Cliente'

  await sendPushToBusinessSubscribers(session.businessId, {
    title: 'Nuevo pedido del catálogo',
    body:  `Pedido #${order.order_number} de ${client} — $${totalUsd}`,
    url:   '/pedidos',
  })

  return NextResponse.json({ ok: true })
}
