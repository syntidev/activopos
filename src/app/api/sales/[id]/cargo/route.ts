export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { pendingSaleTotals } from '@/lib/sale-totals'
import { FinancingError, reconcileFinancingAfterItemsChangeTx } from '@/lib/ticket-financing'

/** Una venta solo admite cambio de cargo mientras está abierta. */
const OPEN_STATUSES: readonly string[] = ['pending', 'quote']

const schema = z.strictObject({ cargo_pct: z.number().min(0).max(100) })

type CargoOutcome = { ok: true; cargoPct: number; totalUsd: number; totalBs: number } | { ok: false; status: number; message: string }

/**
 * Fija el cargo global de una venta pendiente (lo guarda en sales.cargo_pct y recalcula total_usd/total_bs desde las líneas,
 * el descuento ya autorizado y este cargo). business_id SIEMPRE de la sesión; un cajero solo toca sus propias ventas.
 * El cargo lo decide quien opera la venta (cajero incluido): no hay política de admin por ahora.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session } = await getAuthenticatedTenant()
    const body = schema.parse(await req.json())

    const outcome = await prisma.$transaction(async (tx): Promise<CargoOutcome> => {
      await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} AND business_id = ${session.businessId} FOR UPDATE`
      const current = await tx.sale.findFirst({
        where:  { id: saleId, business_id: session.businessId },
        select: {
          status: true, cashier_id: true, discount_pct: true, rate_used: true, price_mode: true, financing_status: true,
          items: { select: { product_id: true, subtotal_usd: true } },
        },
      })
      if (!current || (session.role === 'cashier' && current.cashier_id !== session.userId)) {
        return { ok: false, status: 404, message: 'Venta no encontrada' }
      }
      if (!OPEN_STATUSES.includes(current.status)) {
        return { ok: false, status: 409, message: current.status === 'paid' ? 'La venta ya fue cobrada' : `La venta está en estado "${current.status}"` }
      }

      const itemsUsd = current.items.reduce((sum, i) => sum + Number(i.subtotal_usd), 0)
      const { total_usd, total_bs } = pendingSaleTotals(itemsUsd, current.discount_pct, body.cargo_pct, Number(current.rate_used))

      // Con financiamiento vivo (Cashea) cambiar el monto obliga a aprobarlo de nuevo.
      await reconcileFinancingAfterItemsChangeTx(
        tx, { businessId: session.businessId, userId: session.userId }, 'sale', saleId, current,
        Array.from(new Set(current.items.map(i => i.product_id))),
        'Se cambió el cargo: el monto debe aprobarse de nuevo',
      )

      const res = await tx.sale.updateMany({
        where: { id: saleId, business_id: session.businessId, status: { in: ['pending', 'quote'] } },
        data:  { cargo_pct: body.cargo_pct, total_usd, total_bs },
      })
      if (res.count !== 1) return { ok: false, status: 409, message: 'La venta ya no está abierta' }
      return { ok: true, cargoPct: body.cargo_pct, totalUsd: total_usd, totalBs: total_bs }
    })

    if (!outcome.ok) return NextResponse.json({ error: outcome.message }, { status: outcome.status })
    return NextResponse.json({ ok: true, cargo_pct: outcome.cargoPct, total_usd: outcome.totalUsd, total_bs: outcome.totalBs })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof FinancingError) return NextResponse.json({ error: err.message, blocked_products: err.blockedProducts }, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    console.error('sale cargo error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
