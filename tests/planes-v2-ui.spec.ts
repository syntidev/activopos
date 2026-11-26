import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import fs from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Planes v2 UI: el admin gestiona el add-on KDS DENTRO del formulario de plan (un solo botón Guardar, sin guardados automáticos,
 * rehidratado desde el servidor, con confirmación y conteo si hay pedidos abiertos en cocina) y el switch del tenant en
 * Configuración › Módulos (KDS y Restaurante) se bloquea con candado y mensaje de mejora según los derechos.
 * Negocio propio 217 ("ZZ B Pruebas", carpeta B): plan, suscripción, add-ons y módulos se RESPALDAN y RESTAURAN; los pedidos de
 * cocina que crea llevan prefijo ZZB Planes y se borran. Capturas en .doc/planes-v2/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const USER = 162
const OUT = path.join(__dirname, '..', '.doc', 'planes-v2')
const P = 'ZZB Planes'
const VIEWPORTS = [{ n: '1280', w: 1280, h: 900 }, { n: '375', w: 375, h: 812 }]
const CAMPOS = ['catalog_plan', 'subscription_active', 'subscription_expires_at', 'addons', 'modules_enabled', 'catalog_active'] as const

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let respaldo: Record<string, string> = {}

const addonsDb = (): string => sql(`SELECT addons FROM businesses WHERE id=${BIZ}`)
const planDb = (): string => sql(`SELECT catalog_plan FROM businesses WHERE id=${BIZ}`)
const abiertasKds = (): string => sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BIZ} AND send_to_kds=1 AND status IN ('received','preparing','ready') AND client_name LIKE '${P} %'`)

function limpiar(): void {
  sql(`DELETE FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`)
}

function sembrarPedidosKds(n: number): void {
  limpiar()
  for (let i = 1; i <= n; i++) {
    sql(`INSERT INTO orders (business_id, order_number, status, origin, client_name, delivery_fee, total_usd, total_bs, rate_used, price_mode, send_to_kds, updated_at)
         VALUES (${BIZ}, 'ZZB-K0${i}', 'received', 'pos', '${P} Cocina ${i}', 0, 10, 900, 90, 'bcv', 1, NOW(3))`)
  }
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  for (const c of CAMPOS) respaldo[c] = sql(`SELECT QUOTE(${c}) FROM businesses WHERE id=${BIZ}`)
  // Punto de partida: nivel Entrada, suscripción vigente, sin add-ons y sin KDS ni Restaurante en las preferencias.
  sql(`UPDATE businesses SET catalog_plan='negocio_activo', subscription_active=1, subscription_expires_at=NULL, addons='', catalog_active=1 WHERE id=${BIZ}`)
  sembrarPedidosKds(2)
})

test.afterAll(() => {
  limpiar()
  sql(`UPDATE businesses SET ${CAMPOS.map(c => `${c}=${respaldo[c]}`).join(', ')} WHERE id=${BIZ}`)
  for (const c of CAMPOS) expect(sql(`SELECT QUOTE(${c}) FROM businesses WHERE id=${BIZ}`), c).toBe(respaldo[c])
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`)).toBe('0')
})

async function sesion(page: Page, role: 'super_admin' | 'admin'): Promise<void> {
  const token = await new SignJWT({ userId: USER, businessId: BIZ, role, name: 'ZZB Planes' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const formulario = (page: Page) => page.locator('[class*="planStatusForm"]')

async function abrirAdmin(page: Page): Promise<void> {
  await sesion(page, 'super_admin')
  await page.goto(`/businesses/${BIZ}`)
  await expect(page.getByTestId('ps-addon-kds')).toBeVisible({ timeout: 30_000 })
}

async function abrirModulos(page: Page): Promise<void> {
  await sesion(page, 'admin')
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Módulos', exact: true }).click()
  await expect(page.getByTestId('mod-card-kds')).toBeVisible({ timeout: 30_000 })
  // Espera a que lleguen los derechos del servidor (el candado sale de GET /api/config/business/modules).
  await expect(page.getByTestId('mod-card-kds')).toHaveAttribute('data-locked', /true|false/)
  await page.waitForTimeout(600)
}

for (const vp of VIEWPORTS) {
  test(`admin: el bloque Add-ons vive en el mismo formulario, con un único Guardar y sin guardar solo @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await abrirAdmin(page)
    const form = formulario(page)
    await expect(form.getByTestId('ps-addon-kds')).toBeVisible() // dentro del formulario de plan/estado
    await expect(form.getByTestId('ps-guardar')).toHaveCount(1) // un único botón Guardar
    await expect(page.getByTestId('ps-addon-kds')).not.toBeChecked()
    await expect(form.locator('#ps-plan')).toHaveValue('negocio_activo')
    const caja = await page.getByTestId('ps-addon-kds').locator('xpath=ancestor::label').boundingBox()
    expect(caja!.height).toBeGreaterThanOrEqual(43.5) // zona táctil
    // Marcar la casilla NO guarda: sin el botón, la base queda igual (no hay switches que guarden solos).
    await page.getByTestId('ps-addon-kds').check()
    await page.waitForTimeout(800)
    expect(addonsDb()).toBe('')
    await page.screenshot({ path: path.join(OUT, `admin-addons-${vp.n}.png`) })
    await page.getByTestId('ps-addon-kds').uncheck()
    // Nota del add-on con plan gratis (solo estado del formulario, sin guardar): aparece con Gratis y desaparece con un plan pago.
    await expect(page.getByTestId('ps-addon-gratis-nota')).toHaveCount(0)
    await form.locator('#ps-plan').selectOption('gratis')
    await expect(page.getByTestId('ps-addon-gratis-nota')).toHaveText('Se activa al subir a un plan pago.')
    await form.locator('#ps-plan').selectOption('negocio_activo')
    await expect(page.getByTestId('ps-addon-gratis-nota')).toHaveCount(0)
  })
}

for (const vp of VIEWPORTS) {
  test(`tenant sin derecho: KDS y Restaurante con candado, switch deshabilitado y mensaje de mejora @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await abrirModulos(page)
    for (const key of ['kds', 'restaurante']) {
      await expect(page.getByTestId(`mod-card-${key}`)).toHaveAttribute('data-locked', 'true')
      await expect(page.getByTestId(`mod-lock-${key}`)).toBeVisible()
      await expect(page.getByTestId(`mod-switch-${key}`)).toBeDisabled()
      await expect(page.getByTestId(`mod-switch-${key}`)).toHaveAttribute('aria-pressed', 'false')
    }
    await expect(page.getByTestId('mod-upgrade-kds')).toContainText('Operación')
    await expect(page.getByTestId('mod-upgrade-kds')).toContainText('Cocina (KDS)')
    await expect(page.getByTestId('mod-upgrade-restaurante')).toContainText('Operación')
    await page.getByTestId('mod-card-kds').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT, `modulos-bloqueado-${vp.n}.png`) })
  })
}

test('admin activa el add-on KDS con un solo Guardar: queda guardado, se rehidrata y el tenant lo ve habilitado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrirAdmin(page)
  await page.getByTestId('ps-addon-kds').check()
  await page.getByTestId('ps-guardar').click()
  await expect(page.getByTestId('ps-msg')).toHaveText('Cambios guardados. Add-ons actualizados.')
  expect(addonsDb()).toBe('kds')
  await expect(page.getByTestId('ps-addon-kds')).toBeChecked() // rehidratado desde la respuesta del servidor
  await page.reload()
  await expect(page.getByTestId('ps-addon-kds')).toBeChecked() // y persistido

  await abrirModulos(page)
  await expect(page.getByTestId('mod-card-kds')).toHaveAttribute('data-locked', 'false')
  await expect(page.getByTestId('mod-switch-kds')).toBeEnabled()
  await expect(page.getByTestId('mod-lock-kds')).toHaveCount(0)
  // Restaurante sigue bloqueado: el add-on es solo de Cocina.
  await expect(page.getByTestId('mod-card-restaurante')).toHaveAttribute('data-locked', 'true')
  await expect(page.getByTestId('mod-switch-restaurante')).toBeDisabled()
  await page.getByTestId('mod-card-kds').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'modulos-kds-desbloqueado-1280.png') })
})

test('admin quita el add-on con pedidos abiertos en cocina: muestra el conteo, pide confirmación, no borra nada y el tenant vuelve a ver el candado', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await abrirAdmin(page)
  expect(abiertasKds()).toBe('2')
  await page.getByTestId('ps-addon-kds').uncheck()
  await page.getByTestId('ps-guardar').click()
  const confirmar = page.getByTestId('ps-kds-confirm')
  await expect(confirmar).toBeVisible()
  await expect(page.getByTestId('ps-kds-count')).toHaveText('2')
  expect(addonsDb()).toBe('kds') // todavía NO se guardó
  await confirmar.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'admin-confirmar-kds-375.png') })

  // Cancelar: no cambia nada.
  await confirmar.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirmar).toHaveCount(0)
  expect(addonsDb()).toBe('kds')

  // Confirmar y guardar: el add-on sale, los pedidos de cocina siguen intactos.
  await page.getByTestId('ps-guardar').click()
  await page.getByTestId('ps-kds-confirm-ok').click()
  await expect(page.getByTestId('ps-msg')).toHaveText('Cambios guardados. Add-ons actualizados.')
  expect(addonsDb()).toBe('')
  expect(abiertasKds()).toBe('2')
  await expect(page.getByTestId('ps-addon-kds')).not.toBeChecked()

  await abrirModulos(page)
  await expect(page.getByTestId('mod-card-kds')).toHaveAttribute('data-locked', 'true')
  await expect(page.getByTestId('mod-switch-kds')).toBeDisabled()
})

test('plan Operación incluye KDS y Restaurante; bajarlo con pedidos abiertos pide confirmación y vuelve a bloquear ambos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await abrirAdmin(page)
  await page.locator('#ps-plan').selectOption('operacion')
  await page.getByTestId('ps-guardar').click() // sube de nivel: no quita nada, no pide confirmación
  await expect(page.getByTestId('ps-msg')).toHaveText('Cambios guardados.')
  expect(planDb()).toBe('operacion')
  await expect(page.locator('#ps-plan')).toHaveValue('operacion') // rehidratado: no vuelve a "gratis"

  await abrirModulos(page)
  for (const key of ['kds', 'restaurante']) {
    await expect(page.getByTestId(`mod-card-${key}`)).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId(`mod-switch-${key}`)).toBeEnabled()
  }

  // Bajar a Entrada sin add-on = quitar KDS: con 2 pedidos abiertos pide confirmación.
  await abrirAdmin(page)
  await page.locator('#ps-plan').selectOption('negocio_activo')
  await page.getByTestId('ps-guardar').click()
  await expect(page.getByTestId('ps-kds-count')).toHaveText('2')
  expect(planDb()).toBe('operacion')
  await page.getByTestId('ps-kds-confirm-ok').click()
  await expect(page.getByTestId('ps-msg')).toHaveText('Cambios guardados.')
  expect(planDb()).toBe('negocio_activo')
  expect(abiertasKds()).toBe('2')

  await abrirModulos(page)
  for (const key of ['kds', 'restaurante']) await expect(page.getByTestId(`mod-card-${key}`)).toHaveAttribute('data-locked', 'true')
})
