import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { rejectIfTableOrder } from '@/lib/table-order-guard'
import { getActiveRate } from '@/lib/bcv'
import { DebtPaymentError, payFinancingDebtTx } from '@/lib/financing-debt'

type Context = { params: { id: string } }

const schema = z.object({
  payment_method_id: z.number().int().positive(),
  amount_usd:        z.number().positive().max(99_999_999),
  notes:             z.string().max(500).optional(),
})

// PERMISOS — INTENCIONAL: sin guard de rol, igual que cobrar (es la caja del mostrador). Sellado en MATRIZ_..._SELLADA.md (#2).

/* ── POST /api/orders/[id]/cobrar-deuda-financiamiento — cobra (total o parcial) la deuda de un Cashea rechazado ya cobrado ── */
// SaleAbono sobre la venta ORIGINAL: no crea venta ni ingreso nuevo (la venta ya contó el dinero). Entra al turno abierto con su método
// real; solo el efectivo suma al efectivo esperado.

export async function POST(req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos: indica payment_method_id y amount_usd.', field: 'amount_usd', code: 'INVALID_BODY' }, { status: 400 })
  }

  try {
    const { session, db } = await getAuthenticatedTenant()
    const blocked = await rejectIfTableOrder(orderId)
    if (blocked) return blocked
    const order = await db.order.findFirst({ where: { id: orderId }, select: { sale_id: true, financing_status: true } }) // business_id inyectado
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado', field: 'order', code: 'ORDER_NOT_FOUND' }, { status: 404 })
    if (order.sale_id === null || order.financing_status !== 'rejected') {
      return NextResponse.json({ error: 'Este pedido no tiene deuda de financiamiento rechazado.', field: 'order', code: 'NO_DEBT' }, { status: 409 })
    }
    const register = await prisma.cashRegister.findFirst({ where: { business_id: session.businessId, closed_at: null }, select: { id: true } })
    if (!register) return NextResponse.json({ error: 'Abre la caja antes de cobrar la deuda.', field: 'cash_register', code: 'NO_OPEN_REGISTER' }, { status: 409 })

    const { rate } = await getActiveRate(session.businessId) // red fuera del $transaction
    const saleId = order.sale_id
    const r = await prisma.$transaction(tx => payFinancingDebtTx(tx, { businessId: session.businessId, userId: session.userId }, saleId, {
      payment_method_id: body.payment_method_id, amount_usd: body.amount_usd, rate, notes: body.notes, cashRegisterId: register.id,
    }))
    return NextResponse.json({ ok: true, ...r, pago_estado: r.pagada ? 'cobrado' : 'por_cobrar' }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof DebtPaymentError) {
      return NextResponse.json({ error: err.message, field: err.code === 'INVALID_METHOD' ? 'payment_method_id' : 'amount_usd', code: err.code, ...err.extra }, { status: err.status })
    }
    console.error('cobrar-deuda-financiamiento POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
