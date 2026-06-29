import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkAndIncrementPinAttempts, clearPinAttempts } from '@/lib/pin-rate-limit'

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

    // Compute original total from item subtotals — immune to prior total_usd mutations
    const originalTotalUsd = sale.items.reduce((sum, i) => sum + Number(i.subtotal_usd), 0)
    const newTotalUsd = Math.round(originalTotalUsd * (1 - body.discount_pct / 100) * 100) / 100
    const newTotalBs  = Math.round(newTotalUsd * Number(sale.rate_used) * 100) / 100

    // Atomic update: WHERE discount_pct = 0 prevents compounding under race condition
    const result = await db.sale.updateMany({
      where: { id: saleId, discount_pct: 0 }, // business_id inyectado por el tenant layer
      data: {
        discount_pct:     body.discount_pct,
        discount_auth_by: authorizer.id,
        total_usd:        newTotalUsd,
        total_bs:         newTotalBs,
      },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Esta venta ya tiene un descuento aplicado' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok:            true,
      discount_pct:  body.discount_pct,
      new_total_usd: newTotalUsd,
      new_total_bs:  newTotalBs,
    })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('authorize-discount error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
