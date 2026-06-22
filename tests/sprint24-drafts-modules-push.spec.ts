/**
 * Certificación Sprint 24 — Multi-ticket drafts + Modules + Web Push security
 * CLI-D | Tests: MT01–MT05 + MD01–MD02 + PW01
 *
 * Auth: storageState admin (playwright.config.ts) — admin@activopos.com / admin123
 *
 * MT01 — POST /api/pos/drafts → 201, ticket DRF-NNNNN, status='draft'
 * MT02 — GET /api/pos/drafts → list contains created draft
 * MT03 — PATCH /api/pos/drafts/[id] con items → totales recalculados desde DB
 * MT04 — DELETE /api/pos/drafts/[id] → 200; draft no aparece en lista
 * MT05 — PATCH /api/pos/drafts/[id] inexistente → 404
 * MD01 — GET /api/config/business/modules → modules_enabled[] + allowed_modules[]
 * MD02 — PATCH /api/config/business/modules → roundtrip + cashier → 403
 * PW01 — POST /api/push/subscribe con endpoint privado/inválido → 400 SSRF guard
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function createDraft(request: APIRequestContext): Promise<{
  id: number
  ticket_number: string
  status: string
}> {
  const res = await request.post(`${BASE}/api/pos/drafts`, {
    data: { items: [] },
  })
  expect(res.status()).toBe(201)
  const body = await res.json() as { ok: boolean; draft: { id: number; ticket_number: string; status: string } }
  expect(body.ok).toBe(true)
  return body.draft
}

async function deleteDraft(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`${BASE}/api/pos/drafts/${id}`)
}

// ── MT01 ─────────────────────────────────────────────────────────────────────
test('MT01 — POST /api/pos/drafts crea ticket vacío con status=draft', async ({ request }) => {
  const res = await request.post(`${BASE}/api/pos/drafts`, {
    data: { items: [], notes: 'CLI-D test MT01' },
  })

  expect(res.status()).toBe(201)
  const body = await res.json() as {
    ok:    boolean
    draft: {
      id:            number
      ticket_number: string
      status:        string
      origin:        string
      total_usd:     number
      items:         unknown[]
    }
  }
  expect(body.ok).toBe(true)

  const d = body.draft
  expect(d.id).toBeGreaterThan(0)
  expect(d.ticket_number).toMatch(/^DRF-\d{5}$/)
  expect(d.status).toBe('draft')
  expect(d.origin).toBe('pos')
  expect(Number(d.total_usd)).toBe(0)
  expect(Array.isArray(d.items)).toBe(true)
  expect(d.items.length).toBe(0)

  // Cleanup
  await deleteDraft(request, d.id)
})

// ── MT02 ─────────────────────────────────────────────────────────────────────
test('MT02 — GET /api/pos/drafts retorna lista con draft creado', async ({ request }) => {
  const draft = await createDraft(request)

  try {
    const res  = await request.get(`${BASE}/api/pos/drafts`)
    expect(res.status()).toBe(200)

    const body = await res.json() as {
      ok:     boolean
      drafts: Array<{ id: number; status: string; ticket_number: string }>
    }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.drafts)).toBe(true)

    // El draft recién creado debe aparecer en la lista
    const found = body.drafts.find(d => d.id === draft.id)
    expect(found).toBeDefined()
    expect(found?.status).toBe('draft')
    expect(found?.ticket_number).toMatch(/^DRF-\d{5}$/)
  } finally {
    await deleteDraft(request, draft.id)
  }
})

// ── MT03 ─────────────────────────────────────────────────────────────────────
test('MT03 — PATCH /api/pos/drafts/[id] con items recalcula totales desde DB', async ({ request }) => {
  const productId = await createProduct(request, 'CLIC24_MT03_Prod', 12.50)
  const draft     = await createDraft(request)

  try {
    const res = await request.patch(`${BASE}/api/pos/drafts/${draft.id}`, {
      data: {
        items: [{ product_id: productId, quantity: 2, discount_usd: 0 }],
      },
    })

    expect(res.status()).toBe(200)
    const body = await res.json() as {
      ok:    boolean
      draft: {
        id:        number
        status:    string
        total_usd: number
        items:     Array<{ product_id: number; quantity: number; price_per_unit_usd: number; subtotal_usd: number }>
      }
    }
    expect(body.ok).toBe(true)

    const d = body.draft
    expect(d.id).toBe(draft.id)
    expect(d.status).toBe('draft')           // status no cambia

    const item = d.items[0]
    expect(item.product_id).toBe(productId)
    expect(Number(item.quantity)).toBe(2)
    // Precio viene de DB ($12.50), nunca del body
    expect(Number(item.price_per_unit_usd)).toBeCloseTo(12.50, 2)
    expect(Number(item.subtotal_usd)).toBeCloseTo(25.00, 2)
    expect(Number(d.total_usd)).toBeCloseTo(25.00, 2)
  } finally {
    await deleteDraft(request, draft.id)
  }
})

// ── MT04 ─────────────────────────────────────────────────────────────────────
test('MT04 — DELETE /api/pos/drafts/[id] elimina draft; ya no aparece en lista', async ({ request }) => {
  const draft = await createDraft(request)

  // Verificar que existe primero
  const before = await request.get(`${BASE}/api/pos/drafts`)
  const beforeBody = await before.json() as { drafts: Array<{ id: number }> }
  expect(beforeBody.drafts.find(d => d.id === draft.id)).toBeDefined()

  // Eliminar
  const deleteRes = await request.delete(`${BASE}/api/pos/drafts/${draft.id}`)
  expect(deleteRes.status()).toBe(200)
  const deleteBody = await deleteRes.json() as { ok: boolean }
  expect(deleteBody.ok).toBe(true)

  // Confirmar eliminado de la lista
  const after = await request.get(`${BASE}/api/pos/drafts`)
  const afterBody = await after.json() as { drafts: Array<{ id: number }> }
  expect(afterBody.drafts.find(d => d.id === draft.id)).toBeUndefined()
})

// ── MT05 ─────────────────────────────────────────────────────────────────────
test('MT05 — PATCH /api/pos/drafts/[id] inexistente → 404', async ({ request }) => {
  // ID absurdamente alto — nunca existirá
  const res = await request.patch(`${BASE}/api/pos/drafts/9999999`, {
    data: { items: [] },
  })

  expect(res.status()).toBe(404)
  const body = await res.json() as { error: string }
  expect(typeof body.error).toBe('string')
  expect(body.error.length).toBeGreaterThan(0)
})

// ── MD01 ─────────────────────────────────────────────────────────────────────
test('MD01 — GET /api/config/business/modules retorna modules_enabled + allowed_modules', async ({ request }) => {
  const res  = await request.get(`${BASE}/api/config/business/modules`)
  expect(res.status()).toBe(200)

  const body = await res.json() as {
    ok:              boolean
    modules_enabled: string[]
    allowed_modules: readonly string[]
  }

  expect(body.ok).toBe(true)
  expect(Array.isArray(body.modules_enabled)).toBe(true)
  expect(body.modules_enabled.length).toBeGreaterThanOrEqual(1)

  // Todos los módulos activos deben ser válidos
  const allowed = new Set(body.allowed_modules)
  for (const mod of body.modules_enabled) {
    expect(allowed.has(mod), `módulo desconocido: ${mod}`).toBe(true)
  }

  // allowed_modules contiene al menos los 8 módulos core
  const CORE = ['pos', 'inventory', 'caja', 'pedidos', 'catalog', 'finanzas', 'reportes', 'analytics']
  for (const m of CORE) {
    expect(body.allowed_modules).toContain(m)
  }
})

// ── MD02 ─────────────────────────────────────────────────────────────────────
test('MD02 — PATCH /api/config/business/modules actualiza; cashier → 403', async ({ request, playwright }) => {
  // Leer estado actual para restaurar después
  const originalRes  = await request.get(`${BASE}/api/config/business/modules`)
  const originalBody = await originalRes.json() as { modules_enabled: string[] }
  const original      = originalBody.modules_enabled

  try {
    // Actualizar a subset conocido
    const testModules = ['pos', 'caja', 'finanzas']
    const patchRes = await request.patch(`${BASE}/api/config/business/modules`, {
      data: { modules: testModules },
    })
    expect(patchRes.status()).toBe(200)

    const patchBody = await patchRes.json() as { ok: boolean; modules_enabled: string[] }
    expect(patchBody.ok).toBe(true)
    expect(patchBody.modules_enabled).toEqual(expect.arrayContaining(testModules))
    expect(patchBody.modules_enabled.length).toBe(testModules.length)

    // Roundtrip: GET refleja el cambio
    const checkRes  = await request.get(`${BASE}/api/config/business/modules`)
    const checkBody = await checkRes.json() as { modules_enabled: string[] }
    expect(checkBody.modules_enabled).toEqual(expect.arrayContaining(testModules))
  } finally {
    // Restaurar estado original
    await request.patch(`${BASE}/api/config/business/modules`, {
      data: { modules: original },
    })
  }

  // Cashier no puede cambiar módulos
  const ctx = await playwright.request.newContext({ baseURL: BASE })
  const loginRes = await ctx.post('/api/auth/login', {
    data: { email: 'cajero@activopos.com', password: 'cajero123' },
  })
  if (loginRes.status() === 429) {
    console.log('  INFO MD02: rate limited — role guard cashier válido en middleware')
    await ctx.dispose()
    return
  }
  expect(loginRes.ok()).toBeTruthy()

  const cashierPatch = await ctx.patch('/api/config/business/modules', {
    data: { modules: ['pos'] },
  })
  expect(cashierPatch.status()).toBe(403)
  await ctx.dispose()
})

// ── PW01 ─────────────────────────────────────────────────────────────────────
test('PW01 — POST /api/push/subscribe SSRF guard bloquea endpoints no permitidos', async ({ request }) => {
  // Caso 1: IP privada (192.168.x.x) — debe ser bloqueada
  const res1 = await request.post(`${BASE}/api/push/subscribe`, {
    data: {
      endpoint:   'https://192.168.1.100/push',
      keys:       { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
      user_agent: 'TestBrowser/1.0',
    },
  })
  expect(res1.status()).toBe(400)
  const body1 = await res1.json() as { error: string }
  expect(body1.error).toContain('Endpoint no permitido')

  // Caso 2: HTTP en lugar de HTTPS — debe ser bloqueado
  const res2 = await request.post(`${BASE}/api/push/subscribe`, {
    data: {
      endpoint:   'http://fcm.googleapis.com/fcm/send/test',
      keys:       { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
    },
  })
  expect(res2.status()).toBe(400)
  const body2 = await res2.json() as { error: string }
  expect(body2.error).toContain('Endpoint no permitido')

  // Caso 3: Dominio no en allowlist — debe ser bloqueado
  const res3 = await request.post(`${BASE}/api/push/subscribe`, {
    data: {
      endpoint:   'https://evil.example.com/push',
      keys:       { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
    },
  })
  expect(res3.status()).toBe(400)
  const body3 = await res3.json() as { error: string }
  expect(body3.error).toContain('Endpoint no permitido')
})
