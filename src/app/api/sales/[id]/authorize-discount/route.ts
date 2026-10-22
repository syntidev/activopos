import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkAndIncrementPinAttempts, clearPinAttempts } from '@/lib/pin-rate-limit'
import { prisma } from '@/lib/prisma'
import { FinancingError, reconcileFinancingAfterItemsChangeTx } from '@/lib/ticket-financing'

/** Resultado de aplicar el descuento dentro de la transacción: o los totales nuevos o el motivo del rechazo (409). */
type DiscountOutcome = { ok: true; newTotalUsd: number; newTotalBs: number } | { ok: false; message: string }

const schema = z.object({
  pin:          z.string().min(1).max(20),
  discount_pct: z.number().min(0.01).max(100),
})

type RouteContext = { params: { id: string } }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()

    // DB-backed rate limit — survives PM2 restarts
    const limited = await checkAndIncrementPinAttempts(session.businessId, saleId)
    if (limited) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espere 5 minutos.' },
        { status: 429 }
      )
    }

    const body = schema.parse(await req.json())

    const [sale, business, users] = await Promise.all([
      db.sale.findFirst({
        where: { id: saleId }, // business_id inyectado por el tenant layer
        select: {
          id: true, status: true, discount_pct: true, rate_used: true,
          items: { select: { subtotal_usd: true } },
        },
      }),
      // Business es la raíz del tenant (no tiene business_id) → no se filtra
      db.business.findUnique({
        where:  { id: session.businessId },
        select: { max_discount_pct: true },
      }),
      db.user.findMany({
        where:  { is_active: true }, // business_id inyectado por el tenant layer
        select: { id: true, role: true, password: true },
      }),
    ])

    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'paid') {
      return NextResponse.json({ error: 'La venta ya fue cobrada' }, { status: 409 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta está anulada' }, { status: 409 })
    }
    if (sale.discount_pct > 0) {
      return NextResponse.json(
        { error: 'Esta venta ya tiene un descuento aplicado' },
        { status: 409 }
      )
    }

    // Verify PIN against all active users
    let authorizer: { id: number; role: string } | null = null
    for (const user of users) {
      if (await bcrypt.compare(body.pin, user.password)) {
        authorizer = { id: user.id, role: user.role }
        break
      }
    }

    if (!authorizer) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    // PIN matched — reset rate limit counter
    await clearPinAttempts(session.businessId, saleId)

    const maxPct  = business?.max_discount_pct ?? 0
    const isAdmin = authorizer.role === 'admin' || authorizer.role === 'super_admin'

    if (!isAdmin && body.discount_pct > maxPct) {
      return NextResponse.json(
        { error: `Descuento ${body.discount_pct}% supera el máximo permitido (${maxPct}%). Se requiere PIN de administrador.` },
        { status: 403 }
      )
    }

    // $transaction en prisma base: business_id explícito adentro (la extensión de tenant no se propaga al tx).
    // La fila se bloquea (FOR UPDATE) y todo se REVALIDA con ella bloqueada: estado, descuento previo, ítems y total.
    const outcome = await prisma.$transaction(async (tx): Promise<DiscountOutcome> => {
      await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} AND business_id = ${session.businessId} FOR UPDATE`
      const current = await tx.sale.findFirst({
        where:  { id: saleId, business_id: session.businessId },
        select: {
          status: true, discount_pct: true, rate_used: true, price_mode: true, financing_status: true,
          items: { select: { product_id: true, subtotal_usd: true } },
        },
      })
      if (!current) return { ok: false, message: 'Venta no encontrada' }
      if (current.status === 'paid') return { ok: false, message: 'La venta ya fue cobrada' }
      if (current.status === 'cancelled') return { ok: false, message: 'La venta está anulada' }
      if (current.discount_pct > 0) return { ok: false, message: 'Esta venta ya tiene un descuento aplicado' }

      // Con financiamiento vivo (Cashea) el descuento cambia el monto: un 'approved' vuelve a 'requested' (con bitácora y motivo).
      await reconcileFinancingAfterItemsChangeTx(
        tx, { businessId: session.businessId, userId: session.userId }, 'sale', saleId, current,
        Array.from(new Set(current.items.map(i => i.product_id))),
        'Se aplicó un descuento: el monto debe aprobarse de nuevo',
      )

      // Compute original total from item subtotals — immune to prior total_usd mutations
      const originalTotalUsd = current.items.reduce((sum, i) => sum + Number(i.subtotal_usd), 0)
      const newTotalUsd = Math.round(originalTotalUsd * (1 - body.discount_pct / 100) * 100) / 100
      const newTotalBs  = Math.round(newTotalUsd * Number(current.rate_used) * 100) / 100

      // Atomic update: WHERE discount_pct = 0 prevents compounding under race condition
      const result = await tx.sale.updateMany({
        where: { id: saleId, business_id: session.businessId, discount_pct: 0 },
        data: {
          discount_pct:     body.discount_pct,
          discount_auth_by: authorizer.id,
          total_usd:        newTotalUsd,
          total_bs:         newTotalBs,
        },
      })
      if (result.count === 0) return { ok: false, message: 'Esta venta ya tiene un descuento aplicado' }
      return { ok: true, newTotalUsd, newTotalBs }
    })

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: outcome.message === 'Venta no encontrada' ? 404 : 409 })
    }

    return NextResponse.json({
      ok:            true,
      discount_pct:  body.discount_pct,
      new_total_usd: outcome.newTotalUsd,
      new_total_bs:  outcome.newTotalBs,
    })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof FinancingError) {
      return NextResponse.json({ error: err.message, blocked_products: err.blockedProducts }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('authorize-discount error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
