import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { signToken } from '../src/lib/auth'

/**
 * PRUEBA DE CONSISTENCIA DEL ESTÁNDAR CONTABLE (npm run test:consistency)
 *
 * Verifica contra DB real que ventas netas, COGS y efectivo esperado coinciden
 * entre caja, reportes, dashboard, analytics y finanzas, en escenarios con
 * devoluciones. Crea sus propios datos y los borra al final (bloque finally).
 *
 * Requiere el server de desarrollo corriendo:
 *   npx next dev -p 3019     (o BASE_URL=http://localhost:3000 npm run test:consistency)
 *
 * Sale con código 1 si algo difiere.
 */
const BID   = Number(process.env.TEST_BUSINESS_ID ?? 87)
const BASE  = process.env.BASE_URL ?? 'http://localhost:3019'
const RATE  = 100

interface Ctx {
  userId:        number
  cashMethodId:  number
  otherMethodId: number
  productId:     number
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const r2  = (x: number) => Math.round(x * 100) / 100
const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0))

const results: { ok: boolean; label: string; got: unknown; want: unknown }[] = []
function check(label: string, got: unknown, want: unknown): void {
  results.push({ ok: JSON.stringify(got) === JSON.stringify(want), label, got, want })
}
/** Compara con tolerancia de centavo, para no fallar por redondeo de Decimal. */
function checkNear(label: string, got: number, want: number): void {
  results.push({ ok: Math.abs(got - want) < 0.02, label, got, want })
}

async function resolveCtx(): Promise<Ctx> {
  const user  = await prisma.user.findFirst({ where: { business_id: BID, role: { in: ['admin', 'super_admin'] } }, select: { id: true } })
  const cash  = await prisma.paymentMethod.findFirst({ where: { business_id: BID, type: 'cash' }, select: { id: true } })
  const other = await prisma.paymentMethod.findFirst({ where: { business_id: BID, type: { not: 'cash' } }, select: { id: true } })
  const product = await prisma.product.findFirst({
    where:  { business_id: BID, active: true, product_type: 'simple' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  if (!user || !cash || !other || !product) {
    throw new Error(`Faltan datos base en el negocio ${BID}: se necesitan un admin, un método de pago 'cash', otro método no-cash y un producto simple activo.`)
  }
  return { userId: user.id, cashMethodId: cash.id, otherMethodId: other.id, productId: product.id }
}

async function main(): Promise<void> {
  const ctx = await resolveCtx()
  const token = await signToken({ userId: ctx.userId, businessId: BID, role: 'admin', name: 'Test Consistencia' })
  const headers = { Cookie: `activopos_session=${token}`, 'Content-Type': 'application/json' }

  const api = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, { headers })
    if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return await res.json() as T
  }

  const created: { sales: number[]; returns: number[]; registers: number[] } = { sales: [], returns: [], registers: [] }

  /** Venta de `qty` x `price` cobrada en efectivo. `duplicateLines` parte el mismo producto en 2 líneas con costos distintos. */
  const mkSale = async (ticket: string, soldAt: Date, qty: number, price: number, opts?: { duplicateLines?: boolean }) => {
    const totalUsd = qty * price
    const items = opts?.duplicateLines
      // Mismo producto en 2 líneas: es el caso en que (sale_id, product_id) no
      // identifica la línea y /api/returns debe exigir sale_item_id.
      ? [
          { quantity: qty / 2, cost: 4 },
          { quantity: qty / 2, cost: 6 },
        ]
      : [{ quantity: qty, cost: 4 }]

    const sale = await prisma.sale.create({
      data: {
        business_id: BID, cashier_id: ctx.userId, ticket_number: ticket, status: 'paid',
        total_usd: totalUsd, total_bs: totalUsd * RATE, rate_used: RATE, sold_at: soldAt,
        items: {
          create: items.map(it => ({
            product_id:         ctx.productId,
            product_name:       'Test Consistencia',
            sale_mode:          'unit',
            unit_label:         'und',
            quantity:           it.quantity,
            price_per_unit_usd: price,
            cost_per_unit_usd:  it.cost,
            subtotal_usd:       it.quantity * price,
            subtotal_bs:        it.quantity * price * RATE,
            rate_used:          RATE,
          })),
        },
        payments: { create: [{ payment_method_id: ctx.cashMethodId, amount_bs: totalUsd * RATE, amount_usd: totalUsd, rate_used: RATE }] },
      },
      select: { id: true, items: { select: { id: true, cost_per_unit_usd: true }, orderBy: { id: 'asc' } } },
    })
    created.sales.push(sale.id)
    return sale
  }

  const doReturn = async (
    saleId: number,
    items: { product_id: number; qty: number; sale_item_id?: number }[],
    refundMethodId: number,
  ) => {
    const res = await fetch(`${BASE}/api/returns`, {
      method: 'POST', headers,
      body: JSON.stringify({ sale_id: saleId, reason: 'test:consistency', restores_stock: false, refund_payment_method_id: refundMethodId, items }),
    })
    const body = await res.json() as { return?: { id: number }; error?: string }
    if (body.return?.id) created.returns.push(body.return.id)
    return { status: res.status, body }
  }

  /** Totales "antes" de crear datos: el test compara DELTAS, asi no depende de
   *  lo que ya tenga el negocio (ventas viejas del mismo dia o mes). */
  const snapshot = async (today: Date, tomorrow: Date) => {
    const [day, daily, range, monthly, kpis, charts, summary, fin] = await Promise.all([
      api<{ summary: { cobrado_usd: number; utilidad_usd: number; costo_invertido_usd: number } }>(`/api/reports/day?date=${ymd(today)}`),
      api<{ total_usd: number; items_sold: number }>(`/api/reports/daily?date=${ymd(today)}`),
      api<{ total_usd: number; profit_usd: number }>(`/api/reports/range?from=${ymd(today)}&to=${ymd(today)}`),
      api<{ total_usd: number }>(`/api/reports/monthly?period=${ymd(today).slice(0, 7)}`),
      api<{ kpis: { cobrado_usd: number; utilidad_usd: number } }>('/api/dashboard/kpis'),
      api<{ ops: { sales_hoy: number } }>('/api/dashboard/charts?period=7d'),
      api<{ ventas: { total_usd: number; items_sold: number }; resultado: { costo_ventas_usd: number; utilidad_bruta_usd: number } }>(`/api/analytics/summary?from=${ymd(today)}&to=${ymd(tomorrow)}`),
      api<{ ingresos: { ventas_usd: number } }>(`/api/finanzas/resumen?from=${ymd(today)}&to=${ymd(tomorrow)}`),
    ])
    return {
      dayCobrado:   day.summary.cobrado_usd,
      dayUtilidad:  day.summary.utilidad_usd,
      dayCogs:      day.summary.costo_invertido_usd,
      dailyTotal:   daily.total_usd,
      dailyItems:   daily.items_sold,
      rangeTotal:   range.total_usd,
      rangeProfit:  range.profit_usd,
      monthlyTotal: monthly.total_usd,
      kpisCobrado:  kpis.kpis.cobrado_usd,
      kpisUtilidad: kpis.kpis.utilidad_usd,
      chartsHoy:    charts.ops.sales_hoy,
      sumVentas:    summary.ventas.total_usd,
      sumItems:     summary.ventas.items_sold,
      sumCogs:      summary.resultado.costo_ventas_usd,
      sumUtilidad:  summary.resultado.utilidad_bruta_usd,
      finVentas:    fin.ingresos.ventas_usd,
    }
  }

  try {
    // -- Caja de prueba (las ventas se fechan DESPUES de abrirla) --
    const register = await prisma.cashRegister.create({
      data: { business_id: BID, cashier_id: ctx.userId, opening_amount_bs: 0, opening_amount_usd: 0, rate_at_open: RATE },
      select: { id: true, opened_at: true },
    })
    created.registers.push(register.id)
    const today     = new Date(register.opened_at.getTime() + 1000)
    const yesterday = new Date(today.getTime() - 86_400_000)
    const tomorrow  = new Date(today.getTime() + 86_400_000)

    const base = await snapshot(today, tomorrow)

    // -- Escenario 1: 4 x $10, devolver 1 en EFECTIVO --
    const saleA = await mkSale('T-CONS-A', today, 4, 10)
    const retA  = await doReturn(saleA.id, [{ product_id: ctx.productId, qty: 1 }], ctx.cashMethodId)
    check('e1 devolución aceptada (HTTP 201)', retA.status, 201)

    // Todas las superficies para el MISMO dia
    const caja    = await api<{ turnoStats: { totalVentasUsd: number; efectivoEsperado: number } }>('/api/cash/status')
    const now     = await snapshot(today, tomorrow)
    const daily   = await api<{ by_category: { total_usd: number }[]; top_products: { total_usd: number; quantity: number }[]; hourly_sales: { total_usd: number }[] }>(`/api/reports/daily?date=${ymd(today)}`)
    const day     = await api<{ by_category: { vendido_usd: number }[] }>(`/api/reports/day?date=${ymd(today)}`)
    const range   = await api<{ by_day: { total_usd: number }[] }>(`/api/reports/range?from=${ymd(today)}&to=${ymd(today)}`)
    const monthly = await api<{ total_usd: number; by_day: { total_usd: number }[]; by_week: { total_usd: number }[] }>(`/api/reports/monthly?period=${ymd(today).slice(0, 7)}`)
    const tops    = await api<{ products: { id: number; qty_sold: number; total_usd: number }[] }>(`/api/analytics/top-products?from=${ymd(today)}&to=${ymd(tomorrow)}`)

    const NETO = 30 // 4x$10 - 1x$10
    const d = (k: keyof typeof base) => r2(now[k] - base[k])

    // La caja es nueva: ahi el absoluto ES el neto del turno.
    check('e1 caja ventas netas', caja.turnoStats.totalVentasUsd, NETO)
    check('e1 reports/day cobrado', d('dayCobrado'), NETO)
    check('e1 reports/daily total', d('dailyTotal'), NETO)
    check('e1 reports/range total', d('rangeTotal'), NETO)
    check('e1 reports/monthly total', d('monthlyTotal'), NETO)
    check('e1 dashboard/kpis cobrado', d('kpisCobrado'), NETO)
    check('e1 dashboard/charts ventas hoy', d('chartsHoy'), NETO)
    check('e1 analytics/summary ventas', d('sumVentas'), NETO)
    checkNear('e1 finanzas/resumen ventas', d('finVentas'), NETO)
    check('e1 caja == reports/daily', caja.turnoStats.totalVentasUsd, d('dailyTotal'))

    // Total == suma de desgloses (identidad: vale con cualquier dato previo)
    check('e1 daily: suma categorias == total', sum(daily.by_category.map(c => c.total_usd)), now.dailyTotal)
    check('e1 daily: suma top products == total', sum(daily.top_products.map(p => p.total_usd)), now.dailyTotal)
    check('e1 daily: suma horas == total', sum(daily.hourly_sales.map(h => h.total_usd)), now.dailyTotal)
    check('e1 day: suma categorias == total', sum(day.by_category.map(c => c.vendido_usd)), now.dayCobrado)
    check('e1 monthly: suma dias == total', sum(monthly.by_day.map(x => x.total_usd)), monthly.total_usd)
    check('e1 monthly: suma semanas == total', sum(monthly.by_week.map(w => w.total_usd)), monthly.total_usd)
    check('e1 range: suma dias == total', sum(range.by_day.map(x => x.total_usd)), now.rangeTotal)

    // Unidades netas (4 vendidas - 1 devuelta)
    check('e1 daily items_sold neto', d('dailyItems'), 3)
    check('e1 analytics/summary items', d('sumItems'), 3)
    const mine = tops.products.find(p => p.id === ctx.productId)
    check('e1 top-products incluye el producto neto', [mine !== undefined, (mine?.qty_sold ?? 0) > 0], [true, true])

    // COGS neto: 4 x $4 - 1 x $4 = $12 ; utilidad = 30 - 12 = 18
    check('e1 reports/day COGS neto', d('dayCogs'), 12)
    check('e1 reports/day utilidad neta', d('dayUtilidad'), 18)
    check('e1 reports/range utilidad neta', d('rangeProfit'), 18)
    check('e1 dashboard/kpis utilidad neta', d('kpisUtilidad'), 18)
    check('e1 analytics/summary COGS neto', d('sumCogs'), 12)
    check('e1 analytics/summary utilidad bruta', d('sumUtilidad'), 18)

    // Efectivo: cobro Bs 4.000 y reembolso Bs 1.000 en efectivo
    check('e1 efectivo esperado', caja.turnoStats.efectivoEsperado, 3000)

    // ── Escenario 2: reembolso NO efectivo -> no toca el cajón ──
    const efectivoAntes = caja.turnoStats.efectivoEsperado
    const saleNoCash = await mkSale('T-CONS-NC', today, 4, 10)
    const retNoCash  = await doReturn(saleNoCash.id, [{ product_id: ctx.productId, qty: 1 }], ctx.otherMethodId)
    check('e2 devolución no-efectivo aceptada', retNoCash.status, 201)
    const caja2 = await api<{ turnoStats: { efectivoEsperado: number; totalVentasUsd: number } }>('/api/cash/status')
    // Entró Bs 4.000 de la venta nueva; el reembolso salió por otro método.
    check('e2 reembolso no-efectivo NO baja el cajón', caja2.turnoStats.efectivoEsperado, efectivoAntes + 4000)
    check('e2 ventas netas sí bajan por lo devuelto', caja2.turnoStats.totalVentasUsd, NETO + 30)

    // ── Escenario 3: devolución TOTAL -> la venta sale de todos lados ──
    const ventasAntes = caja2.turnoStats.totalVentasUsd
    const saleTotal = await mkSale('T-CONS-TOT', today, 4, 10)
    const retTotal  = await doReturn(saleTotal.id, [{ product_id: ctx.productId, qty: 4 }], ctx.cashMethodId)
    check('e3 devolución total aceptada', retTotal.status, 201)
    const saleTotalRow = await prisma.sale.findUnique({ where: { id: saleTotal.id }, select: { status: true } })
    check('e3 la venta queda returned', saleTotalRow?.status, 'returned')
    const caja3 = await api<{ turnoStats: { totalVentasUsd: number } }>('/api/cash/status')
    check('e3 ventas netas no cambian (la venta desaparece)', caja3.turnoStats.totalVentasUsd, ventasAntes)

    // ── Escenario 4: venta sin devolución -> suma completa ──
    await mkSale('T-CONS-SIN', today, 4, 10)
    const caja4 = await api<{ turnoStats: { totalVentasUsd: number } }>('/api/cash/status')
    check('e4 venta sin devolución suma completa', caja4.turnoStats.totalVentasUsd, ventasAntes + 40)

    // ── Escenario 5: venta de AYER devuelta HOY (doble anclaje) ──
    const efectivoAntes5 = (await api<{ turnoStats: { efectivoEsperado: number } }>('/api/cash/status')).turnoStats.efectivoEsperado
    const saleAyer = await mkSale('T-CONS-AYER', yesterday, 4, 10)
    await doReturn(saleAyer.id, [{ product_id: ctx.productId, qty: 1 }], ctx.cashMethodId)
    const dailyAyer = await api<{ total_usd: number }>(`/api/reports/daily?date=${ymd(yesterday)}`)
    const efectivoDespues5 = (await api<{ turnoStats: { efectivoEsperado: number } }>('/api/cash/status')).turnoStats.efectivoEsperado
    check('e5 el reporte de AYER queda neto', dailyAyer.total_usd, NETO)
    check('e5 el reembolso baja el cajón de HOY', efectivoAntes5 - efectivoDespues5, 1000)

    // ── Escenario 6: línea duplicada del mismo producto ──
    const saleDup = await mkSale('T-CONS-DUP', today, 4, 10, { duplicateLines: true })
    const sinLinea = await doReturn(saleDup.id, [{ product_id: ctx.productId, qty: 1 }], ctx.cashMethodId)
    check('e6 sin sale_item_id responde 422', sinLinea.status, 422)
    const conLinea = await doReturn(
      saleDup.id,
      [{ product_id: ctx.productId, qty: 1, sale_item_id: saleDup.items[0].id }],
      ctx.cashMethodId,
    )
    check('e6 con sale_item_id es aceptada', conLinea.status, 201)
    const riRow = await prisma.returnItem.findFirst({
      where:  { return_id: conLinea.body.return?.id },
      select: { sale_item_id: true, cost_per_unit_usd: true },
    })
    check('e6 guarda la línea devuelta', riRow?.sale_item_id, saleDup.items[0].id)
    check('e6 guarda el costo de ESA línea (4, no 6)', Number(riRow?.cost_per_unit_usd ?? 0), 4)

    // ── Falta el método de reembolso -> 4xx ──
    const saleSinMetodo = await mkSale('T-CONS-NOM', today, 4, 10)
    const resSinMetodo = await fetch(`${BASE}/api/returns`, {
      method: 'POST', headers,
      body: JSON.stringify({ sale_id: saleSinMetodo.id, reason: 'test:consistency', items: [{ product_id: ctx.productId, qty: 1 }] }),
    })
    check('sin refund_payment_method_id responde 4xx', resSinMetodo.status >= 400 && resSinMetodo.status < 500, true)
  } finally {
    // ── Restaurar: borra SOLO lo que creó esta prueba ──
    if (created.returns.length) {
      await prisma.returnItem.deleteMany({ where: { return_id: { in: created.returns } } })
      await prisma.return.deleteMany({ where: { id: { in: created.returns } } })
    }
    if (created.sales.length) {
      await prisma.salePayment.deleteMany({ where: { sale_id: { in: created.sales } } })
      await prisma.saleItem.deleteMany({ where: { sale_id: { in: created.sales } } })
      await prisma.sale.deleteMany({ where: { id: { in: created.sales } } })
    }
    if (created.registers.length) {
      await prisma.cashRegister.deleteMany({ where: { id: { in: created.registers } } })
    }
  }

  const failed = results.filter(r => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.label}${r.ok ? '' : ` -> got ${JSON.stringify(r.got)}, want ${JSON.stringify(r.want)}`}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} OK`)

  if (failed.length > 0) {
    console.error(`\n${failed.length} inconsistencia(s) en el estándar contable.`)
    process.exit(1)
  }
  console.log('Estándar contable consistente en caja, reportes, dashboard, analytics y finanzas.')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('test:consistency falló:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
