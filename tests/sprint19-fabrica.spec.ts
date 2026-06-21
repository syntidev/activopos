/**
 * Certificación Sprint 19 — Módulo Fábrica + Venta por Peso
 * CLI-C | /api/products/[id]/components · /api/sales · /api/inventory
 *
 * Auth: storageState admin (playwright.config.ts)
 *
 * FA01 — Crear producto combo con componentes vía API
 * FA02 — Vender combo descuenta stocks de componentes (no del combo)
 * FA03 — recipe_snapshot guardado en sale_items
 * FA04 — Producto por peso acepta cantidad decimal y descuenta correctamente
 * FA05 — Validación anti-circular: producto no puede ser su propio componente
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ── Estado compartido entre tests ───────────────────────────────────────────
let paymentMethodId: number
let componentXId: number
let componentYId: number
let comboId: number
let weightProductId: number
let paidSaleId: number

// Helpers

async function getNetStock(request: APIRequestContext, productId: number): Promise<number> {
  const res = await request.get(`${BASE}/api/inventory?product_id=${productId}`)
  const body = await res.json() as { ok: boolean; entries: { quantity: number }[] }
  return body.entries.reduce((acc, e) => acc + e.quantity, 0)
}

// ── Setup ────────────────────────────────────────────────────────────────────
test.beforeAll(async ({ request }) => {
  // Obtener método de pago activo
  const pmRes = await request.get(`${BASE}/api/payment-methods`)
  const pmBody = await pmRes.json() as { ok: boolean; methods: { id: number }[] }
  expect(pmBody.ok).toBe(true)
  expect(pmBody.methods.length).toBeGreaterThan(0)
  paymentMethodId = pmBody.methods[0].id

  // Crear componente X (simple)
  const xRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLI-C19_ComponenteX',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 2.00,
    },
  })
  expect(xRes.status()).toBe(201)
  const xBody = await xRes.json() as { product: { id: number } }
  componentXId = xBody.product.id

  // Crear componente Y (simple)
  const yRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLI-C19_ComponenteY',
      product_type:       'simple',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 3.00,
    },
  })
  expect(yRes.status()).toBe(201)
  const yBody = await yRes.json() as { product: { id: number } }
  componentYId = yBody.product.id

  // Inventario inicial: X=10, Y=5
  await request.post(`${BASE}/api/inventory`, {
    data: { product_id: componentXId, quantity: 10, notes: 'Setup CLI-C19' },
  })
  await request.post(`${BASE}/api/inventory`, {
    data: { product_id: componentYId, quantity: 5, notes: 'Setup CLI-C19' },
  })

  // Crear producto combo
  const comboRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLI-C19_Combo_Desayuno',
      product_type:       'combo',
      unit_type:          'unit',
      unit_step:          1,
      sale_mode:          'unit',
      price_per_unit_usd: 5.00,
    },
  })
  expect(comboRes.status()).toBe(201)
  const comboBody = await comboRes.json() as { product: { id: number } }
  comboId = comboBody.product.id

  // Crear producto por peso
  const wRes = await request.post(`${BASE}/api/products`, {
    data: {
      name:               'CLI-C19_Queso_Peso',
      product_type:       'simple',
      unit_type:          'weight',
      unit_step:          0.001,
      sale_mode:          'weight',
      base_unit_label:    'kg',
      price_per_unit_usd: 8.00,
    },
  })
  expect(wRes.status()).toBe(201)
  const wBody = await wRes.json() as { product: { id: number } }
  weightProductId = wBody.product.id

  // Inventario inicial peso: 10 kg
  await request.post(`${BASE}/api/inventory`, {
    data: { product_id: weightProductId, quantity: 10, notes: 'Setup CLI-C19 peso' },
  })
})

// ── FA01 ──────────────────────────────────────────────────────────────────────
test('FA01 — crear combo con dos componentes devuelve 201', async ({ request }) => {
  const r1 = await request.post(`${BASE}/api/products/${comboId}/components`, {
    data: { component_id: componentXId, quantity: 1, unit_label: 'und' },
  })
  expect(r1.status()).toBe(201)
  const b1 = await r1.json() as { ok: boolean; component: { component_id: number } }
  expect(b1.ok).toBe(true)
  expect(b1.component.component_id).toBe(componentXId)

  const r2 = await request.post(`${BASE}/api/products/${comboId}/components`, {
    data: { component_id: componentYId, quantity: 1, unit_label: 'und' },
  })
  expect(r2.status()).toBe(201)
  const b2 = await r2.json() as { ok: boolean; component: { component_id: number } }
  expect(b2.ok).toBe(true)
  expect(b2.component.component_id).toBe(componentYId)

  // Verificar GET devuelve 2 componentes
  const getRes = await request.get(`${BASE}/api/products/${comboId}/components`)
  expect(getRes.status()).toBe(200)
  const getBody = await getRes.json() as { ok: boolean; components: unknown[] }
  expect(getBody.components.length).toBe(2)
})

// ── FA02 ──────────────────────────────────────────────────────────────────────
test('FA02 — vender combo descuenta componentes, no el combo', async ({ request }) => {
  // Stock inicial
  const stockX0 = await getNetStock(request, componentXId)
  const stockY0 = await getNetStock(request, componentYId)
  expect(stockX0).toBeGreaterThanOrEqual(10)
  expect(stockY0).toBeGreaterThanOrEqual(5)

  // Vender 1 combo (paid directo)
  const totalUsd = 5.00
  const rateRes = await request.get(`${BASE}/api/rates/bcv`)
  const rateBody = await rateRes.json() as { rate?: number; data?: { promedio: number } }
  const rate = rateBody.rate ?? rateBody.data?.promedio ?? 50
  const totalBs = Math.round(totalUsd * rate * 100) / 100

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'paid',
      origin: 'pos',
      items: [{
        product_id:         comboId,
        quantity:           1,
        price_per_unit_usd: 5.00,
        sale_mode:          'unit',
        discount_usd:       0,
      }],
      payments: [{
        payment_method_id: paymentMethodId,
        amount_bs:         totalBs,
        amount_usd:        totalUsd,
      }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleBody = await saleRes.json() as { ok: boolean; sale: { id: number } }
  expect(saleBody.ok).toBe(true)
  paidSaleId = saleBody.sale.id

  // Verificar stock componentes decrementó en 1 c/u
  const stockX1 = await getNetStock(request, componentXId)
  const stockY1 = await getNetStock(request, componentYId)
  expect(stockX1).toBe(stockX0 - 1)
  expect(stockY1).toBe(stockY0 - 1)
})

// ── FA03 ──────────────────────────────────────────────────────────────────────
test('FA03 — recipe_snapshot guardado en sale_items del combo', async ({ request }) => {
  expect(paidSaleId).toBeDefined()

  const res = await request.get(`${BASE}/api/sales?status=paid`)
  const body = await res.json() as {
    ok: boolean
    sales: {
      id: number
      items: { product_id: number; recipe_snapshot: string | null }[]
    }[]
  }
  expect(body.ok).toBe(true)

  const sale = body.sales.find(s => s.id === paidSaleId)
  expect(sale).toBeDefined()

  const comboItem = sale!.items.find(i => i.product_id === comboId)
  expect(comboItem).toBeDefined()
  expect(comboItem!.recipe_snapshot).not.toBeNull()

  const snapshot = JSON.parse(comboItem!.recipe_snapshot!) as { component_id: number }[]
  const ids = snapshot.map(s => s.component_id)
  expect(ids).toContain(componentXId)
  expect(ids).toContain(componentYId)
})

// ── FA04 ──────────────────────────────────────────────────────────────────────
test('FA04 — producto por peso acepta qty decimal y descuenta correctamente', async ({ request }) => {
  const stockBefore = await getNetStock(request, weightProductId)
  expect(stockBefore).toBeGreaterThanOrEqual(10)

  const rateRes = await request.get(`${BASE}/api/rates/bcv`)
  const rateBody = await rateRes.json() as { rate?: number; data?: { promedio: number } }
  const rate = rateBody.rate ?? rateBody.data?.promedio ?? 50
  const qty = 1.250
  const priceUsd = 8.00
  const totalUsd = Math.round(qty * priceUsd * 10000) / 10000
  const totalBs = Math.round(totalUsd * rate * 100) / 100

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'paid',
      origin: 'pos',
      items: [{
        product_id:         weightProductId,
        quantity:           qty,
        price_per_unit_usd: priceUsd,
        sale_mode:          'weight',
        discount_usd:       0,
      }],
      payments: [{
        payment_method_id: paymentMethodId,
        amount_bs:         totalBs,
        amount_usd:        totalUsd,
      }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleBody = await saleRes.json() as {
    ok: boolean
    sale: { items: { quantity: number; subtotal_usd: number }[] }
  }
  expect(saleBody.ok).toBe(true)

  const item = saleBody.sale.items[0]
  expect(Number(item.quantity)).toBeCloseTo(1.250, 3)
  expect(Number(item.subtotal_usd)).toBeCloseTo(10.00, 2)

  const stockAfter = await getNetStock(request, weightProductId)
  expect(stockAfter).toBeCloseTo(stockBefore - 1.250, 2)
})

// ── FA05 ──────────────────────────────────────────────────────────────────────
test('FA05 — anti-circular: combo no puede ser su propio componente', async ({ request }) => {
  const res = await request.post(`${BASE}/api/products/${comboId}/components`, {
    data: { component_id: comboId, quantity: 1, unit_label: 'und' },
  })
  expect(res.status()).toBe(422)
  const body = await res.json() as { error: string }
  expect(body.error).toContain('sí mismo')
})
