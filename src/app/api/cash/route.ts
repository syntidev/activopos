import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const register = await db.cashRegister.findFirst({
      where: { closed_at: null }, // business_id inyectado por el tenant layer
    })

    if (!register) {
      return NextResponse.json({
        isOpen:        false,
        openedAt:      null,
        initialAmount: 0,
        currentAmount: 0,
      })
    }

    const [cashPayments, movements] = await Promise.all([
      // SalePayment no tiene business_id — aislado por la relación sale.business_id
      db.salePayment.findMany({
        where: {
          sale: {
            business_id: session.businessId,
            status:      'paid',
            sold_at:     { gte: register.opened_at },
          },
          payment_method: { type: 'cash' },
        },
        select: { amount_bs: true },
      }),
      db.cashMovement.findMany({
        where:  { cash_register_id: register.id }, // business_id inyectado
        select: { type: true, amount_bs: true },
      }),
    ])

    const cashIn  = cashPayments.reduce((acc, p) => acc + Number(p.amount_bs), 0)
    const movIn   = movements.filter(m => m.type === 'in' ).reduce((a, m) => a + Number(m.amount_bs), 0)
    const movOut  = movements.filter(m => m.type === 'out').reduce((a, m) => a + Number(m.amount_bs), 0)
    const current = Number(register.opening_amount_bs) + cashIn + movIn - movOut

    return NextResponse.json({
      isOpen:        true,
      openedAt:      register.opened_at.toISOString(),
      initialAmount: Number(register.opening_amount_bs),
      currentAmount: Math.round(current * 100) / 100,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
