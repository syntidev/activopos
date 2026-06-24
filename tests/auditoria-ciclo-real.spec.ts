/**
 * Auditoría de Ciclo Real — ActivoPOS
 * CLI-D | Sprint 26
 *
 * Ejercita el ciclo de negocio completo en 7 nodos encadenados.
 * Si un nodo falla, los siguientes se marcan BLOQUEADO (no FALLA).
 * Imprime tabla de resultados en afterAll.
 *
 * Uso local:
 *   npx playwright test tests/auditoria-ciclo-real.spec.ts
 *
 * Uso en VPS (puerto 3001):
 *   BASE_URL=http://localhost:3003 npx playwright test tests/auditoria-ciclo-real.spec.ts --reporter=line
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

test.describe.serial('CIMAAD — Auditoría Ciclo Real', () => {

// ── Estado compartido entre nodos ─────────────────────────────────────────────

// eslint-disable-next-line prefer-const
let api!: APIRequestContext

let blockedFrom  = 0     // 0 = sin bloqueo; N = bloqueado desde nodo N
let weOpenedCaja = false

let productId    = 0
let stockAfterN1 = 0     // stock tras ingresar inventario (Nodo 1)
let saleId       = 0     // venta pagada — anular en afterAll (Nodo 2)
let creditSaleId = 0     // venta a crédito — anular en afterAll (Nodo 5)
let pmId         = 0     // payment_method_id cacheado

type NodeResult = { node: number; name: string; result: string; detail: string }

const results: NodeResult[] = [
  { node: 1, name: 'Inventario',          result: '⏳', detail: '' },
  { node: 2, name: 'POS Venta',           result: '⏳', detail: '' },
  { node: 3, name: 'Caja Cierre',         result: '⏳', detail: '' },
  { node: 4, name: 'Reportes',            result: '⏳', detail: '' },
  { node: 5, name: 'Clientes CxC',        result: '⏳', detail: '' },
  { node: 6, name: 'Pedidos Cobrar',      result: '⏳', detail: '' },
  { node: 7, name: 'Finanzas Coherencia', result: '⏳', detail: '' },
]

// ── beforeAll / afterAll ──────────────────────────────────────────────────────

test.beforeAll(async ({ playwright }) => {
  // storageState vacío explícito — evita que Playwright intente leer tests/.auth-state.json del config
  const ctx = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } })
  const loginRes = await ctx.post(`${BASE}/api/auth/login`, {
    data: { email: 'admin@activopos.com', password: 'admin123' },
  })
  expect(loginRes.ok(), `Login falló: ${loginRes.status()}`).toBeTruthy()
  const state = await ctx.storageState()
  await ctx.dispose()
  api = await playwright.request.newContext({ storageState: state })
})

test.afterAll(async () => {
  const REASON = 'Cleanup auditoria ciclo real — test automatizado'

  try {
    if (saleId > 0) {
      await api
        .patch(`${BASE}/api/sales/${saleId}/void`, { data: { reason: REASON } })
        .catch(() => undefined)
    }
    if (creditSaleId > 0) {
      await api
        .patch(`${BASE}/api/sales/${creditSaleId}/void`, { data: { reason: REASON } })
        .catch(() => undefined)
    }
    if (productId > 0) {
      await api
        .patch(`${BASE}/api/products/${productId}`, { data: { active: false } })
        .catch(() => undefined)
    }
  } catch {
    // cleanup errors are non-fatal
  }

  const col = (s: string, n: number) => s.slice(0, n).padEnd(n)
  console.log('\n╔══ AUDITORÍA CICLO REAL ════════════════════════════════════════╗')
  console.log(`║ ${'#'.padEnd(2)}  ${'NODO'.padEnd(22)}  ${'RESULTADO'.padEnd(14)}  DETALLE`)
  console.log('╠════════════════════════════════════════════════════════════════╣')
  for (const r of results) {
    console.log(`║ ${col(String(r.node), 2)}  ${col(r.name, 22)}  ${col(r.result, 14)}  ${r.detail}`)
  }
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  try { await api.dispose() } catch { /* noop */ }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRate(): Promise<number> {
  const res  = await api.get(`${BASE}/api/rates/bcv`)
  const body = await res.json() as { bcv?: number; rate?: number }
  return body.bcv ?? body.rate ?? 50
}

async function getPmId(): Promise<number> {
  if (pmId > 0) return pmId
  const res  = await api.get(`${BASE}/api/payment-methods`)
  const body = await res.json() as { methods: { id: number }[] }
  if (!body.methods?.length) throw new Error('Sin métodos de pago configurados')
  pmId = body.methods[0].id
  return pmId
}

// ── Nodo 1 — Inventario ───────────────────────────────────────────────────────

test('Nodo 1 — Inventario: ingreso → stock aumenta en DB', async () => {
  if (blockedFrom > 0) {
    results[0].result = '⚠️ BLOQUEADO'
    results[0].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[0].detail)
    return
  }

  try {
    // 1a. Crear producto de prueba con precio conocido
    const createRes = await api.post(`${BASE}/api/products`, {
      data: {
        name:               'ACR_TEST_PROD',
        product_type:       'simple',
        unit_type:          'unit',
        unit_step:          1,
        sale_mode:          'unit',
        price_per_unit_usd: 5.00,
        cost_per_unit_usd:  3.00,
      },
    })
    expect(createRes.status()).toBe(201)
    const createBody = await createRes.json() as { product: { id: number } }
    productId = createBody.product.id

    // 1b. Leer stock inicial (debe ser 0 para producto recién creado)
    const beforeRes  = await api.get(`${BASE}/api/products/${productId}`)
    const beforeBody = await beforeRes.json() as {
      product: { stock: { net_qty: number } }
    }
    const stockBefore = beforeBody.product.stock.net_qty

    // 1c. Ingresar 10 unidades al inventario
    const invRes = await api.post(`${BASE}/api/inventory`, {
      data: {
        product_id:        productId,
        quantity:          10,
        cost_per_unit_usd: 3.00,
        notes:             'Ingreso auditoria ciclo',
      },
    })
    expect(invRes.status()).toBe(201)
    const invBody = await invRes.json() as { ok: boolean }
    expect(invBody.ok).toBe(true)

    // 1d. Verificar stock aumentó exactamente en 10
    const afterRes  = await api.get(`${BASE}/api/products/${productId}`)
    const afterBody = await afterRes.json() as {
      product: { stock: { net_qty: number } }
    }
    stockAfterN1 = afterBody.product.stock.net_qty
    expect(stockAfterN1).toBe(stockBefore + 10)

    results[0].result = '✅ PASA'
    results[0].detail = `stock ${stockBefore} → ${stockAfterN1} (+10)`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 1
    results[0].result = '❌ FALLA'
    results[0].detail = String(err)
    throw err
  }
})

// ── Nodo 2 — POS Venta ────────────────────────────────────────────────────────

test('Nodo 2 — POS Venta: sale paid → stock disminuye en DB', async () => {
  if (blockedFrom > 0) {
    results[1].result = '⚠️ BLOQUEADO'
    results[1].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[1].detail)
    return
  }

  try {
    // 2a. Verificar estado de caja; abrir si está cerrada
    const statusRes  = await api.get(`${BASE}/api/cash/status`)
    expect(statusRes.status()).toBe(200)
    const statusBody = await statusRes.json() as { isOpen: boolean }

    if (!statusBody.isOpen) {
      const rate    = await getRate()
      const openRes = await api.post(`${BASE}/api/cash/open`, {
        data: {
          opening_amount_usd: 50,
          opening_amount_bs:  Math.round(50 * rate * 100) / 100,
        },
      })
      expect(openRes.status()).toBe(201)
      weOpenedCaja = true
    }

    // 2b. Obtener tasa BCV y método de pago
    const rate      = await getRate()
    const localPmId = await getPmId()
    const totalUsd  = 5.00 * 2                               // qty=2 × $5
    const totalBs   = Math.round(totalUsd * rate * 100) / 100

    // 2c. Crear venta pagada con 2 unidades del producto de Nodo 1
    const saleRes = await api.post(`${BASE}/api/sales`, {
      data: {
        status:   'paid',
        origin:   'pos',
        items:    [{ product_id: productId, quantity: 2, sale_mode: 'unit', discount_usd: 0 }],
        payments: [{ payment_method_id: localPmId, amount_bs: totalBs, amount_usd: totalUsd }],
      },
    })
    expect(saleRes.status()).toBe(201)
    const saleBody = await saleRes.json() as {
      ok:   boolean
      sale: { id: number; status: string; ticket_number: string }
    }
    expect(saleBody.ok).toBe(true)
    expect(saleBody.sale.status).toBe('paid')
    saleId = saleBody.sale.id

    // 2d. Verificar que stock disminuyó en 2
    const stockRes  = await api.get(`${BASE}/api/products/${productId}`)
    const stockBody = await stockRes.json() as {
      product: { stock: { net_qty: number } }
    }
    const stockNow = stockBody.product.stock.net_qty
    expect(stockNow).toBe(stockAfterN1 - 2)

    results[1].result = '✅ PASA'
    results[1].detail = `${saleBody.sale.ticket_number} | stock ${stockAfterN1} → ${stockNow}`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 2
    results[1].result = '❌ FALLA'
    results[1].detail = String(err)
    throw err
  }
})

// ── Nodo 3 — Caja Cierre ─────────────────────────────────────────────────────

test('Nodo 3 — Caja Cierre: close → isOpen false', async () => {
  if (blockedFrom > 0) {
    results[2].result = '⚠️ BLOQUEADO'
    results[2].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[2].detail)
    return
  }

  try {
    if (!weOpenedCaja) {
      // Caja abierta por otra sesión — no interferir
      results[2].result = '⏭️ OMITIDO'
      results[2].detail = 'Caja ya estaba abierta al inicio — no se cierra para no interferir'
      return
    }

    const rate     = await getRate()
    const closeRes = await api.post(`${BASE}/api/cash/close`, {
      data: {
        closing_amount_usd: 50,
        closing_amount_bs:  Math.round(50 * rate * 100) / 100,
        close_notes:        'Cierre auditoria ciclo',
      },
    })
    expect(closeRes.status()).toBe(200)
    const closeBody = await closeRes.json() as { ok: boolean }
    expect(closeBody.ok).toBe(true)

    // Verificar que caja quedó cerrada
    const check     = await api.get(`${BASE}/api/cash/status`)
    const checkBody = await check.json() as { isOpen: boolean }
    expect(checkBody.isOpen).toBe(false)

    results[2].result = '✅ PASA'
    results[2].detail = 'isOpen=false confirmado'
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 3
    results[2].result = '❌ FALLA'
    results[2].detail = String(err)
    throw err
  }
})

// ── Nodo 4 — Reportes ─────────────────────────────────────────────────────────

test('Nodo 4 — Reportes: daily report > 0 ventas hoy', async () => {
  if (blockedFrom > 0) {
    results[3].result = '⚠️ BLOQUEADO'
    results[3].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[3].detail)
    return
  }

  try {
    // Diagnóstico: verificar que la venta de Nodo 2 sea visible vía GET /api/sales
    const salesCheck = await api.get(`${BASE}/api/sales?status=paid`)
    const salesBody  = await salesCheck.json() as { ok: boolean; sales: Array<{ id: number; status: string; sold_at: string | null }> }
    const ourSale    = salesBody.sales?.find(s => s.id === saleId)
    console.log(`[N4 diag] saleId=${saleId} found=${!!ourSale} sold_at=${ourSale?.sold_at ?? 'N/A'}`)

    // Use explicit UTC components — server uses Date.UTC for the daily window
    const now   = new Date()
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    console.log(`[N4 diag] querying date=${today} (UTC)`)
    const res   = await api.get(`${BASE}/api/reports/daily?date=${today}`)
    expect(res.status()).toBe(200)

    const body = await res.json() as {
      ok:          boolean
      date:        string
      sales_count: number
      total_usd:   number
    }
    console.log(`[N4 diag] report → ok=${body.ok} date=${body.date} sales_count=${body.sales_count}`)
    expect(body.ok).toBe(true)
    expect(body.date).toBe(today)
    expect(body.sales_count, 'daily sales_count debe ser > 0').toBeGreaterThan(0)
    expect(body.total_usd,   'daily total_usd debe ser > 0').toBeGreaterThan(0)

    results[3].result = '✅ PASA'
    results[3].detail = `date=${today} | sales_count=${body.sales_count} | total_usd=$${body.total_usd.toFixed(2)}`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 4
    results[3].result = '❌ FALLA'
    results[3].detail = String(err)
    throw err
  }
})

// ── Nodo 5 — Clientes CxC ────────────────────────────────────────────────────

test('Nodo 5 — Clientes CxC: venta pending queda en DB', async () => {
  if (blockedFrom > 0) {
    results[4].result = '⚠️ BLOQUEADO'
    results[4].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[4].detail)
    return
  }

  try {
    // Venta a crédito a 30 días — no requiere payment_methods
    const dueDate   = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const creditRes = await api.post(`${BASE}/api/sales`, {
      data: {
        status:       'pending',
        origin:       'credit',
        client_name:  'ACR_TEST_CLIENTE_CXC',
        items:        [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
        due_date:     dueDate,
        credit_days:  30,
        credit_notes: 'Crédito de prueba auditoría ciclo',
      },
    })
    expect(creditRes.status()).toBe(201)
    const creditBody = await creditRes.json() as {
      ok:   boolean
      sale: { id: number; status: string; ticket_number: string }
    }
    expect(creditBody.ok).toBe(true)
    expect(creditBody.sale.status).toBe('pending')
    creditSaleId = creditBody.sale.id

    // Verificar vía GET /api/sales?status=pending (usa entity_id — evita cap de take:100)
    const salesRes  = await api.get(`${BASE}/api/sales?status=pending`)
    expect(salesRes.status()).toBe(200)
    const salesBody = await salesRes.json() as {
      ok:    boolean
      sales: Array<{ id: number; status: string }>
    }
    const found = salesBody.sales.find(s => s.id === creditSaleId)
    expect(found, `Venta ${creditSaleId} debe aparecer en GET /api/sales?status=pending`).toBeDefined()
    expect(found?.status).toBe('pending')

    results[4].result = '✅ PASA'
    results[4].detail = `${creditBody.sale.ticket_number} | status=pending`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 5
    results[4].result = '❌ FALLA'
    results[4].detail = String(err)
    throw err
  }
})

// ── Nodo 6 — Pedidos Cobrar ──────────────────────────────────────────────────

test('Nodo 6 — Pedidos Cobrar: order cobrado → status delivered', async () => {
  if (blockedFrom > 0) {
    results[5].result = '⚠️ BLOQUEADO'
    results[5].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[5].detail)
    return
  }

  try {
    // 6a. Crear pedido propio (no depender de pedidos previos en DB)
    const orderRes = await api.post(`${BASE}/api/orders`, {
      data: {
        origin:      'whatsapp',
        client_name: 'ACR_TEST_CLIENTE_PEDIDO',
        items:       [{
          product_id:   productId,
          product_name: 'ACR_TEST_PROD',
          quantity:     1,
        }],
      },
    })
    expect(orderRes.status()).toBe(201)
    const orderBody = await orderRes.json() as {
      ok:    boolean
      order: { id: number; order_number: string }
    }
    expect(orderBody.ok).toBe(true)
    const orderId  = orderBody.order.id
    const orderNum = orderBody.order.order_number

    // 6b. Cobrar pedido → genera sale pagada y descuenta stock
    const localPmId = await getPmId()
    const cobrarRes = await api.post(`${BASE}/api/orders/${orderId}/cobrar`, {
      data: { payment_method_id: localPmId },
    })
    expect(cobrarRes.status()).toBe(200)
    const cobrarBody = await cobrarRes.json() as { ok: boolean; sale_id: number }
    expect(cobrarBody.ok).toBe(true)
    expect(cobrarBody.sale_id, 'cobrar debe generar sale_id').toBeGreaterThan(0)

    // 6c. Verificar order.status = 'delivered' vía API
    const checkRes  = await api.get(`${BASE}/api/orders`)
    expect(checkRes.status()).toBe(200)
    const checkBody = await checkRes.json() as {
      ok:     boolean
      orders: Array<{ id: number; status: string; sale_id: number | null }>
    }
    const found = checkBody.orders.find(o => o.id === orderId)
    expect(found, `Order ${orderId} debe aparecer en GET /api/orders`).toBeDefined()
    expect(found?.status).toBe('delivered')
    expect(found?.sale_id).toBe(cobrarBody.sale_id)

    results[5].result = '✅ PASA'
    results[5].detail = `order ${orderNum} → delivered | sale_id=${cobrarBody.sale_id}`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 6
    results[5].result = '❌ FALLA'
    results[5].detail = String(err)
    throw err
  }
})

// ── Nodo 7 — Finanzas Coherencia ─────────────────────────────────────────────

test('Nodo 7 — Finanzas Coherencia: resumen con ventas + CxC del ciclo', async () => {
  if (blockedFrom > 0) {
    results[6].result = '⚠️ BLOQUEADO'
    results[6].detail = `Nodo ${blockedFrom} falló`
    test.skip(true, results[6].detail)
    return
  }

  try {
    const res = await api.get(`${BASE}/api/finanzas/resumen`)
    expect(res.status()).toBe(200)

    const body = await res.json() as {
      ok:       boolean
      ingresos: { ventas_usd: number }
      cxc:      { total_pendiente_usd: number; count: number }
    }
    expect(body.ok).toBe(true)

    // Ventas del mes > 0 (al menos nuestra venta paid de Nodo 2 + cobro de Nodo 6)
    expect(body.ingresos.ventas_usd,         'ventas_usd del mes debe ser > 0').toBeGreaterThan(0)

    // CxC >= 1 (al menos nuestra venta pending de Nodo 5)
    expect(body.cxc.count,               'CxC count debe ser >= 1').toBeGreaterThanOrEqual(1)
    expect(body.cxc.total_pendiente_usd, 'CxC total debe ser > 0').toBeGreaterThan(0)

    results[6].result = '✅ PASA'
    results[6].detail = `ventas_usd=$${body.ingresos.ventas_usd.toFixed(2)} | CxC count=${body.cxc.count}`
  } catch (err) {
    if (blockedFrom === 0) blockedFrom = 7
    results[6].result = '❌ FALLA'
    results[6].detail = String(err)
    throw err
  }
})

}) // end test.describe.serial
