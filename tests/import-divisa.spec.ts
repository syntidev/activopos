import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import * as XLSX from 'xlsx'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * Importador Excel: "precio_divisa_usd" es alias de "precio_mayorista_usd" (ambas escriben products.wholesale_price_usd;
 * si vienen las dos, gana precio_divisa_usd). La plantilla ya dice "Divisa". Negocio 87, servidor local.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const N = (s: string) => `ZZ Imp ${s} ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const xlsx = (rows: (string | number | null)[][]): Buffer => {
  const ws = XLSX.utils.aoa_to_sheet([['nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'precio_divisa_usd', 'precio_mayorista_usd'], ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[])
}

const wholesale = (name: string) => sql(`SELECT IFNULL(wholesale_price_usd,'NULL') FROM products WHERE business_id=${BUSINESS_ID} AND name='${name}'`)

test.afterAll(() => {
  for (const k of ['A', 'B', 'C', 'D']) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${N(k)}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

test('importar con precio_divisa_usd y precio_mayorista_usd: gana Divisa, el nombre viejo sigue funcionando; la plantilla dice Divisa', async ({ page }) => {
  await login(page)
  const res = await page.request.post('/api/products/import-excel', {
    multipart: {
      file: {
        name: 'divisa.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: xlsx([
          [N('A'), 10, 2, 5, 'ZZ Imp', 7, 9],     // ambas: gana divisa
          [N('B'), 10, 2, 5, 'ZZ Imp', null, 6],  // archivo viejo: solo mayorista
          [N('C'), 10, 2, 5, 'ZZ Imp', 5, null],  // solo divisa
          [N('D'), 10, 2, 5, 'ZZ Imp', '', 4],    // divisa vacía no gana
        ]),
      },
      dry_run: 'false',
    },
  })
  expect(res.status(), await res.text()).toBe(200)
  expect(wholesale(N('A'))).toBe('7.00')
  expect(wholesale(N('B'))).toBe('6.00')
  expect(wholesale(N('C'))).toBe('5.00')
  expect(wholesale(N('D'))).toBe('4.00')

  const tpl = await page.request.get('/api/products/import-excel/template')
  expect(tpl.status()).toBe(200)
  const wb = XLSX.read(await tpl.body(), { type: 'buffer' })
  const text = JSON.stringify(wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })))
  expect(text).toContain('precio_divisa_usd')
  expect(text).toContain('Precio Divisa')
  expect(text).not.toContain('precio al mayor')
})
