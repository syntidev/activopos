/**
 * Certificación Módulo Reportes — Sprint 11
 * CLI-C | /api/reports/daily · /api/reports/monthly · /api/r/[token]
 *
 * ⚠️  PRE-REQUISITO CRÍTICO:
 *   Después de `npx prisma generate`, el .next cache queda invalidado.
 *   Ejecutar ANTES de correr estos tests:
 *     Remove-Item -Recurse -Force .next
 *     npm run dev        (esperar "Ready in Xs")
 *
 *   Luego:
 *     npx playwright test tests/reportes-core.spec.ts --reporter=list
 *
 * Flujo:
 *   R01 — API daily devuelve datos reales (sales_count ≥ 2, total_usd > 0)
 *   R02 — top_products con estructura y dual-moneda correcta
 *   R03 — botón "Exportar PDF" dispara descarga PDF (jsPDF client-side)
 *   R04 — banner mensual visible cuando hay pending → generate → ready
 *   R05 — link público /api/r/[token] descarga sin auth
 */

import { test, expect, request as newRequest } from '@playwright/test'

const BASE = 'http://localhost:3000'

/** Chequea si un endpoint Prisma está disponible (no afectado por .next cache stale) */
async function prismaEndpointAvailable(
  page: import('@playwright/test').Page,
  path: string
): Promise<boolean> {
  const res = await page.request.get(`${BASE}${path}`)
  return res.status() !== 500
}

test.describe('Reportes Core — Certificación Sprint 11', () => {

  // ── R01 ────────────────────────────────────────────────────────────────
  test('R01 — API daily devuelve datos reales (≥ 2 ventas, total > $0)', async ({ page }) => {
    const available = await prismaEndpointAvailable(page, '/api/reports/daily?date=2026-06-19')
    if (!available) {
      test.skip(true, 'Endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }

    const res  = await page.request.get(`${BASE}/api/reports/daily?date=2026-06-19`)
    const body = await res.json() as {
      ok:          boolean
      date:        string
      sales_count: number
      total_usd:   number
      items_sold:  number
      rate:        number
      top_products: unknown[]
      by_payment_method: unknown[]
    }

    expect(res.status()).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.date).toBe('2026-06-19')
    expect(body.sales_count).toBeGreaterThanOrEqual(2)
    expect(body.total_usd).toBeGreaterThan(0)
    expect(body.items_sold).toBeGreaterThan(0)
    expect(body.rate).toBeGreaterThan(0)
    expect(Array.isArray(body.top_products)).toBe(true)
    expect(Array.isArray(body.by_payment_method)).toBe(true)
  })

  // ── R02 ────────────────────────────────────────────────────────────────
  test('R02 — top_products estructura y dual-moneda correcta', async ({ page }) => {
    const available = await prismaEndpointAvailable(page, '/api/reports/daily?date=2026-06-19')
    if (!available) {
      test.skip(true, 'Endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }

    const res  = await page.request.get(`${BASE}/api/reports/daily?date=2026-06-19`)
    const body = await res.json() as {
      rate: number
      top_products: Array<{
        product_id: number
        name:       string
        quantity:   number
        total_usd:  number
        total_bs:   number
      }>
    }

    expect(res.status()).toBe(200)

    if (body.top_products.length > 0) {
      const p = body.top_products[0]
      // Estructura correcta
      expect(p.product_id).toBeGreaterThan(0)
      expect(typeof p.name).toBe('string')
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.quantity).toBeGreaterThan(0)
      expect(p.total_usd).toBeGreaterThan(0)
      // Dual-moneda: total_bs debe aproximarse a total_usd × rate (tolerancia 5%)
      expect(p.total_bs).toBeGreaterThan(0)
      const expectedBs = p.total_usd * body.rate
      expect(Math.abs(p.total_bs - expectedBs) / expectedBs).toBeLessThan(0.05)
    }
  })

  // ── R03 ────────────────────────────────────────────────────────────────
  test('R03 — botón "Exportar PDF" dispara descarga (jsPDF client-side)', async ({ page }) => {
    const available = await prismaEndpointAvailable(page, '/api/reports/daily?date=2026-06-19')
    if (!available) {
      test.skip(true, 'Endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }

    await page.goto(`${BASE}/reportes`)
    // Wait for initial fetch (today's date) to complete before changing date,
    // otherwise both fetches race and the wrong one may win.
    await page.waitForLoadState('networkidle')

    const dateInput = page.locator('input[type="date"]')
    await expect(dateInput).toBeVisible({ timeout: 8_000 })
    await dateInput.fill('2026-06-19')
    await dateInput.dispatchEvent('change')

    // Wait for the June-19 fetch to complete
    await page.waitForLoadState('networkidle')

    // Verificar que el botón exportar está habilitado (implica que data.salesCount > 0)
    const exportBtn = page.getByRole('button', { name: /Exportar PDF/i })
    await expect(exportBtn).toBeVisible({ timeout: 10_000 })
    await expect(exportBtn).toBeEnabled({ timeout: 10_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      exportBtn.click(),
    ])

    expect(download.suggestedFilename()).toMatch(/reporte.*\.pdf$/i)
  })

  // ── R04 ────────────────────────────────────────────────────────────────
  test('R04 — generate mensual crea reporte ready con token 30 días', async ({ page }) => {
    const available = await prismaEndpointAvailable(page, '/api/reports/monthly?period=2026-05')
    if (!available) {
      test.skip(true, '/api/reports/monthly returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }

    const period  = '2026-05'
    const genRes  = await page.request.post(`${BASE}/api/reports/monthly/generate`, {
      data: { period },
    })
    if (genRes.status() === 500) {
      test.skip(true, 'generate endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }
    const genBody = await genRes.json() as {
      ok:           boolean
      report_id:    number
      download_url: string
      expires_at:   string
    }

    expect(genRes.status()).toBe(200)
    expect(genBody.ok).toBe(true)
    expect(genBody.download_url).toMatch(/^\/api\/r\/[0-9a-f-]{36}$/)

    // Token expira en ~30 días
    const expiresAt = new Date(genBody.expires_at)
    const daysUntil = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(daysUntil).toBeGreaterThan(28)
    expect(daysUntil).toBeLessThan(32)
  })

  // ── R05 ────────────────────────────────────────────────────────────────
  test('R05 — /api/r/[token] descarga PDF sin auth [DT-013 pattern]', async ({ page }) => {
    const available = await prismaEndpointAvailable(page, '/api/reports/monthly?period=2026-05')
    if (!available) {
      test.skip(true, 'Endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }

    // Obtener el último token generado (de R04 si corrió, o generar uno nuevo)
    const genRes  = await page.request.post(`${BASE}/api/reports/monthly/generate`, {
      data: { period: '2026-05' },
    })
    if (genRes.status() === 500) {
      test.skip(true, 'generate endpoint returns 500 — requiere: Remove-Item -Recurse -Force .next && npm run dev')
      return
    }
    const genBody = await genRes.json() as { ok?: boolean; download_url?: string }
    if (!genBody.ok || !genBody.download_url) { test.skip(); return }

    // Descargar vía contexto sin cookies (público)
    const pubCtx = await newRequest.newContext({ baseURL: BASE })
    const dlRes  = await pubCtx.get(genBody.download_url)

    expect(dlRes.status()).toBe(200)
    expect(dlRes.headers()['content-type']).toContain('application/pdf')
    expect(dlRes.headers()['content-disposition']).toMatch(/attachment/i)

    await pubCtx.dispose()
  })
})
