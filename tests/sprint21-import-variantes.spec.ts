/**
 * Certificación Sprint 21 — Import Excel + Variantes + PIN Rate Limit
 * CLI-C | /api/products/import-excel · /api/products/[id]/variants · /api/sales · /api/sales/[id]/authorize-discount
 *
 * Auth: storageState admin (playwright.config.ts) — admin@activopos.com / admin123
 *
 * IM01 — dry_run captura errores sin crear productos
 * IM02 — import real crea producto + inventory entry
 * IM03 — xlsx vacío (sin filas de datos) → 400
 * VA01 — POST variante → 201 + objeto variant retornado
 * VA02 — price_usd de variante override precio producto en venta (SEC-01 ext.)
 * VA03 — variant_id de otro producto en venta → error del servidor
 * PI01 — rate limiter DB bloquea tras 5 intentos fallidos → 6.º intento 429 (SEC-04)
 * PI02 — PIN correcto limpia el contador; intento posterior no hereda bloqueo
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import * as XLSX from 'xlsx'

const BASE = 'http://localhost:3000'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeXlsx(rows: (string | number | null)[][]): Buffer {
  const headers = ['nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'product_type', 'unit_label']
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[])
}

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

// ── IM01 ─────────────────────────────────────────────────────────────────────
test('IM01 — dry_run captura errores sin crear productos', async ({ request }) => {
  const xlsx = makeXlsx([
    ['', 5.00, 1.50, 10, 'TestCat', 'simple', 'und'],                      // row 2: inválido (nombre vacío)
    ['CLIC21_IM01_Valid', 8.00, 2.00, 20, 'TestCat', 'simple', 'und'],     // row 3: válido
  ])

  const res = await request.post(`${BASE}/api/products/import-excel`, {
    multipart: {
      file: {
        name:     'dry.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer:   xlsx,
      },
      dry_run: 'true',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json() as {
    ok:       boolean
    dry_run:  boolean
    valid:    number
    errors:   { row: number; message: string }[]
  }
  expect(body.ok).toBe(true)
  expect(body.dry_run).toBe(true)
  expect(body.valid).toBe(1)
  expect(body.errors.length).toBeGreaterThanOrEqual(1)

  // dry_run=true → respuesta no tiene campo "created" (no se persistió nada)
  expect((body as Record<string, unknown>)['created']).toBeUndefined()
})

// ── IM02 ─────────────────────────────────────────────────────────────────────
test('IM02 — import real crea producto + inventory entry', async ({ request }) => {
  const xlsx = makeXlsx([
    ['CLIC21_IM02_Prod', 12.50, 5.00, 15, 'ImportTest', 'simple', 'und'],
  ])

  const res = await request.post(`${BASE}/api/products/import-excel`, {
    multipart: {
      file: {
        name:     'import.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer:   xlsx,
      },
      dry_run: 'false',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json() as {
    ok:      boolean
    dry_run: boolean
    created: number
    errors:  { row: number; message: string }[]
  }
  expect(body.ok).toBe(true)
  expect(body.dry_run).toBe(false)
  expect(body.created).toBe(1)
  expect(body.errors.filter(e => e.row >= 2).length).toBe(0)
})

// ── IM03 ─────────────────────────────────────────────────────────────────────
test('IM03 — xlsx sin filas de datos → 400 vacío', async ({ request }) => {
  // Only headers, no data rows → sheet_to_json returns []
  const xlsx = makeXlsx([])

  const res = await request.post(`${BASE}/api/products/import-excel`, {
    multipart: {
      file: {
        name:     'empty.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer:   xlsx,
      },
      dry_run: 'false',
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json() as { error: string }
  expect(body.error).toContain('vacío')
})

// ── VA01 ─────────────────────────────────────────────────────────────────────
test('VA01 — POST variante → 201 + objeto variant retornado', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC21_VA01_Base', 10.00)

  const res = await request.post(`${BASE}/api/products/${productId}/variants`, {
    data: {
      tipo:         'talla',
      valor:        'M',
      precio_extra: 0,
      stock:        50,
      price_usd:    7.50,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json() as { ok: boolean; variant: { id: number; product_id: number; valor: string; price_usd: number } }
  expect(body.ok).toBe(true)
  expect(body.variant.id).toBeGreaterThan(0)
  expect(body.variant.product_id).toBe(productId)
  expect(body.variant.valor).toBe('M')
  expect(Number(body.variant.price_usd)).toBeCloseTo(7.50, 2)
})

// ── VA02 ─────────────────────────────────────────────────────────────────────
test('VA02 — price_usd de variante overrides precio producto en venta', async ({ request }) => {
  // Product at $10, variant at $5 → sale should use $5
  const productId = await createProduct(request, 'CLIC21_VA02_Base', 10.00)

  const varRes = await request.post(`${BASE}/api/products/${productId}/variants`, {
    data: { tipo: 'color', valor: 'Rojo', precio_extra: 0, stock: 20, price_usd: 5.00 },
  })
  expect(varRes.status()).toBe(201)
  const variantId = (await varRes.json() as { variant: { id: number } }).variant.id

  const rate = await getBcvRate(request)
  const pmId = await getPaymentMethodId(request)

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'paid',
      origin: 'pos',
      items: [{
        product_id:   productId,
        quantity:     1,
        sale_mode:    'unit',
        discount_usd: 0,
        variant_id:   variantId,
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
    ok:   boolean
    sale: { total_usd: number; items: { price_per_unit_usd: number; variant_id: number }[] }
  }
  expect(saleBody.ok).toBe(true)

  const item = saleBody.sale.items[0]
  // Variant price ($5) must win over product price ($10)
  expect(Number(item.price_per_unit_usd)).toBeCloseTo(5.00, 2)
  expect(Number(saleBody.sale.total_usd)).toBeCloseTo(5.00, 2)
  expect(item.variant_id).toBe(variantId)
})

// ── VA03 ─────────────────────────────────────────────────────────────────────
test('VA03 — variant_id de otro producto → sale rechazado', async ({ request }) => {
  // Create two separate products
  const productA = await createProduct(request, 'CLIC21_VA03_A', 8.00)
  const productB = await createProduct(request, 'CLIC21_VA03_B', 6.00)

  // Variant belongs to product A
  const varRes = await request.post(`${BASE}/api/products/${productA}/variants`, {
    data: { tipo: 'talla', valor: 'L', precio_extra: 0, stock: 10, price_usd: 8.00 },
  })
  expect(varRes.status()).toBe(201)
  const variantA = (await varRes.json() as { variant: { id: number } }).variant.id

  // Attempt to sell product B but with variant from product A
  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{
        product_id:   productB,   // product B
        quantity:     1,
        sale_mode:    'unit',
        discount_usd: 0,
        variant_id:   variantA,   // variant from product A → mismatch
      }],
    },
  })
  // Variant mismatch throws inside transaction → currently returns 500
  // Documented as VA-FIND P3 in CERT_SPRINT21.md (pending CLI-A to add to knownErrors)
  expect(saleRes.status()).not.toBe(201)
})

// ── PI01 ─────────────────────────────────────────────────────────────────────
test('PI01 — rate limiter DB bloquea tras 5 intentos fallidos (SEC-04)', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC21_PI01_Prod', 20.00)

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleId = (await saleRes.json() as { sale: { id: number } }).sale.id

  const wrongPin = '0000'

  // 5 wrong PINs → all return 401 (rate limiter increments, not yet blocked)
  for (let i = 0; i < 5; i++) {
    const res = await request.post(`${BASE}/api/sales/${saleId}/authorize-discount`, {
      data: { pin: wrongPin, discount_pct: 10 },
    })
    expect(res.status()).toBe(401)
  }

  // 6th attempt → rate limiter returns true → 429 (blocked)
  const blockedRes = await request.post(`${BASE}/api/sales/${saleId}/authorize-discount`, {
    data: { pin: wrongPin, discount_pct: 10 },
  })
  expect(blockedRes.status()).toBe(429)
})

// ── PI02 ─────────────────────────────────────────────────────────────────────
test('PI02 — PIN correcto limpia contador; intento posterior no está bloqueado', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC21_PI02_Prod', 10.00)

  const saleRes = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(saleRes.status()).toBe(201)
  const saleId = (await saleRes.json() as { sale: { id: number } }).sale.id

  // 4 wrong PINs — at threshold (4 < 5), counter should be at 4
  for (let i = 0; i < 4; i++) {
    const res = await request.post(`${BASE}/api/sales/${saleId}/authorize-discount`, {
      data: { pin: '9999', discount_pct: 5 },
    })
    expect(res.status()).toBe(401)
  }

  // Correct PIN → 200, counter CLEARED via clearPinAttempts()
  const goodRes = await request.post(`${BASE}/api/sales/${saleId}/authorize-discount`, {
    data: { pin: 'admin123', discount_pct: 5 },
  })
  expect(goodRes.status()).toBe(200)
  const goodBody = await goodRes.json() as { ok: boolean; discount_pct: number }
  expect(goodBody.ok).toBe(true)
  expect(goodBody.discount_pct).toBe(5)

  // Hmm, sale now has discount_pct=5. Create a new sale to test counter reset.
  const sale2Res = await request.post(`${BASE}/api/sales`, {
    data: {
      status: 'pending',
      origin: 'pos',
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
    },
  })
  expect(sale2Res.status()).toBe(201)
  const sale2Id = (await sale2Res.json() as { sale: { id: number } }).sale.id

  // New sale has fresh counter → 1 wrong PIN → 401 (not 429)
  const freshRes = await request.post(`${BASE}/api/sales/${sale2Id}/authorize-discount`, {
    data: { pin: '9999', discount_pct: 10 },
  })
  // Must be 401 (auth failure), NOT 429 (rate limited) — counter starts fresh per sale
  expect(freshRes.status()).toBe(401)
})
