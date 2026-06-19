/**
 * Certificación DT-023 — Expense Categories
 * CLI-D | /api/finanzas/categorias · /api/finanzas/gastos
 *
 * Pre-condición: seed corrido — 6 categorías de sistema en business_id=1
 *
 * Flujo:
 *   EX01 — GET /api/finanzas/categorias devuelve ≥ 6 categorías activas
 *   EX02 — POST con nombre duplicado devuelve 409
 *   EX03 — POST /api/finanzas/gastos con expense_category_id válido → gasto asignado
 *   EX04 — PATCH /id desactiva categoría → no aparece en GET activas
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('DT-023 — Expense Categories', () => {

  // ── EX01 ────────────────────────────────────────────────────────────────
  test('EX01 — GET categorías devuelve ≥ 6 activas', async ({ page }) => {
    const res  = await page.request.get(`${BASE}/api/finanzas/categorias`)
    const body = await res.json() as {
      ok: boolean
      categories: Array<{ id: number; name: string; color: string | null; is_system: boolean; active: boolean }>
    }

    expect(res.status()).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.categories.length).toBeGreaterThanOrEqual(6)

    // All returned categories are active
    expect(body.categories.every(c => c.active)).toBe(true)

    // System categories present
    const names = body.categories.map(c => c.name)
    expect(names).toContain('Alquiler')
    expect(names).toContain('Otros')
  })

  // ── EX02 ────────────────────────────────────────────────────────────────
  test('EX02 — POST con nombre duplicado devuelve 409', async ({ page }) => {
    // First creation succeeds
    const unique = `Test-EX02-${Date.now()}`
    const res1 = await page.request.post(`${BASE}/api/finanzas/categorias`, {
      data: { name: unique, color: '#123456' },
    })
    expect(res1.status()).toBe(201)

    // Duplicate → 409
    const res2 = await page.request.post(`${BASE}/api/finanzas/categorias`, {
      data: { name: unique },
    })
    expect(res2.status()).toBe(409)
    const body2 = await res2.json() as { error: string }
    expect(body2.error).toMatch(/ya existe/i)
  })

  // ── EX03 ────────────────────────────────────────────────────────────────
  test('EX03 — gasto con expense_category_id válido queda asignado', async ({ page }) => {
    // Fetch a valid category id
    const catRes  = await page.request.get(`${BASE}/api/finanzas/categorias`)
    const catBody = await catRes.json() as { categories: Array<{ id: number }> }
    const categoryId = catBody.categories[0].id

    // Create gasto with that category
    const concepto = `Gasto EX03 ${Date.now()}`
    const res = await page.request.post(`${BASE}/api/finanzas/gastos`, {
      data: {
        concepto,
        amount_usd:          20.00,
        date:                '2026-06-19',
        expense_category_id: categoryId,
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json() as {
      ok: boolean
      gasto: { expense_category_id: number | null }
    }
    expect(body.ok).toBe(true)
    expect(body.gasto.expense_category_id).toBe(categoryId)
  })

  // ── EX04 ────────────────────────────────────────────────────────────────
  test('EX04 — PATCH desactiva categoría → desaparece de GET activas', async ({ page }) => {
    // Create a deactivatable category
    const catName = `Deactivate-${Date.now()}`
    const createRes  = await page.request.post(`${BASE}/api/finanzas/categorias`, {
      data: { name: catName },
    })
    expect(createRes.status()).toBe(201)
    const createBody = await createRes.json() as { category: { id: number } }
    const id = createBody.category.id

    // Deactivate it
    const patchRes = await page.request.patch(`${BASE}/api/finanzas/categorias/${id}`, {
      data: { active: false },
    })
    expect(patchRes.status()).toBe(200)

    // Should no longer appear in active list
    const listRes  = await page.request.get(`${BASE}/api/finanzas/categorias`)
    const listBody = await listRes.json() as { categories: Array<{ id: number }> }
    const ids = listBody.categories.map(c => c.id)
    expect(ids).not.toContain(id)
  })

})
