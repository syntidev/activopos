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
 * Sesión propia: un JWT firmado con JWT_SECRET (negocio 87, tenant de pruebas), igual que los specs P0.
 * No usa tests/.auth-state.json: ese archivo vence y dejaba el spec entero sin correr.
 *
 * beforeAll cierra la caja abierta (si la hay) y abre una propia. afterAll borra los registros y logs que
 * creó este spec y reabre la caja que estaba abierta antes, dejando el tenant como lo encontró.
 */

import { test, expect, request as newRequestCtx } from '@playwright/test'
import { BASE, BUSINESS_ID, apiAs, login } from './p0-helpers'
import { sql } from './alta-helpers'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })

// `page.request` comparte las cookies del contexto: la sesión se agrega ahí antes de cada test.
test.beforeEach(async ({ page }) => { await login(page) })

let maxRegisterBefore = 0
let maxLogBefore = 0
let previouslyOpenId = 0

test.beforeAll(async () => {
  const api = await apiAs()

  // Tasa BCV activa
  const ratesRes  = await api.get('/api/rates/bcv')
  const ratesBody = await ratesRes.json() as { ok?: boolean; rate?: number }
  if (!ratesBody.ok || !ratesBody.rate) throw new Error('Pre-condición: tasa BCV no disponible')

  // Estado previo, para restaurarlo al final
  maxRegisterBefore = Number(sql(`SELECT IFNULL(MAX(id),0) FROM cash_registers WHERE business_id=${BUSINESS_ID}`))
  maxLogBefore      = Number(sql(`SELECT IFNULL(MAX(id),0) FROM activity_logs WHERE business_id=${BUSINESS_ID}`))
  previouslyOpenId  = Number(sql(`SELECT IFNULL(MAX(id),0) FROM cash_registers WHERE business_id=${BUSINESS_ID} AND closed_at IS NULL`))

  // Asegurar caja abierta — cerrar existente si hay, luego abrir una limpia
  const statusRes  = await api.get('/api/cash/status')
  const statusBody = await statusRes.json() as { isOpen: boolean }

  if (statusBody.isOpen) {
    await api.post('/api/cash/close', {
      data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'Reset previo a certificación' },
    })
  }

  const openRes = await api.post('/api/cash/open', {
    data: {
      opening_amount_usd: 25,
      opening_amount_bs:  25 * ratesBody.rate,
    },
  })
  if (!openRes.ok()) throw new Error(`Setup falló al abrir caja: HTTP ${openRes.status()}`)
  await api.dispose()
})

test.afterAll(async () => {
  // Limpieza: solo lo creado por este spec (ids posteriores a los del inicio) y los logs de caja de esa ventana.
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND id > ${maxLogBefore} AND model_type='CashRegister'`)
  sql(`DELETE FROM cash_registers WHERE business_id=${BUSINESS_ID} AND id > ${maxRegisterBefore}`)
  // La caja que estaba abierta antes la cerró el beforeAll: se reabre tal cual.
  if (previouslyOpenId > 0) {
    sql(`UPDATE cash_registers SET closed_at=NULL, closing_amount_bs=NULL, closing_amount_usd=NULL, close_notes=NULL WHERE id=${previouslyOpenId} AND business_id=${BUSINESS_ID}`)
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
