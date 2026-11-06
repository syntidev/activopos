import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Admin › "Catálogo publicado" (businesses.catalog_active). Caso real de producción (negocio 55): creado por registro,
 * catalog_active=0 y plan/estado "Activo" → /c/[slug] daba "no disponible" sin que el panel lo dijera.
 * Datos propios: negocio de pruebas ZZA (OWN); su estado se restaura al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const OWN = ownBusiness()
const ID = OWN.businessId

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let sa: APIRequestContext
let token = ''
let original = ''

const tokenFor = (userId: number, businessId: number) => new SignJWT({ userId, businessId, role: 'super_admin', name: 'ZZA Prueba' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const row = (): string => sql(`SELECT CONCAT_WS('|',catalog_active,catalog_plan,subscription_active) FROM businesses WHERE id=${ID}`)
const logs = (): number => Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${ID} AND action='catalog_active_updated'`))
const patchPlan = (body: Record<string, unknown>) => sa.patch(`/api/admin/tenants/${ID}/plan`, { data: body })

test.beforeAll(async () => {
  const [superId, superBiz] = sql("SELECT CONCAT(id,'|',business_id) FROM users WHERE role='super_admin' ORDER BY id LIMIT 1").split('|').map(Number)
  expect(superId, 'hace falta un super_admin en la DB local').toBeGreaterThan(0)
  token = await tokenFor(superId, superBiz)
  sa = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${token}` } })
  original = row()
  // Estado de un negocio recién registrado: plan gratis, catálogo apagado.
  sql(`UPDATE businesses SET catalog_active=0, catalog_plan='gratis', subscription_active=1 WHERE id=${ID}`)
})

test.afterAll(async () => {
  const [active, plan, sub] = original.split('|')
  sql(`UPDATE businesses SET catalog_active=${active}, catalog_plan='${plan}', subscription_active=${sub} WHERE id=${ID}`)
  sql(`DELETE FROM activity_logs WHERE business_id=${ID} AND action='catalog_active_updated'`)
  await sa?.dispose()
})

test('plan con catálogo + Activo enciende catalog_active solo, lo avisa y lo audita', async () => {
  const antes = logs()
  const res = await patchPlan({ plan: 'negocio_activo', status: 'active', expires_at: null })
  expect(res.status()).toBe(200)
  const out = await res.json() as { catalog_published_auto: boolean; business: { catalog_active: boolean } }
  expect(out.catalog_published_auto).toBe(true)
  expect(out.business.catalog_active).toBe(true)
  expect(row()).toBe('1|negocio_activo|1')
  expect(logs()).toBe(antes + 1)
  // Un guardado posterior sin cambios no vuelve a avisar ni a auditar.
  const otra = await (await patchPlan({ plan: 'negocio_activo', status: 'active', expires_at: null })).json() as { catalog_published_auto: boolean }
  expect(otra.catalog_published_auto).toBe(false)
  expect(logs()).toBe(antes + 1)
})

test('el interruptor explícito manda: apagar con plan Activo se respeta (no se re-enciende solo) y se audita', async () => {
  const antes = logs()
  const res = await patchPlan({ plan: 'negocio_activo', status: 'active', expires_at: null, catalog_active: false })
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { catalog_published_auto: boolean }).catalog_published_auto).toBe(false)
  expect(row()).toBe('0|negocio_activo|1')
  expect(logs()).toBe(antes + 1)
})

test('pantalla: muestra el valor real, el motivo del enlace y publica con el mismo botón', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  await page.goto(`/businesses/${ID}`)
  const sw = page.locator('#ps-published')
  await expect(sw).toHaveAttribute('aria-checked', 'false') // DB real: apagado
  expect((await sw.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(page.getByTestId('public-url-reason')).toContainText('Catálogo apagado')

  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 30_000 })
  expect(row()).toBe('1|negocio_activo|1')
  await page.reload()
  await expect(page.locator('#ps-published')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('public-url-reason')).toHaveCount(0)

  // Otros motivos, leídos de la DB real: plan sin catálogo.
  sql(`UPDATE businesses SET catalog_plan='gratis' WHERE id=${ID}`)
  await page.reload()
  await expect(page.getByTestId('public-url-reason')).toContainText('Plan sin catálogo')
})
