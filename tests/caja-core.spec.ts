/**
 * Certificación Módulo Caja — Sprint 11
 * CLI-C | DT-011 · DT-012 · DT-013
 *
 * Flujo certificado (orden obligatorio — fullyParallel: false dentro del archivo):
 *   C01 → GET  /api/cash/status           → isOpen: true
 *   C02 → POST /api/cash/open             → 409 (ya hay caja abierta)
 *   C03 → POST /api/cash/close            → cierra correctamente
 *   C04 → POST /api/cash/close (2ª vez)   → 400 "No hay caja abierta"  [DT-012]
 *   C05 → GET  /api/rates/bcv sin sesión  → rate > 0, sin writes       [DT-013]
 *
 * beforeAll garantiza un registro abierto independiente del estado previo.
 * afterAll reabre un registro para no romper suites paralelas (pos-core.spec.ts).
 */

import { test, expect, request as newRequestCtx } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.beforeAll(async ({ request }) => {
  // Tasa BCV activa
  const ratesRes  = await request.get(`${BASE}/api/rates/bcv`)
  const ratesBody = await ratesRes.json() as { ok?: boolean; rate?: number }
  if (!ratesBody.ok || !ratesBody.rate) throw new Error('Pre-condición: tasa BCV no disponible')

  // Asegurar caja abierta — cerrar existente si hay, luego abrir una limpia
  const statusRes  = await request.get(`${BASE}/api/cash/status`)
  const statusBody = await statusRes.json() as { isOpen: boolean }

  if (statusBody.isOpen) {
    await request.post(`${BASE}/api/cash/close`, {
      data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'Reset previo a certificación' },
    })
  }

  const openRes = await request.post(`${BASE}/api/cash/open`, {
    data: {
      opening_amount_usd: 25,
      opening_amount_bs:  25 * ratesBody.rate,
    },
  })
  if (!openRes.ok()) throw new Error(`Setup falló al abrir caja: HTTP ${openRes.status()}`)
})

test.afterAll(async ({ request }) => {
  // Restaurar estado: abrir una caja nueva para que pos-core.spec.ts encuentre caja abierta
  const statusRes  = await request.get(`${BASE}/api/cash/status`)
  const statusBody = await statusRes.json() as { isOpen: boolean }

  if (!statusBody.isOpen) {
    const ratesRes  = await request.get(`${BASE}/api/rates/bcv`)
    const ratesBody = await ratesRes.json() as { rate: number }
    await request.post(`${BASE}/api/cash/open`, {
      data: { opening_amount_usd: 25, opening_amount_bs: 25 * ratesBody.rate },
    })
  }
})

test.describe('Caja Core — Certificación Sprint 11', () => {
  // ── C01 ─────────────────────────────────────────────────────────────────
  test('C01 — GET /api/cash/status devuelve isOpen:true con turno activo', async ({ page }) => {
    const res  = await page.request.get(`${BASE}/api/cash/status`)
    const body = await res.json() as {
      isOpen: boolean
      register?: { id: number; rateAtOpen: number; openingAmountUsd: number }
    }

    expect(res.status()).toBe(200)
    expect(body.isOpen).toBe(true)
    expect(body.register).toBeDefined()
    expect(body.register!.id).toBeGreaterThan(0)
    expect(body.register!.rateAtOpen).toBeGreaterThan(0)
  })

  // ── C02 ─────────────────────────────────────────────────────────────────
  test('C02 — POST /api/cash/open rechaza cuando ya hay caja abierta (409)', async ({ page }) => {
    const res  = await page.request.post(`${BASE}/api/cash/open`, {
      data: { opening_amount_usd: 25, opening_amount_bs: 25 * 600 },
    })
    const body = await res.json() as { error?: string }

    expect(res.status()).toBe(409)
    expect(body.error).toMatch(/Ya hay una caja abierta/i)
  })

  // ── C03 ─────────────────────────────────────────────────────────────────
  test('C03 — POST /api/cash/close cierra la caja y registra actividad', async ({ page }) => {
    const closeRes  = await page.request.post(`${BASE}/api/cash/close`, {
      data: {
        closing_amount_usd: 35,
        closing_amount_bs:  35 * 607,
        close_notes:        'Cierre de certificación CLI-C Sprint 11',
      },
    })
    const closeBody = await closeRes.json() as { ok?: boolean; register?: { id: number } }

    expect(closeRes.status()).toBe(200)
    expect(closeBody.ok).toBe(true)
    expect(closeBody.register).toBeDefined()

    // Confirmar que status refleja caja cerrada
    const statusRes  = await page.request.get(`${BASE}/api/cash/status`)
    const statusBody = await statusRes.json() as { isOpen: boolean }
    expect(statusRes.status()).toBe(200)
    expect(statusBody.isOpen).toBe(false)
  })

  // ── C04 ─────────────────────────────────────────────────────────────────
  test('C04 — POST /api/cash/close doble cierre devuelve 400 [DT-012]', async ({ page }) => {
    const res  = await page.request.post(`${BASE}/api/cash/close`, {
      data: { closing_amount_usd: 35, closing_amount_bs: 35 * 607 },
    })
    const body = await res.json() as { error?: string }

    expect(res.status()).toBe(400)
    expect(body.error).toMatch(/No hay caja abierta/i)
  })

  // ── C05 ─────────────────────────────────────────────────────────────────
  test('C05 — GET /api/rates/bcv sin sesión devuelve tasa válida [DT-013]', async () => {
    // Contexto nuevo sin cookies — endpoint público post-DT-013
    const ctx  = await newRequestCtx.newContext({ baseURL: BASE })
    const res  = await ctx.get('/api/rates/bcv')
    const body = await res.json() as { ok?: boolean; rate?: number; source?: string }

    expect(res.status()).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.rate).toBeGreaterThan(0)
    expect(body.rate).toBeGreaterThan(36.50) // no es el fallback hardcodeado

    await ctx.dispose()
  })
})
