import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const register = await prisma.cashRegister.findFirst({
    where: { business_id: session.businessId, closed_at: null },
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
    prisma.salePayment.findMany({
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
    prisma.cashMovement.findMany({
      where:  { cash_register_id: register.id },
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
}
