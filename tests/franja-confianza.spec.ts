import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Franja de confianza de la home premium: sin configurar muestra los textos de siempre; el admin la edita en
 * Configuración > Tema Visual y la home muestra los nuevos. Negocio 80 (slug boutique-demo), plantilla premium
 * temporal, textos ZZ. Al final: clave trust_strip quitada y plantilla original restaurada.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const HOME = '/catalogo-premium/boutique-demo'

const ACTUALES = [
  ['Envío en Margarita', 'Coordinamos entrega en toda la isla.'],
  ['Garantía de marca oficial', 'Distribuidor autorizado, producto original.'],
  ['Atención directa', 'Escríbenos por WhatsApp, respondemos rápido.'],
]
const NUEVOS = [
  ['ZZ Envío nacional', 'ZZ Despachamos a todo el país.'],
  ['ZZ Garantía total', 'ZZ Producto original y con respaldo.'],
  ['ZZ Atención 24h', 'ZZ Te respondemos por WhatsApp.'],
]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let originalTemplate = ''

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const franjaEnDb = (): string => sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.trust_strip'),'null') FROM businesses WHERE id=${BUSINESS_ID}`)
const quitarFranja = (): string => sql(`UPDATE businesses SET settings=JSON_REMOVE(settings,'$.trust_strip') WHERE id=${BUSINESS_ID}`)

test.beforeAll(() => {
  expect(franjaEnDb(), 'el negocio 80 no debe tener franja antes de la prueba').toBe('null')
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
})

test.afterAll(() => {
  quitarFranja()
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  // Confirmación: sin franja guardada y plantilla original.
  expect(franjaEnDb()).toBe('null')
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

const franja = (page: Page) => page.getByRole('region', { name: 'Confianza' })

/** La home cachea ~60 s: reintenta hasta que muestre el primer título esperado. */
async function homeMuestra(page: Page, textos: string[][]): Promise<void> {
  await expect(async () => {
    await page.goto(HOME)
    await expect(franja(page).getByText(textos[0][0], { exact: true })).toBeVisible({ timeout: 6000 })
  }).toPass({ timeout: 90_000, intervals: [2000] })
  for (const [title, desc] of textos) {
    await expect(franja(page).getByText(title, { exact: true })).toBeVisible()
    await expect(franja(page).getByText(desc, { exact: true })).toBeVisible()
  }
}

test('sin configurar: la home muestra los textos de siempre', async ({ page }) => {
  await homeMuestra(page, ACTUALES)
})

test('admin: valida, cuenta caracteres y guarda la franja', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Tema Visual' }).click()
  const card = page.getByTestId('franja-confianza')
  await expect(card.getByRole('heading', { name: 'Franja de confianza' })).toBeVisible()
  // Precargado con los textos actuales y con contador.
  await expect(card.getByLabel('Título de Envío')).toHaveValue(ACTUALES[0][0])
  await expect(card.getByText(`${ACTUALES[0][0].length}/40`)).toBeVisible()

  // Un título vacío se rechaza con mensaje claro y no guarda nada.
  await card.getByLabel('Título de Envío').fill('')
  await card.getByRole('button', { name: 'Guardar franja' }).click()
  await expect(card.getByRole('alert')).toHaveText('El título no puede estar vacío')
  expect(franjaEnDb()).toBe('null')

  const posiciones = ['Envío', 'Garantía', 'Atención']
  for (let i = 0; i < 3; i++) {
    await card.getByLabel(`Título de ${posiciones[i]}`).fill(NUEVOS[i][0])
    await card.getByLabel(`Descripción de ${posiciones[i]}`).fill(NUEVOS[i][1])
  }
  await card.getByRole('button', { name: 'Guardar franja' }).click()
  await expect(page.getByText('Franja de confianza guardada.')).toBeVisible({ timeout: 30_000 })
  expect(JSON.parse(franjaEnDb())).toEqual(NUEVOS.map(([title, desc]) => ({ title, desc })))
})

test('tras guardar: la home muestra los textos nuevos', async ({ page }) => {
  await homeMuestra(page, NUEVOS)
  await expect(franja(page).getByText(ACTUALES[0][0], { exact: true })).toHaveCount(0)
})
