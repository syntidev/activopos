import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const from = params.get('from')
  const to = params.get('to')

  const fromDate = from
    ? new Date(from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const toDate = to ? new Date(`${to}T23:59:59`) : new Date()

  const [registers, salesInPeriod] = await Promise.all([
    prisma.cashRegister.findMany({
      where: {
        business_id: session.businessId,
        closed_at: { not: null },
        opened_at: { gte: fromDate },
      },
      orderBy: { opened_at: 'desc' },
      include: {
        cashier: { select: { name: true } },
        movements: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        business_id: session.businessId,
        status: 'paid',
        sold_at: { gte: fromDate, lte: toDate },
      },
      include: {
        payments: {
          include: { payment_method: { select: { type: true } } },
        },
      },
    }),
  ])

  const history = registers.map(reg => {
    const regSales = salesInPeriod.filter(
      s =>
        s.sold_at &&
        s.sold_at >= reg.opened_at &&
        (!reg.closed_at || s.sold_at <= reg.closed_at)
    )

    const totalVentasBs = regSales.reduce((acc, s) => acc + Number(s.total_bs), 0)
    const totalVentasUsd = regSales.reduce((acc, s) => acc + Number(s.total_usd), 0)

    const cashVentasBs = regSales.reduce(
      (acc, s) =>
        acc +
        s.payments
          .filter(p => p.payment_method.type === 'cash')
          .reduce((a, p) => a + Number(p.amount_bs), 0),
      0
    )

    const movIn = reg.movements
      .filter(m => m.type === 'in')
      .reduce((a, m) => a + Number(m.amount_bs), 0)

    const movOut = reg.movements
      .filter(m => m.type === 'out')
      .reduce((a, m) => a + Number(m.amount_bs), 0)

    const efectivoEsperado =
      Number(reg.opening_amount_bs) + cashVentasBs + movIn - movOut

    const efectivoContado = reg.closing_amount_bs
      ? Number(reg.closing_amount_bs)
      : null

    const diferencia =
      efectivoContado !== null ? efectivoContado - efectivoEsperado : null

    return {
      id: reg.id,
      openedAt: reg.opened_at,
      closedAt: reg.closed_at,
      cashierName: reg.cashier.name,
      openingAmountBs: Number(reg.opening_amount_bs),
      openingAmountUsd: Number(reg.opening_amount_usd),
      closingAmountBs: efectivoContado,
      closingAmountUsd: reg.closing_amount_usd
        ? Number(reg.closing_amount_usd)
        : null,
      rateAtOpen: Number(reg.rate_at_open),
      closeNotes: reg.close_notes,
      salesCount: regSales.length,
      totalVentasBs,
      totalVentasUsd,
      efectivoEsperado,
      efectivoContado,
      diferencia,
    }
  })

  return NextResponse.json({ ok: true, history })
}
