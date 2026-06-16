import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const order = await prisma.order.findFirst({
    where: { id, business_id: session.businessId },
    include: { items: true },
  })

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const fmtUsd = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const lines: string[] = [
    `📦 *Pedido ${order.order_number}*`,
    '',
    '*Detalle del pedido:*',
    ...order.items.map((item) => {
      const qty = Number(item.quantity)
      const label = item.variant_label ? ` (${item.variant_label})` : ''
      return `• ${item.product_name}${label} × ${qty} — $${fmtUsd(Number(item.subtotal_usd))}`
    }),
  ]

  if (Number(order.delivery_fee) > 0) {
    lines.push(`🚚 Delivery: $${fmtUsd(Number(order.delivery_fee))}`)
  }

  lines.push('', `💰 *Total: $${fmtUsd(Number(order.total_usd))}*`)

  if (order.client_address) {
    lines.push('', `📍 *Dirección:* ${order.client_address}`)
  }

  if (order.notes) {
    lines.push('', `📝 *Notas:* ${order.notes}`)
  }

  const phone = (order.client_phone ?? '').replace(/[^0-9]/g, '')
  const text  = encodeURIComponent(lines.join('\n'))
  const url   = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`

  return NextResponse.json({ ok: true, url, order_number: order.order_number })
}
