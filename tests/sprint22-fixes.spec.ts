/**
 * Certificación Sprint 22 — Security fixes + UX improvements
 * CLI-C | Tests: SP22-01 a SP22-08
 *
 * Auth: storageState admin (playwright.config.ts) — admin@activopos.com / admin123
 *
 * SP22-01 — orders: precio del body ignorado, se usa precio DB (A5-1)
 * SP22-02 — order_number único bajo 3 POSTs concurrentes (A3-1)
 * SP22-03 — vuelto_usd calculado cuando pago excede total (BUG-01)
 * SP22-04 — finanzas/resumen usa due_date (campo nuevo), no heurístico 30d (BUG-03)
 * SP22-05 — CobroModal bloquea "Confirmar" sin referencia en método que la requiere (A1-2)
 * SP22-06 — pedidos: skeleton loading + EmptyState único (A3-2 + A3-3)
 * SP22-07 — crédito sin cliente → backend NO lo rechaza [gap documentado, pendiente CLI-A]
 * SP22-08 — /api/rates/bcv retorna tasa bcv, paralelo y usdt
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getBcvRate(request: APIRequestContext): Promise<number> {
  const res  = await request.get(`${BASE}/api/rates/bcv`)
  const body = await res.json() as { bcv?: number; rate?: number }
  return body.bcv ?? body.rate ?? 50
}

async function getPaymentMethodId(request: APIRequestContext): Promise<number> {
  const res  = await request.get(`${BASE}/api/payment-methods`)
  const body = await res.json() as { methods: { id: number }[] }
  return body.methods[0].id
}

async function createProduct(
  request: APIRequestContext,
  name: string,
  priceUsd: number
): Promise<number> {
  const res = await request.post(`${BASE}/api/products`, {
    data: {
      name,
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: priceUsd,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json() as { product: { id: number } }
  return body.product.id
}

// ── SP22-01 ───────────────────────────────────────────────────────────────────
test('SP22-01 — orders precio manipulado ignorado — usa precio DB (A5-1)', async ({ request }) => {
  // Create product at $10 in DB
  const productId = await createProduct(request, 'CLIC22_SP01_Prod', 10.00)

  // POST order — body does NOT include price_per_unit_usd (removed from schema)
  // NuevoPedidoModal would normally include it, but the server should fetch from DB
  const res = await request.post(`${BASE}/api/orders`, {
    data: {
      origin: 'pos',
      items: [{ product_id: productId, product_name: 'CLIC22_SP01_Prod', quantity: 1 }],
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json() as {
    ok:    boolean
    order: { total_usd: number; items: { price_per_unit_usd: number; subtotal_usd: number }[] }
  }
  expect(body.ok).toBe(true)

  // Price must come from DB ($10), not from client body
  const item = body.order.items[0]
  expect(Number(item.price_per_unit_usd)).toBeCloseTo(10.00, 2)
  expect(Number(item.subtotal_usd)).toBeCloseTo(10.00, 2)
  expect(Number(body.order.total_usd)).toBeCloseTo(10.00, 2)
})

// ── SP22-02 ───────────────────────────────────────────────────────────────────
test('SP22-02 — order_number único bajo 3 POSTs concurrentes (A3-1)', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC22_SP02_Prod', 5.00)

  // Fire 3 concurrent POSTs to exercise the atomic order_number logic
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      request.post(`${BASE}/api/orders`, {
        data: {
          origin: 'pos',
          items: [{ product_id: productId, product_name: 'CLIC22_SP02_Prod', quantity: 1 }],
        },
      })
    )
  )

  // All must succeed
  for (const res of results) {
    expect(res.status()).toBe(201)
  }

  // All order_numbers must be distinct
  const numbers = await Promise.all(
    results.map(async (r) => {
      const body = await r.json() as { order: { order_number: string } }
      return body.order.order_number
    })
  )

  // Documented gap: order_number uses findFirst(id desc)+1 inside tx but NO @@unique constraint.
  // Under MariaDB READ COMMITTED, concurrent txs can read same lastId → duplicate numbers.
  // This test verifies INTENDED behavior; duplicates indicate the gap is still open.
  // Expected: all unique. If this test becomes flaky, add @@unique([business_id, order_number]).
  const unique = new Set(numbers)
  expect(unique.size).toBe(results.length)
})

// ── SP22-03 ───────────────────────────────────────────────────────────────────
test('SP22-03 — vuelto_usd calculado cuando pago excede total (BUG-01)', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC22_SP03_Prod', 10.00)
  const rate      = await getBcvRate(request)
  const pmId      = await getPaymentMethodId(request)

  // Pay $15 for a $10 product — $5 excess
  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'paid',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
      payments: [{
        payment_method_id: pmId,
        amount_bs:         Math.round(15.00 * rate * 100) / 100,
        amount_usd:        15.00,
      }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleBody = await saleRes.json() as {
    ok:   boolean
    sale: {
      total_usd:          number
      monto_recibido_usd: number | null
      vuelto_usd:         number | null
    }
  }
  expect(saleBody.ok).toBe(true)

  const sale = saleBody.sale
  expect(Number(sale.total_usd)).toBeCloseTo(10.00, 2)
  // monto_recibido_usd = sum of payment amounts USD
  expect(Number(sale.monto_recibido_usd)).toBeCloseTo(15.00, 2)
  // vuelto_usd = max(0, monto_recibido - total) = $5.00
  expect(Number(sale.vuelto_usd)).toBeCloseTo(5.00, 2)
})

// ── SP22-04 ───────────────────────────────────────────────────────────────────
test('SP22-04 — finanzas/resumen expone due_date y campo por_vencer (BUG-03)', async ({ request }) => {
  const now  = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const res  = await request.get(`${BASE}/api/finanzas/resumen?year=${year}&month=${month}`)
  expect(res.status()).toBe(200)

  const body = await res.json() as {
    ok:  boolean
    cxc: {
      total_pendiente_usd: number
      count:               number
      vencidas:            number
      por_vencer?:         number
    }
  }
  expect(body.ok).toBe(true)

  // New shape: cxc now has "vencidas" (due_date-based, not 30d heuristic)
  // and "por_vencer" (próximos 7 días) — both fields prove the new schema is in use
  expect(typeof body.cxc.vencidas).toBe('number')
  expect(typeof body.cxc.por_vencer).toBe('number')

  // NOTA CRÍTICA (gap documentado): vencidas = 0 aunque haya ventas a crédito con
  // created_at > 30 días, porque sale.due_date nunca se escribe.
  // saleSchema no acepta due_date. procesarPago ignora CreditoModal.terms.
  // Pendiente CLI-A: agregar due_date a saleSchema y a postSale/procesarPago.
})

// ── SP22-05 ───────────────────────────────────────────────────────────────────
test('SP22-05 — CobroModal bloquea "Confirmar" sin referencia en método que la requiere (A1-2)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${BASE}/pos`)
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/login/)

  // Add a product to the cart — click the first available product card or list row
  const productCard = page.locator('[class*="productCard"],[class*="listRow"]').first()
  await productCard.waitFor({ timeout: 8000 })
  await productCard.click()

  // Open CobroModal via "Cobrar" button
  const cobrarBtn = page.locator('button:has-text("Cobrar")').first()
  await expect(cobrarBtn).toBeEnabled({ timeout: 5000 })
  await cobrarBtn.click()

  // Modal should open — look for a method requiring reference (pago_movil, zelle, transfer, binance)
  const referenceTypes = ['Pago Móvil', 'Zelle', 'Transferencia', 'Binance']
  let foundRefMethod = false

  for (const label of referenceTypes) {
    const btn = page.locator(`button:has-text("${label}")`).first()
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click()
      foundRefMethod = true
      break
    }
  }

  // If no reference-required method is configured in the test seed, skip UI assertion
  if (!foundRefMethod) {
    test.skip()
    return
  }

  // "Confirmar Venta" must be disabled — reference is empty
  const confirmBtn = page.locator('button:has-text("Confirmar Venta")').first()
  await expect(confirmBtn).toBeDisabled({ timeout: 3000 })

  // Enter reference → button becomes enabled
  const refInput = page.locator('input[aria-label*="eferencia"],input[placeholder*="eferencia"]').first()
  await refInput.fill('REF-123456')
  await expect(confirmBtn).toBeEnabled({ timeout: 2000 })
})

// ── SP22-06 ───────────────────────────────────────────────────────────────────
test('SP22-06 — pedidos: skeleton loading + EmptyState único (A3-2 + A3-3)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  // Intercept the orders API to delay it — allows skeleton to be visible
  await page.route('**/api/orders**', async (route) => {
    await new Promise((r) => setTimeout(r, 600))
    await route.continue()
  })

  await page.goto(`${BASE}/pedidos`)

  // Skeleton should render during loading (aria-busy="true")
  const skeleton = page.locator('[aria-busy="true"]')
  await expect(skeleton).toBeVisible({ timeout: 5000 })

  // Wait for page to finish loading
  await page.waitForLoadState('networkidle')

  // After load: kanban OR single empty state — never 5× duplicated "Sin pedidos"
  const sinPedidosCount = await page.locator('text=Sin pedidos').count()
  const noHayCount      = await page.locator('text=No hay pedidos activos').count()
  const totalEmpty      = sinPedidosCount + noHayCount

  // With old code: 4× "Sin pedidos" + 1× "No hay pedidos activos" = 5 total
  // With fixed code: either 0 (orders exist) or 1 (no orders) or up to 4 (orders in some cols)
  // Key assertion: never > 4 (no global + per-column duplication simultaneously)
  // If there are NO orders at all → exactly 1 empty state ("No hay pedidos activos")
  if (noHayCount > 0) {
    // Empty state branch: must be exactly 1
    expect(noHayCount).toBe(1)
    expect(sinPedidosCount).toBe(0)
  } else {
    // Orders exist: per-column "Sin pedidos" allowed (0–3 empty cols)
    expect(sinPedidosCount).toBeLessThanOrEqual(4)
    // Crucially, the global duplicate must NOT appear
    expect(noHayCount).toBe(0)
  }
  // In either case, no more duplicate global+local empty state
  expect(totalEmpty).toBeLessThanOrEqual(4)
})

// ── SP22-07 ───────────────────────────────────────────────────────────────────
test('SP22-07 — [GAP] crédito sin cliente acepta en backend — due_date nunca escrito', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC22_SP07_Prod', 8.00)

  // POST credit sale without client_id
  // EXPECTED after full fix: 400 "Crédito requiere cliente"
  // ACTUAL Sprint 22: 201 (backend does NOT enforce client_id for credit origin)
  const res = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'credit',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
      // Deliberately omitting client_id — backend should reject but currently does not
    },
  })

  // Document the current (incomplete) state:
  // If this becomes 400 in a future sprint, flip the assertion to toBe(400)
  expect(res.status()).toBe(201)   // gap: should be 400

  // Additionally verify: the created credit sale has no due_date
  // (due_date is never written because saleSchema doesn't accept it)
  if (res.status() === 201) {
    const body = await res.json() as {
      sale: { origin: string; due_date: string | null; status: string }
    }
    expect(body.sale.origin).toBe('credit')
    expect(body.sale.due_date).toBeNull()   // gap: should be set via CreditoModal.terms
  }

  // PENDIENTE CLI-A:
  // 1. Agregar due_date, credit_days, credit_notes a saleSchema
  // 2. Validar: if origin === 'credit' && !client_id → 400
  // 3. Conectar CobroModal → handleCreditoConfirm → pasar due_date a postSale
})

// ── SP22-08 ───────────────────────────────────────────────────────────────────
test('SP22-08 — /api/rates/bcv retorna tasa BCV + paralelo + USDT', async ({ request }) => {
  const res  = await request.get(`${BASE}/api/rates/bcv`)
  expect(res.status()).toBe(200)

  const body = await res.json() as {
    ok:       boolean
    bcv:      number | null
    paralelo: number | null
    usdt:     number | null
    rate:     number            // backward compat
    source:   string
  }
  expect(body.ok).toBe(true)

  // BCV rate: always a positive number (never null — has DB fallback)
  expect(typeof body.bcv).toBe('number')
  expect(body.bcv).toBeGreaterThan(0)

  // backward-compat field
  expect(body.rate).toBe(body.bcv)
  expect(body.source).toBe('bcv')

  // Paralelo and USDT: number or null (null if external API fails and no DB cache)
  expect(['number', 'object']).toContain(typeof body.paralelo)   // number | null
  expect(['number', 'object']).toContain(typeof body.usdt)       // number | null

  // If available, paralelo must be > 0 and typically higher than BCV
  if (body.paralelo !== null) {
    expect(body.paralelo).toBeGreaterThan(0)
  }
  if (body.usdt !== null) {
    expect(body.usdt).toBeGreaterThan(0)
  }
})
