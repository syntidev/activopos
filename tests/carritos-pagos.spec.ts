import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'

/**
 * Carritos Premium y Genérico aplican las reglas de "Cobro y precios": Divisa y Bs no se mezclan, "Cobras en $" no ofrece Bs,
 * Cashea apagado no aparece y sin método Bs real queda "Bs · tasa BCV". Negocio propio 217 (ZZB): se respaldan y restauran su plantilla,
 * settings (cobro_precios, catalog_divisa_methods, financing) y los métodos de pago; lo que se crea (prefijo ZZB Carr) se borra. Capturas en .doc/carritos/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const SLUG = 'zzb-pruebas'
const OUT = path.join(__dirname, '..', '.doc', 'carritos')
const P = 'ZZB Carr'
const PRODUCTO = `${P} Producto`
const M_USD = `${P} Efectivo USD`
const M_ZELLE = `${P} Zelle`
const M_PAGOMOVIL = `${P} Pago Movil`
const M_CASHEA = `${P} Cashea`
const KEYS = ['cobro_precios', 'catalog_divisa_methods', 'financing'] as const

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let plantilla = ''
let ajustes: Record<string, string> = {}
let metodos: { id: string; activo: string }[] = []
let productId = 0

const ids = (names: string[]): string => names.map(n => sql(`SELECT id FROM payment_methods WHERE business_id=${BIZ} AND name='${n}'`)).join(',')

function limpiar(): void {
  sql(`DELETE FROM products WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
}

/** collect_in / cashea_enabled del panel "Cobro y precios"; Divisa configurada con los dos métodos Divisa propios. */
function configurar(collectIn: 'both' | 'usd', casheaEnabled: boolean): void {
  sql(`UPDATE businesses SET settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),
         '$.catalog_divisa_methods', CAST('[${ids([M_USD, M_ZELLE])}]' AS JSON),
         '$.cobro_precios', JSON_OBJECT('collect_in','${collectIn}','divisa_enabled',true,'cashea_enabled',${casheaEnabled}),
         '$.financing', JSON_OBJECT('enabled',true,'mode','cashea','provider_name','Cashea','phrase','Paga en cuotas con Cashea')) WHERE id=${BIZ}`)
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)
  for (const k of KEYS) ajustes[k] = sql(`SELECT QUOTE(JSON_EXTRACT(settings,'$.${k}')) FROM businesses WHERE id=${BIZ}`)
  metodos = sql(`SELECT id,is_active FROM payment_methods WHERE business_id=${BIZ}`).split(/\r?\n/).filter(Boolean).map(l => { const [id, activo] = l.split('\t'); return { id, activo } })
  limpiar()
  // Solo cuentan los métodos propios: los del negocio se apagan durante el spec y se restauran al final.
  sql(`UPDATE payment_methods SET is_active=0 WHERE business_id=${BIZ}`)
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active,is_financing) VALUES
       (${BIZ},'${M_USD}','cash',-40,1,0),(${BIZ},'${M_ZELLE}','zelle',-39,1,0),(${BIZ},'${M_PAGOMOVIL}','transfer',-38,1,0),(${BIZ},'${M_CASHEA}','other',-37,1,1)`)
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BIZ},'${PRODUCTO}','[]',10,'service','simple',1,1,1,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${PRODUCTO}'`))
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BIZ}`)
})

test.afterAll(() => {
  limpiar()
  for (const k of KEYS) {
    sql(ajustes[k] === 'NULL'
      ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.${k}') WHERE id=${BIZ} AND settings IS NOT NULL`
      : `UPDATE businesses SET settings=JSON_SET(settings,'$.${k}',CAST(${ajustes[k]} AS JSON)) WHERE id=${BIZ}`)
  }
  for (const m of metodos) sql(`UPDATE payment_methods SET is_active=${m.activo} WHERE id=${m.id}`)
  sql(`UPDATE businesses SET catalog_template='${plantilla}' WHERE id=${BIZ}`)
  for (const k of KEYS) expect(sql(`SELECT QUOTE(JSON_EXTRACT(settings,'$.${k}')) FROM businesses WHERE id=${BIZ}`)).toBe(ajustes[k])
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)).toBe(plantilla)
})

/** Carrito en localStorage → abre el carrito → checkout hasta el paso 3 (pago). */
async function irAlPago(page: Page, catalog: 'catalogo' | 'catalogo-premium'): Promise<void> {
  const cart = [{ product_id: productId, name: PRODUCTO, qty: 1, price_usd: 10, image_url: null }]
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [`activopos_cart_${SLUG}`, JSON.stringify(cart)])
  await expect(async () => {
    await page.goto(`/${catalog}/${SLUG}`)
    await page.getByRole('button', { name: /^Carrito/ }).first().click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
  // El drawer enfoca el nombre a los 80 ms y precarga datos: se llena con reintento hasta que "Continuar" queda habilitado.
  await expect(async () => {
    await page.getByTestId('checkout-name').fill(`${P} cliente`)
    await page.getByTestId('checkout-phone').fill('04141234567')
    await page.getByTestId('checkout-cedula').fill('V-20000001')
    await expect(page.getByTestId('checkout-next-1')).toBeEnabled({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  await page.getByTestId('checkout-next-1').click()
  await page.getByTestId('checkout-next-2').click()
  await expect(page.getByTestId('pay-kind-divisa').or(page.getByTestId('pay-kind-bs')).first()).toBeVisible()
}

const metodo = (page: Page, nombre: string) => page.getByRole('button', { name: nombre, exact: true })

async function divisaSinMezclar(page: Page): Promise<void> {
  await page.getByTestId('pay-kind-divisa').click()
  await expect(page.getByTestId('pay-kind-divisa')).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(300) // deja terminar la transición del selector antes de capturar
  await expect(metodo(page, M_USD)).toBeVisible()
  await expect(metodo(page, M_ZELLE)).toBeVisible()
  await expect(metodo(page, M_PAGOMOVIL)).toHaveCount(0)
}

async function bsSinMezclar(page: Page): Promise<void> {
  await page.getByTestId('pay-kind-bs').click()
  await expect(page.getByTestId('pay-kind-bs')).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(300)
  await expect(metodo(page, M_PAGOMOVIL)).toBeVisible()
  await expect(metodo(page, M_USD)).toHaveCount(0)
  await expect(metodo(page, M_ZELLE)).toHaveCount(0)
}

for (const vp of [{ n: '375', w: 375, h: 812 }, { n: '1280', w: 1280, h: 900 }]) {
  test(`premium: con Divisa configurada, "$ Divisa" y "Pago Móvil" no se mezclan @${vp.n}`, async ({ page }) => {
    configurar('both', true)
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await irAlPago(page, 'catalogo-premium')
    await expect(page.getByTestId('pay-kind-divisa')).toHaveText('$ Divisa')
    await expect(page.getByTestId('pay-kind-bs')).toBeVisible()
    await expect(page.getByTestId('pay-kind-cashea')).toBeVisible()
    await divisaSinMezclar(page)
    await page.screenshot({ path: path.join(OUT, `carrito-divisa-${vp.n}.png`) })
    await bsSinMezclar(page)
    await page.screenshot({ path: path.join(OUT, `carrito-bs-${vp.n}.png`) })
    // Cashea: sin lista de métodos (la financiadora se elige como forma de pago).
    await page.getByTestId('pay-kind-cashea').click()
    await expect(metodo(page, M_PAGOMOVIL)).toHaveCount(0)
    await expect(metodo(page, M_USD)).toHaveCount(0)
  })
}

test('genérico: mismas reglas (Divisa y Bs separados, "$ Divisa")', async ({ page }) => {
  configurar('both', true)
  await page.setViewportSize({ width: 375, height: 812 })
  await irAlPago(page, 'catalogo')
  await expect(page.getByTestId('pay-kind-divisa')).toHaveText('$ Divisa')
  await divisaSinMezclar(page)
  await bsSinMezclar(page)
  await page.screenshot({ path: path.join(OUT, 'carrito-generico-bs-375.png') })
})

test('Cobras en "$" (collect_in=usd): no hay opción Bs ni métodos Bs, y Cashea tampoco (premium y genérico)', async ({ page }) => {
  configurar('usd', true)
  await page.setViewportSize({ width: 375, height: 812 })
  for (const catalog of ['catalogo-premium', 'catalogo'] as const) {
    await irAlPago(page, catalog)
    await expect(page.getByTestId('pay-kind-bs')).toHaveCount(0)
    await expect(page.getByTestId('pay-kind-cashea')).toHaveCount(0)
    await expect(page.getByTestId('pay-kind-divisa')).toBeVisible()
    await expect(metodo(page, M_USD)).toBeVisible() // arranca en Divisa
    await expect(metodo(page, M_PAGOMOVIL)).toHaveCount(0)
    await expect(page.getByText('Bs · tasa BCV')).toHaveCount(0)
    if (catalog === 'catalogo-premium') await page.screenshot({ path: path.join(OUT, 'carrito-solo-usd-375.png') })
  }
})

test('Cashea apagado (cashea_enabled=false): no aparece Cashea, Divisa y Bs siguen', async ({ page }) => {
  configurar('both', false)
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const catalog of ['catalogo-premium', 'catalogo'] as const) {
    await irAlPago(page, catalog)
    await expect(page.getByTestId('pay-kind-cashea')).toHaveCount(0)
    await expect(page.getByTestId('pay-kind-bs')).toBeVisible()
    await expect(page.getByTestId('pay-kind-divisa')).toBeVisible()
    if (catalog === 'catalogo-premium') await page.screenshot({ path: path.join(OUT, 'carrito-sin-cashea-1280.png') })
  }
})

test('sin método Bs real: opción genérica "Bs · tasa BCV" (método Bs) y no se mezclan los de Divisa', async ({ page }) => {
  configurar('both', true)
  sql(`UPDATE payment_methods SET is_active=0 WHERE business_id=${BIZ} AND name='${M_PAGOMOVIL}'`)
  await page.setViewportSize({ width: 375, height: 812 })
  await irAlPago(page, 'catalogo-premium')
  await page.getByTestId('pay-kind-bs').click()
  await expect(page.getByRole('button', { name: 'Bs · tasa BCV', exact: true })).toBeVisible()
  await expect(metodo(page, M_USD)).toHaveCount(0)
  await expect(metodo(page, M_ZELLE)).toHaveCount(0)
  await page.screenshot({ path: path.join(OUT, 'carrito-bs-generico-375.png') })
  sql(`UPDATE payment_methods SET is_active=1 WHERE business_id=${BIZ} AND name='${M_PAGOMOVIL}'`)
})
