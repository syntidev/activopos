/**
 * Certificación Módulo Analytics — Sprint 14
 * CLI-C | /analytics · /api/analytics/summary · /api/analytics/top-products · /api/analytics/trends
 *
 * Auth: AN01-AN04 usan storageState admin (playwright.config.ts)
 *       AN05 usa contexto fresco con login de cajero (patrón F05)
 *
 * Flujo:
 *   AN01 — Página carga sin errores (admin)
 *   AN02 — Sin NaN ni Infinity en el contenido renderizado
 *   AN03 — Selector de período actualiza sin crash
 *   AN04 — LineChart (Recharts SVG) presente en el DOM
 *   AN05 — Cashier no puede acceder a /analytics (redirigido por middleware)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Analytics — Certificación Sprint 14', () => {

  // ── AN01 ────────────────────────────────────────────────────────────────
  test('AN01 — página carga sin errores', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await expect(page).not.toHaveURL(/login/)
    await expect(page).not.toHaveURL(/error/)
    await page.waitForLoadState('networkidle')
    // La página debe mostrar el título del módulo
    await expect(page.locator('h1').filter({ hasText: 'Pulso del Negocio' })).toBeVisible({ timeout: 8_000 })
  })

  // ── AN02 ────────────────────────────────────────────────────────────────
  test('AN02 — sin NaN ni Infinity en el contenido renderizado', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await page.waitForLoadState('networkidle')
    // Esperar que carguen los datos
    await expect(page.locator('h1').filter({ hasText: 'Pulso del Negocio' })).toBeVisible({ timeout: 8_000 })
    const content = await page.content()
    expect(content).not.toContain('Infinity')
    expect(content).not.toContain('>NaN<')
  })

  // ── AN03 ────────────────────────────────────────────────────────────────
  test('AN03 — selector período actualiza sin crash', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').filter({ hasText: 'Pulso del Negocio' })).toBeVisible({ timeout: 8_000 })

    // Buscar botones de período (Semana, Mes, Trimestre)
    const btns = page.locator('button[role="tab"]')
    const count = await btns.count()
    if (count > 0) {
      await btns.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).not.toHaveURL(/error/)
      // La página sigue mostrando el título — sin crash
      await expect(page.locator('h1').filter({ hasText: 'Pulso del Negocio' })).toBeVisible({ timeout: 8_000 })
    }
  })

  // ── AN04 ────────────────────────────────────────────────────────────────
  test('AN04 — LineChart presente en el DOM', async ({ page }) => {
    await page.goto(`${BASE}/analytics`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').filter({ hasText: 'Pulso del Negocio' })).toBeVisible({ timeout: 8_000 })
    // Recharts genera un svg con wrapper o surface
    const chart = page.locator('.recharts-wrapper, svg.recharts-surface').first()
    await expect(chart).toBeVisible({ timeout: 8_000 })
  })

  // ── AN05 ────────────────────────────────────────────────────────────────
  test('AN05 — cashier no accede a analytics', async ({ browser }) => {
    // Contexto sin auth state (sesión limpia)
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()

    // Login como cajero
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    await page.locator('input[type="email"]').fill('cajero@activopos.com')
    await page.locator('input[type="password"]').fill('cajero123')
    await page.locator('button[type="submit"]').click()

    // Esperar redirección post-login
    await page.waitForURL(/\/(pos|escritorio)/, { timeout: 10_000 })

    // Intentar acceder a /analytics
    await page.goto(`${BASE}/analytics`)
    await page.waitForTimeout(2_000)

    // No debe estar en /analytics (redirigido por middleware o bloqueado)
    await expect(page).not.toHaveURL(/^http:\/\/localhost:3000\/analytics$/)

    await ctx.close()
  })

})
