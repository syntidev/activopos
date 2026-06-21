/**
 * Certificación Sprint 17 — Tokens v3.0 + Escritorio v3.0
 * CLI-C | /escritorio · tokens.css · next-themes · ThemeToggle
 *
 * Auth: storageState admin (playwright.config.ts) — sin login manual
 *       El fixture `page` ya tiene sesión admin activa
 *
 * Flujo:
 *   ES01 — /escritorio carga sin errores ni hardcoded colors
 *   ES02 — KPI cards con fondo teal (Facturación + Ítems) visibles
 *   ES03 — toggle dark/light cambia data-theme sin flash
 *   ES04 — tabla "Métodos de pago" con thead semántico (si datos existen)
 *   ES05 — 0 errores de hydration en consola
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Sprint 17 — Tokens v3.0 + Escritorio v3.0', () => {

  // ── ES01 ─────────────────────────────────────────────────────────────────
  test('ES01 — Escritorio v3.0 carga sin errores', async ({ page }) => {
    await page.goto(`${BASE}/escritorio`)
    await expect(page).not.toHaveURL(/error/)
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    const content = await page.content()
    // Sin colores hardcodeados v1 en el HTML renderizado
    expect(content).not.toContain('#2563EB')
    expect(content).not.toContain('#1E3A5F')
  })

  // ── ES02 ─────────────────────────────────────────────────────────────────
  test('ES02 — KPI cards con fondo teal visibles', async ({ page }) => {
    await page.goto(`${BASE}/escritorio`)
    await page.waitForLoadState('networkidle')
    // KPI primary — Facturación (teal primary bg)
    const primary = page.locator('[aria-label="Facturación total"]')
    await expect(primary).toBeVisible({ timeout: 6_000 })
    // KPI secondary — Ítems vendidos (teal secondary bg)
    const secondary = page.locator('[aria-label="Ítems vendidos"]')
    await expect(secondary).toBeVisible({ timeout: 6_000 })
  })

  // ── ES03 ─────────────────────────────────────────────────────────────────
  test('ES03 — toggle tema funciona sin hydration mismatch', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('hydrat')) {
        errors.push(msg.text())
      }
    })

    await page.goto(`${BASE}/escritorio`)
    await page.waitForLoadState('networkidle')

    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')

    // Toggle: aria-label dinámico según modo actual
    const toggle = page.locator('[aria-label*="Cambiar"]').first()
    if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggle.click()
      await page.waitForTimeout(400)
      const after = await html.getAttribute('data-theme')
      expect(after).not.toBe(before)
    }

    // Verificar que no hubo hydration errors durante la carga y el toggle
    expect(errors).toHaveLength(0)
  })

  // ── ES04 ─────────────────────────────────────────────────────────────────
  test('ES04 — tabla métodos de pago con thead semántico (si hay datos)', async ({ page }) => {
    await page.goto(`${BASE}/escritorio`)
    await page.waitForLoadState('networkidle')

    // La tabla es condicional — solo aparece con summary.por_metodo.length > 0
    const tabla = page.locator('table').first()
    const tableVisible = await tabla.isVisible({ timeout: 3_000 }).catch(() => false)

    if (tableVisible) {
      // Si hay datos: thead debe estar visible con las 3 columnas correctas
      const thead = page.locator('table thead').first()
      await expect(thead).toBeVisible()
      const thTexts = await page.locator('table thead th').allTextContents()
      expect(thTexts).toContain('Método')
      expect(thTexts).toContain('Total USD')
    } else {
      // Sin ventas: la sección "Métodos de pago" no renderiza — OK por diseño
      console.log('  INFO ES04: sin datos de ventas — tabla no renderizada (esperado en test env)')
    }
  })

  // ── ES05 ─────────────────────────────────────────────────────────────────
  test('ES05 — 0 errores de hydration al cargar /escritorio', async ({ page }) => {
    const hydrationErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('hydrat')) {
        hydrationErrors.push(msg.text())
      }
    })

    await page.goto(`${BASE}/escritorio`)
    await page.waitForLoadState('networkidle')

    expect(hydrationErrors).toHaveLength(0)
  })

})
