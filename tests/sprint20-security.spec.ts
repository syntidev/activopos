/**
 * Certificación Sprint 20 — Seguridad: SEC-01 + SEC-02 + Descuentos PIN
 * CLI-C | /api/sales · /api/sales/[id]/pay · /api/sales/[id]/authorize-discount
 *
 * Auth: storageState admin (playwright.config.ts)
 * Seed: admin@activopos.com / admin123 | cajero@activopos.com / cajero123
 *
 * SD01 — precio DB ignorando body manipulado (SEC-01)
 * SD02 — recipe_snapshot usado en cobro diferido (SEC-02)
 * SD03 — descuento con PIN incorrecto rechazado → 401
 * SD04 — descuento con PIN cashier sobre el límite → 403 / PIN admin → 200
 * SD05 — botón Descuento presente en POS (PIN modal pendiente CLI-B)
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getBcvRate(request: APIRequestContext): Promise<number> {
  const res  = await request.get(`${BASE}/api/rates/bcv`)
  const body = await res.json() as { rate?: number; data?: { promedio: number } }
  return body.rate ?? body.data?.promedio ?? 50
}

async function getPaymentMethodId(request: APIRequestContext): Promise<number> {
  const res  = await request.get(`${BASE}/api/payment-methods`)
  const body = await res.json() as { methods: { id: number }[] }
  return body.methods[0].id
}

async function getNetStock(request: APIRequestContext, productId: number): Promise<number> {
  const res  = await request.get(`${BASE}/api/inventory?product_id=${productId}`)
  const body = await res.json() as { entries: { quantity: number }[] }
  return body.entries.reduce((acc, e) => acc + e.quantity, 0)
}

// ── SD01 ─────────────────────────────────────────────────────────────────────
test('SD01 — precio DB ignorando body manipulado (SEC-01)', async ({ request }) => {
  // Create a product with known price $5.00
  const pRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLIC20_SD01_Producto',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 5.00,
    },
  })
  expect(pRes.status()).toBe(201)
  const pBody = await pRes.json() as { product: { id: number } }
  const productId = pBody.product.id

  const rate = await getBcvRate(request)
  const pmId = await getPaymentMethodId(request)

  // POST sale sending manipulated price 0.01 — server should ignore it and use DB price 5.00
  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'paid',
      origin: 'pos',
      items: [{
        product_id:   productId,
        quantity:     1,
        sale_mode:    'unit',
        discount_usd: 0,
        // Injected field — schema strips it, price must come from DB
        price_per_unit_usd: 0.01,
      }],
      payments: [{
        payment_method_id: pmId,
        amount_bs:         Math.round(5.00 * rate * 100) / 100,
        amount_usd:        5.00,
      }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleBody = await saleRes.json() as {
    ok: boolean
    sale: { total_usd: number; items: { price_per_unit_usd: number; subtotal_usd: number }[] }
  }
  expect(saleBody.ok).toBe(true)

  const item = saleBody.sale.items[0]
  // Price must be DB value ($5.00), never the injected $0.01
  expect(Number(item.price_per_unit_usd)).toBeCloseTo(5.00, 2)
  expect(Number(item.subtotal_usd)).toBeCloseTo(5.00, 2)
  expect(Number(saleBody.sale.total_usd)).toBeCloseTo(5.00, 2)
})

// ── SD02 ─────────────────────────────────────────────────────────────────────
test('SD02 — recipe_snapshot usado en cobro diferido (SEC-02)', async ({ request }) => {
  const pmId = await getPaymentMethodId(request)
  const rate = await getBcvRate(request)

  // Create simple component ($1.00)
  const compRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLIC20_SD02_Comp',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 1.00,
    },
  })
  expect(compRes.status()).toBe(201)
  const compId = (await compRes.json() as { product: { id: number } }).product.id

  // Add 10 units inventory
  await request.post(`${BASE}/api/inventory`, {
    data: { product_id: compId, quantity: 10, notes: 'SD02 setup' },
  })

  // Create combo ($3.00)
  const comboRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLIC20_SD02_Combo',
      product_type:       'combo',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 3.00,
    },
  })
  expect(comboRes.status()).toBe(201)
  const comboId = (await comboRes.json() as { product: { id: number } }).product.id

  // Add component to combo (qty=2 per combo unit)
  const addCompRes = await request.post(`${BASE}/api/products/${comboId}/components`, {
    data: { component_id: compId, quantity: 2, unit_label: 'und' },
  })
  expect(addCompRes.status()).toBe(201)
  const compRecordId = (await addCompRes.json() as { component: { id: number } }).component.id

  // Create PENDING sale (snapshot captured here: requires 2 units of comp per combo)
  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: comboId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const pendingSale = await saleRes.json() as { sale: { id: number; total_bs: number } }
  const saleId = pendingSale.sale.id

  // Capture stock before payment
  const stockBefore = await getNetStock(request, compId)

  // DELETE the component from the combo recipe — live recipe is now empty
  const delRes = await request.delete(
    `${BASE}/api/products/${comboId}/components/${compRecordId}`
  )
  expect(delRes.status()).toBe(200)

  // Verify live recipe is now empty
  const recipeRes = await request.get(`${BASE}/api/products/${comboId}/components`)
  const recipeBody = await recipeRes.json() as { components: unknown[] }
  expect(recipeBody.components.length).toBe(0)

  // Pay the pending sale — should use snapshot (qty=2), NOT live empty recipe
  const payRes = await request.patch(`${BASE}/api/sales/${saleId}/pay`, {
    data: {
      payments: [{
        payment_method_id: pmId,
        amount_bs:         Math.round(3.00 * rate * 100) / 100,
        amount_usd:        3.00,
      }],
    },
  })
  expect(payRes.status()).toBe(200)

  const stockAfter = await getNetStock(request, compId)
  // Snapshot says qty=2 per combo unit → deduct 2
  // If live recipe was used instead → deduction would be 0 (empty recipe)
  expect(stockAfter).toBe(stockBefore - 2)
})

// ── SD03 ─────────────────────────────────────────────────────────────────────
test('SD03 — descuento con PIN incorrecto rechazado → 401', async ({ request }) => {
  // Create a pending sale to authorize against
  const pRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLIC20_SD03_Prod',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 4.00,
    },
  })
  const productId = (await pRes.json() as { product: { id: number } }).product.id

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleId = (await saleRes.json() as { sale: { id: number } }).sale.id

  // Wrong PIN → must be rejected
  const res = await request.post(`${BASE}/api/sales/${saleId}/authorize-discount`, {
    data: { pin: 'PININCORRECTO999', discount_pct: 10 },
  })
  expect(res.status()).toBe(401)
  const body = await res.json() as { error: string }
  expect(body.error).toContain('PIN')
})

// ── SD04 ─────────────────────────────────────────────────────────────────────
test('SD04 — cajero sobre límite → 403 | admin cualquier % → 200', async ({ request }) => {
  // Set max_discount_pct = 10 for the business
  await request.patch(`${BASE}/api/config/business`, {
    data: { max_discount_pct: 10 },
  })

  // Create product + pending sale
  const pRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLIC20_SD04_Prod',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 10.00,
    },
  })
  const productId = (await pRes.json() as { product: { id: number } }).product.id

  // Sale A: cashier over-limit test
  const saleARes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleARes.status()).toBe(201)
  const saleAId = (await saleARes.json() as { sale: { id: number } }).sale.id

  // Cashier PIN (cajero123) + 20% discount > max 10% → 403
  const resA = await request.post(`${BASE}/api/sales/${saleAId}/authorize-discount`, {
    data: { pin: 'cajero123', discount_pct: 20 },
  })
  expect(resA.status()).toBe(403)
  const bodyA = await resA.json() as { error: string }
  expect(bodyA.error).toContain('máximo')

  // Sale B: admin bypass test (separate sale, no prior discount)
  const saleBRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleBRes.status()).toBe(201)
  const saleBId = (await saleBRes.json() as { sale: { id: number } }).sale.id

  // Admin PIN (admin123) + 20% discount > max 10% → 200 (admin bypasses limit)
  const resB = await request.post(`${BASE}/api/sales/${saleBId}/authorize-discount`, {
    data: { pin: 'admin123', discount_pct: 20 },
  })
  expect(resB.status()).toBe(200)
  const bodyB = await resB.json() as { ok: boolean; discount_pct: number; new_total_usd: number }
  expect(bodyB.ok).toBe(true)
  expect(bodyB.discount_pct).toBe(20)
  // $10.00 × (1 - 0.20) = $8.00
  expect(bodyB.new_total_usd).toBeCloseTo(8.00, 2)
})

// ── SD05 ─────────────────────────────────────────────────────────────────────
// NOTA: Modal PIN con shake está pendiente CLI-B (commit dd3862f: "Pendiente: CLI-B — UI modal de PIN en caja")
// Este test verifica que el botón Descuento está presente y accesible en el ticket panel
test('SD05 — botón Descuento presente en ticket panel POS', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${BASE}/pos`)
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/login/)

  // El botón Descuento vive en el footer del TicketPanel
  const descBtn = page.locator('button:has-text("Descuento")').first()
  await expect(descBtn).toBeVisible({ timeout: 6000 })
  // Disabled cuando el carrito está vacío (comportamiento correcto)
  await expect(descBtn).toBeDisabled()
})
