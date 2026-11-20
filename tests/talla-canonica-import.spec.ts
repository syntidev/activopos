import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import * as XLSX from 'xlsx'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Talla canónica en la ENTRADA: importador Excel y editor de producto. Negocio de pruebas propio (ZZA).
 * Correr con el dev server en :3001 → E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN } = ownBusiness()
const TAG = String(Date.now()).slice(-6).replace(/\d/g, d => 'abcdefghij'[Number(d)])
const ZAP = `ZZ Zapato Canon ${TAG}`
const CAMISA = `ZZ Camisa Canon ${TAG}`
const EDIT = `ZZ Editor Canon ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.afterAll(() => {
  for (const n of [ZAP, CAMISA, EDIT]) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${n}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM product_variants WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BID}`)
  }
})

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

function xlsx(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([['nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'variante_tipo', 'variante_valor'], ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[])
}

const valores = (nombre: string): string =>
  sql(`SELECT GROUP_CONCAT(CONCAT(v.tipo,':',v.valor) ORDER BY v.valor SEPARATOR ' | ') FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.business_id=${BID} AND p.name='${nombre}'`)

test('importador: canoniza tallas válidas y rechaza con error de fila claro las irreconocibles', async ({ page }) => {
  await login(page)
  const buffer = xlsx([
    [ZAP, 50, 20, 3, 'ZZ Canon', 'talla', 'US 9 · EU 42.5'],   // fila 2 → EU 42.5 · US 9
    [ZAP, 50, 20, 2, 'ZZ Canon', 'talla', '42'],               // fila 3 → EU 42
    [ZAP, 50, 20, 1, 'ZZ Canon', 'talla', 'M9 / W10.5'],       // fila 4 → error: pide EU
    [CAMISA, 20, 8, 4, 'ZZ Canon', 'personalizado', 'TALLA m'],// fila 5 → M (tipo pasa a talla)
    [CAMISA, 20, 8, 4, 'ZZ Canon', 'talla', 'xxl'],            // fila 6 → 2XL
    [CAMISA, 20, 8, 4, 'ZZ Canon', 'talla', 'POR DEFINIR'],    // fila 7 → error
  ])
  const post = (dry: boolean) => page.request.post('/api/products/import-excel', {
    multipart: { file: { name: 'tallas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer }, dry_run: String(dry) },
  })

  const dry = await post(true)
  expect(dry.status(), await dry.text()).toBe(200)
  const body = (await dry.json()) as { errors: Array<{ row: number; message: string }> }
  const porFila = new Map(body.errors.map(e => [e.row, e.message]))
  expect(porFila.get(4)).toMatch(/sin EU/)
  expect(porFila.get(7)).toMatch(/'POR DEFINIR' no reconocida/)
  expect([...porFila.keys()].sort()).toEqual([4, 7])
  expect(valores(ZAP)).toBe('NULL') // dry run no crea nada

  const real = await post(false)
  expect(real.status(), await real.text()).toBeLessThan(300)
  expect(valores(ZAP)).toBe('talla:EU 42 | talla:EU 42.5 · US 9')
  expect(valores(CAMISA)).toBe('talla:2XL | talla:M')
})

test('editor: la talla escrita se muestra canónica antes de guardar y se guarda canónica', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await page.locator('#np-name').fill(EDIT)
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-price').fill('20')
  await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
  await page.locator('label[aria-label="Este producto tiene tallas o colores"]').click()

  await page.getByRole('button', { name: /^Calzado hombre/ }).click()
  const campo = page.getByPlaceholder('Ej: 52')
  await campo.fill('42,5')
  await expect(page.getByTestId('talla-canonica')).toContainText('EU 42.5')
  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: /^45(\s|$)/ }).click() // chip del preset: se guarda "EU 45"
  await campo.fill('M9 / W10.5')
  await expect(page.getByTestId('talla-canonica-error')).toContainText('sin EU')
  await expect(page.getByRole('button', { name: 'Agregar' })).toBeDisabled()
  await campo.fill('')

  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')
  expect(valores(EDIT)).toBe('talla:EU 42.5 | talla:EU 45')
})
