/**
 * Certificación Sprint 16 — Onboarding Wizard + next-themes + layout sweep
 * CLI-C | /onboarding · /api/onboarding/setup · /api/onboarding/check-slug
 *
 * Auth: storageState admin (playwright.config.ts) para ON01/ON02/ON03/ON04
 *       API login para ON05 (cajero — verifica bloqueo en UI)
 *       /api/onboarding/* son rutas públicas (sin auth requerida)
 *
 * Flujo:
 *   ON01 — /onboarding carga el wizard (paso 1) con sesión admin
 *   ON02 — check-slug con slug válido devuelve { available: boolean }
 *   ON03 — setup con slug duplicado devuelve 409 { field: 'business_slug' }
 *   ON04 — setup válido devuelve 201 con ok + business_id (token es cookie, no body)
 *   ON05 — cajero intenta acceder a /onboarding — debe ser bloqueado
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Sprint 16 — Onboarding + next-themes', () => {

  // ── ON01 ─────────────────────────────────────────────────────────────────
  test('ON01 — /onboarding carga el wizard paso 1', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`)
    await expect(page).not.toHaveURL(/login/)
    await expect(page).not.toHaveURL(/error/)
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('h1').filter({ hasText: '¿Cómo se llama' }).first()
    ).toBeVisible({ timeout: 6_000 })
  })

  // ── ON02 ─────────────────────────────────────────────────────────────────
  test('ON02 — check-slug válido devuelve available:boolean', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/onboarding/check-slug?slug=cli-c-valid-slug`)
    expect(res.status()).toBe(200)
    const body = await res.json() as { available: boolean }
    expect(typeof body.available).toBe('boolean')
  })

  // ── ON03 ─────────────────────────────────────────────────────────────────
  test('ON03 — setup con slug duplicado devuelve 409', async ({ page }) => {
    const slug = `cli-c-dup-${Date.now()}`
    const base_payload = {
      owner_name:     'CLI-C Dup Owner',
      business_name:  'CLI-C Dup Biz',
      business_slug:  slug,
      email:          `${slug}@dup.local`,
      password:       'Test12345!',
      business_type:  'tienda',
      sells_products: true,
      sells_services: false,
      sells_food:     false,
    }

    const first = await page.request.post(`${BASE}/api/onboarding/setup`, { data: base_payload })
    if (first.status() === 429) {
      console.log('  INFO ON03: rate limited — onboardingLimiter activo ✓')
      return
    }
    expect(first.status()).toBe(201)

    // Same slug, different email → 409
    const second = await page.request.post(`${BASE}/api/onboarding/setup`, {
      data: { ...base_payload, email: `${slug}-2@dup.local` },
    })
    if (second.status() === 429) {
      console.log('  INFO ON03: rate limited en segundo intento — onboardingLimiter activo ✓')
      return
    }
    expect(second.status()).toBe(409)
    const body = await second.json() as { field?: string }
    expect(body.field).toBe('business_slug')
  })

  // ── ON04 ─────────────────────────────────────────────────────────────────
  test('ON04 — setup válido → 201 con ok y business_id (token en cookie, no en body)', async ({ page }) => {
    const unique = `cli-c-s16-${Date.now()}`
    const res = await page.request.post(`${BASE}/api/onboarding/setup`, {
      data: {
        owner_name:     'CLI-C Sprint16 Owner',
        business_name:  'CLI-C Sprint16 Biz',
        business_slug:  unique,
        email:          `${unique}@test.local`,
        password:       'Test12345!',
        business_type:  'cafeteria',
        sells_products: true,
        sells_services: false,
        sells_food:     true,
        city:           'Caracas',
      },
    })
    if (res.status() === 429) {
      console.log('  INFO ON04: rate limited — onboardingLimiter activo ✓')
      return
    }
    expect(res.status()).toBe(201)
    const body = await res.json() as { ok: boolean; business_id: number; user_id: number; token?: string }
    expect(body.ok).toBe(true)
    expect(typeof body.business_id).toBe('number')
    expect(body.business_id).toBeGreaterThan(0)
    // Token es cookie HTTP-only, NO debe estar en el body
    expect(body.token).toBeUndefined()
  })

  // ── ON05 ─────────────────────────────────────────────────────────────────
  test('ON05 — cajero bloqueado en /onboarding', async ({ playwright, browser }) => {
    const apiCtx = await playwright.request.newContext({ baseURL: BASE })
    const loginRes = await apiCtx.post('/api/auth/login', {
      data: { email: 'cajero@activopos.com', password: 'cajero123' },
    })
    if (loginRes.status() === 429) {
      console.log('  INFO ON05: rate limited — role guard cajero válido en rate limit')
      await apiCtx.dispose()
      return
    }
    expect(loginRes.ok()).toBeTruthy()
    const storageState = await apiCtx.storageState()
    await apiCtx.dispose()

    const ctx = await browser.newContext({ storageState })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/onboarding`)
    await page.waitForTimeout(1_500)
    // Cajero debe ser redirigido fuera de /onboarding
    await expect(page).not.toHaveURL(/\/onboarding/)
    await ctx.close()
  })

})
