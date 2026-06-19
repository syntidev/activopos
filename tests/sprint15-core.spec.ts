/**
 * Certificación Sprint 15 — Cotizaciones + Devoluciones + Usuarios
 * CLI-C | /cotizaciones · /devoluciones · /usuarios
 *       | /api/quotations · /api/returns · /api/users
 *
 * Auth: storageState admin (playwright.config.ts) — sin login manual
 *
 * Flujo:
 *   Q01 — Página cotizaciones carga sin errores (placeholder)
 *   Q02 — POST /api/quotations devuelve 201 con número QUO-
 *   R01 — Página devoluciones carga sin errores (placeholder)
 *   R02 — POST /api/returns con sale_id inexistente devuelve 404
 *   U01 — Página usuarios carga y muestra al admin en la lista
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Sprint 15 — Cotizaciones + Devoluciones + Usuarios', () => {

  // ── Q01 ─────────────────────────────────────────────────────────────────
  test('Q01 — página cotizaciones carga sin errores', async ({ page }) => {
    await page.goto(`${BASE}/cotizaciones`)
    await expect(page).not.toHaveURL(/login/)
    await expect(page).not.toHaveURL(/error/)
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    expect(content).not.toContain('>undefined<')
  })

  // ── Q02 ─────────────────────────────────────────────────────────────────
  test('Q02 — crear cotización via API devuelve número', async ({ page }) => {
    const response = await page.request.post(`${BASE}/api/quotations`, {
      data: {
        items: [{ name: 'Test Item CLI-C', qty: 1, price_usd: 10.00 }],
      },
    })
    expect(response.status()).toBe(201)
    const body = await response.json() as { ok: boolean; quotation: { number: string } }
    expect(body.ok).toBe(true)
    expect(body.quotation.number).toMatch(/QUO-\d{4}-\d{4}/)
  })

  // ── R01 ─────────────────────────────────────────────────────────────────
  test('R01 — página devoluciones carga sin errores', async ({ page }) => {
    await page.goto(`${BASE}/devoluciones`)
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').filter({ hasText: 'Devoluciones' }).first()).toBeVisible({ timeout: 6_000 })
  })

  // ── R02 ─────────────────────────────────────────────────────────────────
  test('R02 — devolución con venta inexistente devuelve 404', async ({ page }) => {
    const response = await page.request.post(`${BASE}/api/returns`, {
      data: {
        sale_id: 99999,
        reason:  'Test CLI-C',
        items:   [{ product_id: 1, qty: 1, price_usd: 1.00 }],
      },
    })
    expect(response.status()).toBe(404)
  })

  // ── U01 ─────────────────────────────────────────────────────────────────
  test('U01 — página usuarios carga y muestra al admin', async ({ page }) => {
    await page.goto(`${BASE}/usuarios`)
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').filter({ hasText: 'Usuarios' }).first()).toBeVisible({ timeout: 6_000 })
    const content = await page.content()
    expect(content.toLowerCase()).toContain('admin')
  })

})
