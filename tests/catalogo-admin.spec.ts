/**
 * Certificación Módulo Catálogo Admin — Sprint 13
 * CLI-D | /catalogo-digital · /api/catalogo/metrics · /api/products/bulk-visibility
 *
 * Pre-condición: servidor en http://localhost:3000 con datos de prueba:
 *   - 16 productos, 14 visibles, 2 ocultos — slug del negocio: demo
 *
 * Flujo:
 *   CA01 — Vista admin carga con métricas reales (KPI cards visibles)
 *   CA02 — QR visible y botón de descarga presente
 *   CA03 — Bulk PATCH: productos ocultos desaparecen del catálogo público
 *   CA04 — Link "Ver catálogo" apunta al slug correcto del negocio
 *   CA05 — Métricas se actualizan tras crear orden de catálogo
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.beforeAll(async ({ browser }) => {
  const ctx  = await browser.newContext()
  const page = await ctx.newPage()
  const res  = await page.goto(`${BASE}/login`).catch(() => null)
  if (!res || res.status() !== 200) throw new Error('Servidor no disponible en beforeAll')
  await ctx.close()
})

test.describe('Catálogo Admin — Certificación Sprint 13', () => {

  // ── CA01 ────────────────────────────────────────────────────────────────
  test('CA01 — vista admin carga con métricas reales', async ({ page }) => {
    const res  = await page.request.get(`${BASE}/api/catalogo/metrics`)
    const body = await res.json() as {
      ok: boolean
      period: string
      products_summary: { total: number; visible: number; hidden: number; on_request: number }
    }

    expect(res.status()).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.products_summary.total).toBeGreaterThanOrEqual(1)
    expect(body.period.length).toBeGreaterThan(0)

    await page.goto(`${BASE}/catalogo-digital`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2_000)

    await expect(page.locator('h1').filter({ hasText: 'Catálogo Digital' })).toBeVisible({ timeout: 6_000 })

    // KPI cards muestran valores del resumen (no estado de carga)
    const visiblesCount = String(body.products_summary.visible)
    await expect(page.getByText(visiblesCount, { exact: true }).first()).toBeVisible({ timeout: 4_000 })
  })

  // ── CA02 ────────────────────────────────────────────────────────────────
  test('CA02 — QR visible y botón de descarga presente', async ({ page }) => {
    await page.goto(`${BASE}/catalogo-digital`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2_000)

    const qrImg = page.locator('img[alt="QR del catálogo"]')
    await expect(qrImg).toBeVisible({ timeout: 6_000 })

    const src = await qrImg.getAttribute('src')
    expect(src).toContain('chart.googleapis.com')
    expect(src).toContain('catalogo')

    const btnDescarga = page.getByRole('button', { name: /Descargar QR/i })
    await expect(btnDescarga).toBeVisible({ timeout: 4_000 })
  })

  // ── CA03 ────────────────────────────────────────────────────────────────
  test('CA03 — bulk visibility: productos ocultos desaparecen del catálogo público', async ({ page }) => {
    const catalogRes  = await page.request.get(`${BASE}/api/catalog/demo`)
    const catalogBody = await catalogRes.json() as {
      ok: boolean
      products: Array<{ id: number; name: string }>
    }

    expect(catalogBody.ok).toBe(true)
    expect(catalogBody.products.length).toBeGreaterThanOrEqual(2)

    const [p1, p2]  = catalogBody.products
    const idsToHide = [p1.id, p2.id]

    // Ocultar los 2 productos vía PATCH
    const patchRes  = await page.request.patch(`${BASE}/api/products/bulk-visibility`, {
      data: { product_ids: idsToHide, catalog_visibility: 'hidden' },
    })
    expect(patchRes.status()).toBe(200)
    const patchBody = await patchRes.json() as { ok: boolean; updated: number }
    expect(patchBody.ok).toBe(true)
    expect(patchBody.updated).toBe(2)

    // Los productos desaparecen del catálogo público
    const afterRes  = await page.request.get(`${BASE}/api/catalog/demo`)
    const afterBody = await afterRes.json() as { ok: boolean; products: Array<{ id: number }> }
    const afterIds  = afterBody.products.map(p => p.id)
    expect(afterIds).not.toContain(p1.id)
    expect(afterIds).not.toContain(p2.id)

    // Restaurar visibilidad
    await page.request.patch(`${BASE}/api/products/bulk-visibility`, {
      data: { product_ids: idsToHide, catalog_visibility: 'visible' },
    })
  })

  // ── CA04 ────────────────────────────────────────────────────────────────
  test('CA04 — link "Ver catálogo" apunta al slug correcto', async ({ page }) => {
    await page.goto(`${BASE}/catalogo-digital`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2_000)

    const link = page.getByRole('link', { name: /Ver catálogo/i })
    await expect(link).toBeVisible({ timeout: 6_000 })

    const href = await link.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).toContain('/catalogo/')
    expect(href).toContain('demo')

    const target = await link.getAttribute('target')
    expect(target).toBe('_blank')
  })

  // ── CA05 ────────────────────────────────────────────────────────────────
  test('CA05 — métricas se actualizan tras crear orden de catálogo', async ({ page }) => {
    const catalogRes  = await page.request.get(`${BASE}/api/catalog/demo`)
    const catalogBody = await catalogRes.json() as {
      ok: boolean
      products: Array<{ id: number; name: string; price_usd: number }>
    }
    expect(catalogBody.ok).toBe(true)
    const prod = catalogBody.products[0]

    const orderRes = await page.request.post(`${BASE}/api/orders`, {
      data: {
        client_name:  'Test CA05 CLI-D',
        origin:       'catalog',
        items: [{
          product_id:         prod.id,
          product_name:       prod.name,
          quantity:           1,
          price_per_unit_usd: prod.price_usd,
        }],
      },
    })
    expect(orderRes.status()).toBe(201)

    const metricsRes  = await page.request.get(`${BASE}/api/catalogo/metrics`)
    const metricsBody = await metricsRes.json() as {
      ok: boolean
      orders: { this_month: number; total: number }
    }
    expect(metricsBody.ok).toBe(true)
    expect(metricsBody.orders.total).toBeGreaterThan(0)
  })

})
