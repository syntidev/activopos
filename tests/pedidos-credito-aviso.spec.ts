import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import fs from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Cerrar a crédito: aviso (sin bloquear) cuando el nombre escrito en el pedido difiere del cliente enlazado, y casilla "Verifiqué que es el
 * mismo cliente" exigida SOLO cuando hay diferencia (la comparación ignora tildes, mayúsculas y espacios extra).
 * Negocio propio 217 ("ZZ B Pruebas", carpeta B): datos con prefijo ZZB Aviso, se borran al terminar. Capturas en .doc/pedidos-credito/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const USER = 162
const OUT = path.join(__dirname, '..', '.doc', 'pedidos-credito')
const P = 'ZZB Aviso'
const PRODUCTO = `${P} Producto`
const CLIENTE = `${P} Maria Perez`
const VIEWPORTS = [{ n: '1280', w: 1280, h: 900 }, { n: '375', w: 375, h: 812 }]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let productId = 0
let clienteId = 0

const q = (s: string): string[] => sql(s).split(/\r?\n/).map(x => x.trim()).filter(Boolean)

function limpiar(): void {
  const ordenes = q(`SELECT id FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`).join(',')
  const ventas = q(`SELECT sale_id FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %' AND sale_id IS NOT NULL`).join(',')
  if (ordenes) {
    sql(`DELETE FROM activity_logs WHERE business_id=${BIZ} AND model_type='Order' AND model_id IN (${ordenes})`)
    sql(`DELETE FROM order_items WHERE order_id IN (${ordenes})`)
    sql(`DELETE FROM orders WHERE id IN (${ordenes})`)
  }
  if (ventas) {
    sql(`DELETE FROM activity_logs WHERE business_id=${BIZ} AND model_type='Sale' AND model_id IN (${ventas})`)
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sale_abonos WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sales WHERE business_id=${BIZ} AND id IN (${ventas})`)
  }
  sql(`DELETE FROM inventory_entries WHERE business_id=${BIZ} AND product_id IN (SELECT id FROM products WHERE business_id=${BIZ} AND name LIKE '${P} %')`)
  sql(`DELETE FROM products WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
  sql(`DELETE FROM clients WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  limpiar()
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BIZ},'${PRODUCTO}','[]',100,'service','simple',1,1,0,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${PRODUCTO}'`))
  sql(`INSERT INTO clients (business_id,name,phone,cedula,address,price_tier,is_active,origin,credit_authorized,credit_limit_usd,created_at,updated_at)
       VALUES (${BIZ},'${CLIENTE}','04140000003','V-33333333','Calle 3','detal',1,'pos',1,1000,NOW(3),NOW(3))`)
  clienteId = Number(sql(`SELECT id FROM clients WHERE business_id=${BIZ} AND name='${CLIENTE}'`))
})

test.afterAll(() => {
  limpiar()
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`)).toBe('0')
  expect(sql(`SELECT COUNT(*) FROM clients WHERE business_id=${BIZ} AND name LIKE '${P} %'`)).toBe('0')
})

async function sesion(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER, businessId: BIZ, role: 'admin', name: 'ZZB Pedidos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

/** Pedido enlazado al cliente con el nombre ESCRITO que se pide (se fija por SQL: la API puede normalizarlo). */
async function pedido(page: Page, nombreEscrito: string): Promise<{ id: number; numero: string }> {
  const r = await page.request.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: `${P} tmp`, client_id: clienteId, items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }] },
  })
  expect(r.status(), await r.text()).toBeLessThan(300)
  const id = ((await r.json()) as { order: { id: number } }).order.id
  sql(`UPDATE orders SET client_name='${nombreEscrito}' WHERE id=${id}`)
  return { id, numero: sql(`SELECT order_number FROM orders WHERE id=${id}`) }
}

async function abrirCierre(page: Page, numero: string) {
  await page.goto('/pedidos')
  await page.getByRole('listitem', { name: `Pedido ${numero}` }).getByText(numero, { exact: true }).click()
  const detalle = page.getByRole('dialog', { name: `Pedido ${numero}` })
  await expect(detalle).toBeVisible()
  return detalle
}

const ventaDe = (id: number): string => sql(`SELECT s.status FROM sales s JOIN orders o ON o.sale_id=s.id WHERE o.id=${id}`)

for (const vp of VIEWPORTS) {
  test(`nombre distinto: avisa con ambos nombres, no bloquea y exige la casilla @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await sesion(page)
    const O = await pedido(page, `${P} Otra Persona`)
    const detalle = await abrirCierre(page, O.numero)

    // El panel del cliente también avisa (informativo).
    await detalle.getByTestId('cliente-resumen').locator('summary').click()
    await expect(detalle.getByTestId('cliente-aviso-nombre')).toContainText(`«${P} Otra Persona»`)
    await expect(detalle.getByTestId('cliente-aviso-nombre')).toContainText(`«${CLIENTE}»`)

    await detalle.getByTestId('detalle-cerrar-credito').click()
    const modal = page.getByRole('dialog', { name: `Cerrar a crédito · ${O.numero}` })
    const aviso = modal.getByTestId('credito-aviso-nombre')
    await expect(aviso).toHaveText(`El pedido dice «${P} Otra Persona»; el cliente enlazado es «${CLIENTE}». Verifica antes de cerrar a crédito.`)
    const casilla = modal.getByTestId('credito-verifique')
    await expect(casilla).not.toBeChecked()
    await modal.getByTestId('credito-dias-7').click()
    // Con plazo elegido, sin la casilla no se puede cerrar; con ella sí; al desmarcarla vuelve a bloquear.
    await expect(modal.getByTestId('credito-confirmar')).toBeDisabled()
    await casilla.check()
    await expect(modal.getByTestId('credito-confirmar')).toBeEnabled()
    await casilla.uncheck()
    await expect(modal.getByTestId('credito-confirmar')).toBeDisabled()
    await page.screenshot({ path: path.join(OUT, `aviso-nombre-${vp.n}.png`) })

    // El aviso no bloquea: verificado, el cierre se hace.
    await casilla.check()
    await modal.getByTestId('credito-confirmar').click()
    await expect(modal).toHaveCount(0)
    await expect.poll(() => ventaDe(O.id)).toBe('credit')
  })
}

test('mismo nombre (sin tildes, mayúsculas ni espacios extra): ni aviso ni casilla, comportamiento de siempre', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await sesion(page)
  const O = await pedido(page, `zzb aviso   MARÍA  pérez`)
  const detalle = await abrirCierre(page, O.numero)
  await detalle.getByTestId('cliente-resumen').locator('summary').click()
  await expect(detalle.getByTestId('cliente-aviso-nombre')).toHaveCount(0)
  await detalle.getByTestId('detalle-cerrar-credito').click()
  const modal = page.getByRole('dialog', { name: `Cerrar a crédito · ${O.numero}` })
  await expect(modal.getByTestId('credito-cliente-nombre')).toHaveText(CLIENTE)
  await expect(modal.getByTestId('credito-aviso-nombre')).toHaveCount(0)
  await expect(modal.getByTestId('credito-verifique')).toHaveCount(0)
  await modal.getByTestId('credito-dias-14').click()
  await expect(modal.getByTestId('credito-confirmar')).toBeEnabled() // sin casilla
  await modal.getByTestId('credito-confirmar').click()
  await expect(modal).toHaveCount(0)
  await expect.poll(() => ventaDe(O.id)).toBe('credit')
})
