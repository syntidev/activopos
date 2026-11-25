import path from 'path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, businessId, ensureBusiness, login, sql } from './helpers/restaurante-kds'

/**
 * Restaurante R1.1 — activación asistida (Configuración › Módulos), pestaña Restaurante y grupo del menú.
 * Solo activopos_kds. D = flag apagado; B = flag encendido; C = flag apagado (testigos de aislamiento).
 * E = negocio aparte para las pruebas de API en ráfaga: el límite de 10 cambios/min es por negocio y D lo agotaría.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const SHOTS = path.join(CAPTURAS, 'r1-1')
let B = 0, C = 0, D = 0, E = 0

const flag = (id: number): string => sql(`SELECT restaurante_enabled FROM businesses WHERE id=${id}`)
const modules = (id: number): string => sql(`SELECT modules_enabled FROM businesses WHERE id=${id}`)
const toggleLogs = (id: number): number => Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${id} AND action='restaurante_toggle'`))
const post = (page: Page, data: Record<string, unknown>) => page.request.post(`${BASE}/api/restaurante/activacion`, { data })
const status = async (page: Page, url: string): Promise<number> => (await page.request.get(`${BASE}${url}`)).status()

test.beforeAll(() => {
  B = ensureBusiness('zzkds-b', true)
  C = ensureBusiness('zzkds-c', false)
  D = ensureBusiness('zzkds-d', false)
  E = ensureBusiness('zzkds-e', false)
})

test('1 · el cajero no puede activar (403) y el cuerpo inválido da 400', async ({ page, context }) => {
  await login(context, D, 'cashier')
  expect((await post(page, { enabled: true })).status()).toBe(403)
  expect(flag(D)).toBe('0')

  await login(context, D, 'admin')
  expect((await post(page, { enabled: 'si' })).status()).toBe(400)
  expect((await post(page, {})).status()).toBe(400)
  expect(flag(D)).toBe('0')
})

test('2 · el admin activa y aparece el módulo; al desactivar vuelven los 404 y queda registro', async ({ page, context }) => {
  await login(context, D, 'admin')
  expect(await status(page, '/restaurante/mesas')).toBe(404)
  expect(await status(page, '/api/restaurante/mesas')).toBe(404)

  const on = await post(page, { enabled: true })
  expect(on.status()).toBe(200)
  expect(((await on.json()) as { changed: boolean }).changed).toBe(true)
  expect(flag(D)).toBe('1')
  expect(await status(page, '/restaurante/mesas')).toBe(200)
  expect(await status(page, '/api/restaurante/mesas')).toBe(200)
  expect(toggleLogs(D)).toBe(1)
  expect(sql(`SELECT JSON_EXTRACT(old_values,'$.restaurante_enabled'), JSON_EXTRACT(new_values,'$.restaurante_enabled') FROM activity_logs WHERE business_id=${D} AND action='restaurante_toggle' ORDER BY id DESC LIMIT 1`)).toBe('false\ttrue')

  // Repetir no cambia nada ni duplica el registro.
  expect(((await (await post(page, { enabled: true })).json()) as { changed: boolean }).changed).toBe(false)
  expect(toggleLogs(D)).toBe(1)

  expect((await post(page, { enabled: false })).status()).toBe(200)
  expect(flag(D)).toBe('0')
  expect(await status(page, '/restaurante/mesas')).toBe(404)
  expect(await status(page, '/api/restaurante/mesas')).toBe(404)
  expect(await status(page, '/configuracion/restaurante')).toBe(404)
  expect(toggleLogs(D)).toBe(2)
})

test('3 · activar con KDS marca el módulo kds; sin la casilla no lo toca', async ({ page, context }) => {
  await login(context, E, 'admin')
  expect(modules(E)).not.toContain('kds')
  expect((await post(page, { enabled: true })).status()).toBe(200)
  expect(modules(E)).not.toContain('kds')
  expect((await post(page, { enabled: false })).status()).toBe(200)

  const res = await post(page, { enabled: true, enable_kds: true })
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { modules_enabled: string[] }).modules_enabled).toContain('kds')
  expect(modules(E).split(',')).toContain('kds')
  expect((await post(page, { enabled: false })).status()).toBe(200)
  // Desactivar el restaurante no apaga el KDS: son módulos independientes.
  expect(modules(E).split(',')).toContain('kds')
})

test('4 · la suscripción suspendida o vencida bloquea la activación con motivo (gate de plan)', async ({ page, context }) => {
  await login(context, E, 'admin')
  sql(`UPDATE businesses SET subscription_active=0 WHERE id=${E}`)
  const res = await post(page, { enabled: true })
  expect(res.status()).toBe(403)
  const body = (await res.json()) as { code: string; error: string }
  expect(body.code).toBe('PLAN_LIMIT')
  expect(body.error).toContain('suspendida')
  expect(flag(E)).toBe('0')

  sql(`UPDATE businesses SET subscription_active=1, subscription_expires_at='2020-01-01 00:00:00' WHERE id=${E}`)
  expect((await post(page, { enabled: true })).status()).toBe(403)
  sql(`UPDATE businesses SET subscription_expires_at=NULL WHERE id=${E}`)
  expect(flag(E)).toBe('0')
})

test('5 · los otros negocios no se ven afectados', async () => {
  expect(flag(B)).toBe('1')
  expect(flag(C)).toBe('0')
  expect(toggleLogs(B)).toBe(0)
  expect(toggleLogs(C)).toBe(0)
})

for (const vp of [{ w: 1280, h: 800 }, { w: 375, h: 812 }]) {
  test(`6 · flujo en pantalla a ${vp.w}px: tarjeta, confirmación, pestaña, menú y desactivar`, async ({ page, context }) => {
    ensureBusiness('zzkds-d', false)
    const wide = vp.w >= 1024
    await login(context, D, 'admin')
    await page.setViewportSize({ width: vp.w, height: vp.h })

    // En móvil la Configuración alterna entre menú y contenido.
    const toMenu = async (): Promise<void> => {
      const back = page.getByTestId('config-volver')
      if (await back.isVisible()) await back.click()
    }
    const noOverflow = async (): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

    await page.goto('/configuracion')
    await page.locator('[data-tab="modulos"]').click()
    await expect(page.locator('[data-tab="restaurante"]')).toHaveCount(0)
    const activar = page.getByRole('button', { name: 'Activar Restaurante', pressed: false })
    await activar.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(SHOTS, `modulos-tarjeta-${vp.w}.png`), fullPage: true })
    expect(await noOverflow()).toBe(true)

    await activar.click()
    const dialog = page.getByRole('dialog', { name: 'Activar Restaurante' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Roles de mesonero y cocinero')).toBeVisible()
    await dialog.getByLabel('Activar también Cocina (KDS)').check()
    await expect(dialog).toHaveCSS('opacity', '1')
    await page.screenshot({ path: path.join(SHOTS, `modal-activar-${vp.w}.png`) })
    await dialog.getByRole('button', { name: 'Activar Restaurante' }).click()

    await expect.poll(() => flag(D), { timeout: 20_000 }).toBe('1')
    expect(modules(D).split(',')).toContain('kds')
    await toMenu()
    await expect(page.locator('[data-tab="restaurante"]')).toBeVisible({ timeout: 15_000 })
    if (wide) {
      await expect(page.getByRole('link', { name: 'Plano' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Configurar' })).toHaveAttribute('href', '/configuracion?tab=restaurante')
      await page.getByRole('link', { name: 'Plano' }).scrollIntoViewIfNeeded() // el grupo queda bajo el pliegue del menú
      await page.screenshot({ path: path.join(SHOTS, `menu-grupo-restaurante-${vp.w}.png`) })
    }

    await page.locator('[data-tab="restaurante"]').click()
    await expect(page.getByRole('heading', { name: 'Salón: áreas, mesas y plano' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Modificadores/ })).toBeEnabled() // R2: ya existe la sección
    await expect(page.getByRole('button', { name: /^Estaciones y ruteo/ })).toBeDisabled()
    expect(await noOverflow()).toBe(true)
    await page.screenshot({ path: path.join(SHOTS, `config-restaurante-${vp.w}.png`), fullPage: true })

    // Con el módulo activo, el plano abre y el 404 desaparece.
    expect(await status(page, '/restaurante/mesas')).toBe(200)

    await toMenu()
    await page.locator('[data-tab="modulos"]').click()
    const desactivar = page.getByRole('button', { name: 'Desactivar Restaurante', pressed: true })
    await desactivar.scrollIntoViewIfNeeded()
    await desactivar.click()
    const off = page.getByRole('dialog', { name: 'Desactivar Restaurante' })
    await expect(off.getByText('No se borra ningún dato')).toBeVisible()
    await expect(off).toHaveCSS('opacity', '1')
    await page.screenshot({ path: path.join(SHOTS, `modal-desactivar-${vp.w}.png`) })
    await off.getByRole('button', { name: 'Desactivar Restaurante' }).click()

    await expect.poll(() => flag(D), { timeout: 20_000 }).toBe('0')
    await toMenu()
    await expect(page.locator('[data-tab="restaurante"]')).toHaveCount(0)
    if (wide) await expect(page.getByRole('link', { name: 'Plano' })).toHaveCount(0)
    expect(await status(page, '/restaurante/mesas')).toBe(404)
    expect(await status(page, '/api/restaurante/mesas')).toBe(404)
    expect(toggleLogs(D)).toBeGreaterThanOrEqual(2)
    expect(flag(B)).toBe('1')
    expect(flag(C)).toBe('0')
  })
}

test('7 · menú: el admin ve Plano y Configurar; el mesonero solo Plano y ni Configuración', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const menu = page.getByRole('navigation', { name: 'Menú principal' })
  await login(context, B, 'admin')
  await page.goto('/restaurante/mesas')
  await expect(menu.getByRole('link', { name: 'Plano' })).toBeVisible()
  const configurar = menu.getByRole('link', { name: 'Configurar' })
  await expect(configurar).toBeVisible()
  await configurar.click()
  await expect(page).toHaveURL(/\/configuracion\?tab=restaurante/)
  await expect(page.getByRole('heading', { name: 'Salón: áreas, mesas y plano' })).toBeVisible()

  await login(context, B, 'waiter')
  await page.goto('/restaurante/mesas')
  // El mesonero usará su propio shell mínimo (MeseroShell, R2). Mientras tanto el menú general no le muestra el grupo
  // (la lista blanca no le deja leer el flag) y, en todo caso, jamás Configurar ni Configuración.
  await expect(menu.getByRole('link', { name: 'Configurar' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Configuración' })).toHaveCount(0)
  const cfg = await page.request.get(`${BASE}/configuracion`, { maxRedirects: 0 })
  expect(cfg.status()).toBe(307)
  expect(cfg.headers().location).toContain('/restaurante/mesas')
  expect(await status(page, '/api/restaurante/mesas')).toBe(200)
  expect((await post(page, { enabled: false })).status()).toBe(403)
  expect(flag(B)).toBe('1')
})

test('8 · negocio sin flag: sin grupo del módulo en el menú', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(context, C, 'admin')
  await page.goto('/escritorio')
  await expect(page.getByRole('link', { name: 'Plano' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Configurar' })).toHaveCount(0)
  expect(await status(page, '/restaurante/mesas')).toBe(404)
  expect(businessId('zzkds-c')).toBe(C)
})
