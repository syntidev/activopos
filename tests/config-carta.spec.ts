import { test, expect } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ensureOwnBusiness } from './helpers/own-business-carta'

/**
 * Configuración de un negocio con plantilla Carta (negocio propio 217): ve la pestaña "Carta" y NO las premium
 * (Tema Visual, Landing, Colecciones, Marcas, Envíos); guarda preset y horario; en 375 px el menú es una columna con "Volver a Configuración".
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 120_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))

test.beforeAll(() => { bid = ensureOwnBusiness() })
test.afterAll(() => { ensureOwnBusiness() }) // repone preset y horario del seed

test('negocio carta: ve "Carta" y no las pestañas premium; guarda preset y horario; móvil en una columna con Volver', async ({ page, context }) => {
  const admin = Number(q("SELECT id FROM users WHERE business_id=@BID AND role='admin' ORDER BY id LIMIT 1"))
  const token = await new SignJWT({ userId: admin, businessId: bid, role: 'admin', name: 'ZZB Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await context.addCookies([{ name: 'activopos_session', value: token, url: BASE }])

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/configuracion')
  const barra = page.getByRole('complementary', { name: 'Secciones de Configuración' })
  const pestana = (nombre: string) => barra.getByRole('button', { name: nombre, exact: true })
  await expect(pestana('Carta')).toBeVisible()
  for (const premium of ['Tema Visual', 'Landing', 'Colecciones', 'Marcas', 'Envíos']) await expect(pestana(premium)).toHaveCount(0)

  // Móvil: UNA columna (grupos uno debajo de otro), filas de 44 px y sin desborde; al entrar a una opción, "Volver a Configuración".
  const cajas = await barra.getByRole('button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), h: Math.round(r.height), w: Math.round(r.width) } }))
  expect(new Set(cajas.map(c => c.x)).size, 'todas las filas alineadas en una columna').toBe(1)
  expect(Math.min(...cajas.map(c => c.h))).toBeGreaterThanOrEqual(44)
  expect(Math.max(...cajas.map(c => c.x + c.w))).toBeLessThanOrEqual(375)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

  await pestana('Carta').click()
  await expect(page.getByTestId('config-volver')).toBeVisible()
  await expect(barra).toBeHidden()
  await page.getByTestId('config-volver').click()
  await expect(barra).toBeVisible()
  await pestana('Carta').click()
  await expect(page.getByTestId('carta-cfg-preset-mar')).toBeVisible()
  await expect(page.getByTestId('carta-cfg-preset-mar')).toHaveCSS('min-height', '44px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

  await page.getByTestId('carta-cfg-preset-mar').click()
  await expect.poll(() => q("SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_preset')) FROM businesses WHERE id=@BID")).toBe('mar')

  const lunes = page.getByTestId('carta-cfg-dia-lun')
  const horas = lunes.locator('input[type="time"]')
  const antes = await horas.count()
  await page.getByTestId('carta-cfg-agregar-lun').click()
  await expect(horas).toHaveCount(antes + 2)
  await horas.nth(antes).fill('05:00')
  await horas.nth(antes + 1).fill('06:30')
  await page.getByTestId('carta-cfg-guardar-horario').click()
  await expect.poll(() => q("SELECT JSON_EXTRACT(settings,'$.carta_hours.lun') FROM businesses WHERE id=@BID")).toContain('06:30')
})
