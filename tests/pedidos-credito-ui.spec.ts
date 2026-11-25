import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import fs from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Pedidos UI de crédito: cerrar a crédito (cliente confirmado, plazo), crear cliente (CLIENT_EXISTS pide confirmación), cobrar la deuda de
 * un Cashea rechazado (NO_OPEN_REGISTER, AMOUNT_EXCEEDS_DEBT, abono parcial y total) y "Pedir Cashea" oculto en pedidos cobrados.
 * Negocio propio 217 ("ZZ B Pruebas", carpeta B): todo con prefijo ZZB Cred y se borra al terminar. Capturas en .doc/pedidos-credito/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const USER = 162
const OUT = path.join(__dirname, '..', '.doc', 'pedidos-credito')
const P = 'ZZB Cred'
const PRODUCTO = `${P} Producto`
const M_EFECTIVO = `${P} Efectivo`
const M_CASHEA = `${P} Cashea`
const C_OK = `${P} Cliente Credito`
const C_NO = `${P} Cliente Sin Credito`
const VIEWPORTS = [{ n: '1280', w: 1280, h: 900 }, { n: '375', w: 375, h: 812 }]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let productId = 0
let clienteOk = 0
let clienteNo = 0
let efectivoId = 0
let casheaId = 0
let financingOriginal = 'NULL'
let cajaCreada = 0

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
  sql(`DELETE FROM payment_methods WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
  if (cajaCreada) { sql(`DELETE FROM cash_registers WHERE id=${cajaCreada} AND business_id=${BIZ}`); cajaCreada = 0 }
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  financingOriginal = sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.financing'),'NULL') FROM businesses WHERE id=${BIZ}`)
  limpiar()
  sql(`UPDATE businesses SET settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.financing',JSON_OBJECT('enabled',true,'mode','cashea','provider_name','Cashea','phrase','Paga en cuotas con Cashea')) WHERE id=${BIZ}`)
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active,is_financing) VALUES (${BIZ},'${M_EFECTIVO}','cash',-50,1,0),(${BIZ},'${M_CASHEA}','other',-49,1,1)`)
  efectivoId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BIZ} AND name='${M_EFECTIVO}'`))
  casheaId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BIZ} AND name='${M_CASHEA}'`))
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BIZ},'${PRODUCTO}','[]',100,'service','simple',1,1,0,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${PRODUCTO}'`))
  sql(`INSERT INTO clients (business_id,name,phone,cedula,address,price_tier,is_active,origin,credit_authorized,credit_limit_usd,created_at,updated_at) VALUES
       (${BIZ},'${C_OK}','04140000001','V-11111111','Calle 1','detal',1,'pos',1,500,NOW(3),NOW(3)),
       (${BIZ},'${C_NO}','04140000002','V-22222222','Calle 2','detal',1,'pos',0,NULL,NOW(3),NOW(3))`)
  clienteOk = Number(sql(`SELECT id FROM clients WHERE business_id=${BIZ} AND name='${C_OK}'`))
  clienteNo = Number(sql(`SELECT id FROM clients WHERE business_id=${BIZ} AND name='${C_NO}'`))
})

test.afterAll(() => {
  limpiar()
  sql(financingOriginal === 'NULL'
    ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.financing') WHERE id=${BIZ} AND settings IS NOT NULL`
    : `UPDATE businesses SET settings=JSON_SET(settings,'$.financing',CAST('${financingOriginal}' AS JSON)) WHERE id=${BIZ}`)
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`)).toBe('0')
})

async function sesion(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER, businessId: BIZ, role: 'admin', name: 'ZZB Pedidos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

type Pedido = { id: number; numero: string }

/** Pedido por la API; `cliente` enlaza (client_id) y los datos escritos (teléfono/cédula) se fijan por SQL para los casos de crear cliente. */
async function pedido(page: Page, nombre: string, cliente: number | null, extra: { phone?: string; cedula?: string } = {}): Promise<Pedido> {
  const r = await page.request.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: nombre, ...(cliente !== null ? { client_id: cliente } : {}), items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }] },
  })
  expect(r.status(), await r.text()).toBeLessThan(300)
  const id = ((await r.json()) as { order: { id: number } }).order.id
  // La API enlaza (o crea) un cliente por el nombre escrito: para probar "pedido sin cliente" se desenlaza (el cliente auto-creado lo borra la limpieza).
  if (cliente === null) sql(`UPDATE orders SET client_id=NULL WHERE id=${id}`)
  if (extra.phone || extra.cedula) sql(`UPDATE orders SET client_phone=${extra.phone ? `'${extra.phone}'` : 'client_phone'}, client_cedula=${extra.cedula ? `'${extra.cedula}'` : 'client_cedula'} WHERE id=${id}`)
  return { id, numero: sql(`SELECT order_number FROM orders WHERE id=${id}`) }
}

/** Pedido cobrado con Cashea (inicial 30 + saldo 70) y financiamiento rechazado después: deuda del cliente $70. */
async function conDeuda(page: Page, nombre: string): Promise<Pedido> {
  const o = await pedido(page, nombre, clienteOk)
  expect((await page.request.patch(`/api/orders/${o.id}/financing`, { data: { action: 'request' } })).status()).toBe(200)
  const c = await page.request.post(`/api/orders/${o.id}/cobrar`, { data: { payment_method_id: casheaId, cedula: 'V-11111111', initial: { payment_method_id: efectivoId, amount_usd: 30 } } })
  expect(c.status(), await c.text()).toBe(200)
  expect((await page.request.patch(`/api/orders/${o.id}/financing`, { data: { action: 'reject' } })).status()).toBe(200)
  return o
}

const cajasAbiertas = (): string[] => q(`SELECT id FROM cash_registers WHERE business_id=${BIZ} AND closed_at IS NULL`)
function abrirCaja(): void {
  if (cajasAbiertas().length > 0) return
  sql(`INSERT INTO cash_registers (business_id,cashier_id,opening_amount_bs,opening_amount_usd,rate_at_open) VALUES (${BIZ},${USER},0,0,1)`)
  cajaCreada = Number(sql(`SELECT MAX(id) FROM cash_registers WHERE business_id=${BIZ}`))
}
const cerrarCaja = (): void => { if (cajaCreada) { sql(`DELETE FROM cash_registers WHERE id=${cajaCreada} AND business_id=${BIZ}`); cajaCreada = 0 } }

const tarjeta = (page: Page, numero: string) => page.getByRole('listitem', { name: `Pedido ${numero}` })
const ventaDe = (id: number): string => sql(`SELECT s.status FROM sales s JOIN orders o ON o.sale_id=s.id WHERE o.id=${id}`)

async function abrirDetalle(page: Page, numero: string) {
  await tarjeta(page, numero).getByText(numero, { exact: true }).click()
  const detalle = page.getByRole('dialog', { name: `Pedido ${numero}` })
  await expect(detalle).toBeVisible()
  return detalle
}
const cerrarDetalle = (detalle: ReturnType<Page['getByRole']>) => detalle.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

for (const vp of VIEWPORTS) {
  test(`cerrar a crédito, crear cliente y cobrar la deuda de Cashea @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await sesion(page)
    abrirCaja()

    // ── Cerrar a crédito: el modal muestra nombre y cédula del cliente enlazado.
    const A = await pedido(page, `${P} Pedido A`, clienteOk)
    await page.goto('/pedidos')
    let detalle = await abrirDetalle(page, A.numero)
    await detalle.getByTestId('detalle-cerrar-credito').click()
    const modal = page.getByRole('dialog', { name: `Cerrar a crédito · ${A.numero}` })
    await expect(modal.getByTestId('credito-cliente-nombre')).toHaveText(C_OK)
    await expect(modal.getByTestId('credito-cliente-cedula')).toContainText('V-11111111')
    await expect(modal.getByTestId('credito-total')).toContainText('$100.00')
    await expect(modal.getByTestId('credito-total')).toContainText('Bs') // USD y Bs juntos
    await expect(modal.getByTestId('credito-confirmar')).toBeDisabled() // falta el plazo
    await modal.getByTestId('credito-dias-7').click()
    await expect(modal.getByTestId('credito-aviso-nombre')).toBeVisible() // el nombre del pedido difiere del cliente: exige la casilla
    await modal.getByTestId('credito-verifique').check()
    await modal.getByTestId('credito-notas').fill('Paga el viernes')
    await page.screenshot({ path: path.join(OUT, `cerrar-credito-${vp.n}.png`) })
    await modal.getByTestId('credito-confirmar').click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByText('Pedido cerrado a crédito').first()).toBeVisible()
    expect(ventaDe(A.id)).toBe('credit')
    expect(sql(`SELECT s.credit_days FROM sales s JOIN orders o ON o.sale_id=s.id WHERE o.id=${A.id}`)).toBe('7')
    await expect(detalle.getByTestId('pago-badge').first()).toHaveText('A crédito')
    await expect(detalle.getByTestId('detalle-cerrar-credito')).toHaveCount(0)
    await expect(detalle.getByRole('button', { name: 'Pedir Cashea' })).toHaveCount(0) // ya tiene venta
    await cerrarDetalle(detalle)

    // ── Crear cliente: CLIENT_EXISTS muestra al cliente y pide confirmar antes de enlazar.
    const B = await pedido(page, `${P} Pedido Dup`, null, { phone: '04149998888', cedula: 'V-11111111' })
    await page.reload()
    detalle = await abrirDetalle(page, B.numero)
    await detalle.getByTestId('cliente-resumen').locator('summary').click()
    await detalle.getByTestId('cliente-crear').click()
    await expect(detalle.getByTestId('cliente-existe-nombre')).toHaveText(C_OK)
    await expect(detalle.getByTestId('cliente-existe-cedula')).toContainText('V-11111111')
    expect(sql(`SELECT client_id IS NULL FROM orders WHERE id=${B.id}`)).toBe('1') // nada enlazado sin confirmar
    await detalle.getByTestId('cliente-existe').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT, `crear-cliente-existe-${vp.n}.png`) })
    await detalle.getByTestId('cliente-enlazar-existente').click()
    await expect.poll(() => sql(`SELECT client_id FROM orders WHERE id=${B.id}`)).toBe(String(clienteOk))
    await expect(detalle.getByTestId('cliente-resumen')).toContainText(C_OK)
    await cerrarDetalle(detalle)

    // ── Cobrar la deuda de un Cashea rechazado (abono parcial y luego total).
    const D = await conDeuda(page, `${P} Pedido Deuda`)
    await page.reload()
    const cardD = tarjeta(page, D.numero)
    await expect(cardD.getByTestId('pago-deuda')).toHaveText('Debe $70.00')
    await expect(cardD.getByRole('button', { name: /^Cobrar pedido/ })).toHaveCount(0)
    await cardD.scrollIntoViewIfNeeded()
    await cardD.screenshot({ path: path.join(OUT, `tarjeta-deuda-${vp.n}.png`) })
    await cardD.getByTestId('cobrar-deuda').click()
    const deuda = page.getByRole('dialog', { name: `Cobrar deuda de Cashea · ${D.numero}` })
    await expect(deuda.getByTestId('deuda-saldo')).toContainText('$70.00')
    await expect(deuda.getByTestId('deuda-saldo')).toContainText('Bs')
    await expect(deuda.getByRole('radio').first()).toBeVisible() // espera la carga de los métodos antes de capturar
    await deuda.getByTestId('deuda-monto').fill('30')
    await expect(deuda.getByTestId('deuda-monto-bs')).toContainText('Bs')
    await page.screenshot({ path: path.join(OUT, `cobrar-deuda-${vp.n}.png`) })
    await deuda.getByTestId('deuda-confirmar').click()
    await expect(deuda.getByTestId('deuda-resultado')).toContainText('Saldo restante')
    await expect(deuda.getByTestId('deuda-resultado')).toContainText('$40.00')
    await deuda.getByRole('button', { name: 'Listo' }).click()
    await expect(cardD.getByTestId('pago-deuda')).toHaveText('Debe $40.00')
    await cardD.getByTestId('cobrar-deuda').click()
    await deuda.getByTestId('deuda-confirmar').click()
    await expect(deuda.getByTestId('deuda-resultado')).toHaveText('Deuda saldada.')
    await deuda.getByRole('button', { name: 'Listo' }).click()
    await expect(cardD.getByTestId('pago-badge')).toHaveText('Cobrado')
    await expect(cardD.getByTestId('pago-deuda')).toHaveCount(0)
    expect(sql(`SELECT ROUND(SUM(amount_usd),2) FROM sale_abonos WHERE sale_id=(SELECT sale_id FROM orders WHERE id=${D.id})`)).toBe('70.00')
    cerrarCaja()
  })
}

test('cerrar a crédito: CLIENT_NOT_CONFIRMED se muestra y permite actualizar el cliente; sin crédito autorizado no se puede confirmar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await sesion(page)
  const E = await pedido(page, `${P} Pedido E`, clienteOk)
  await page.goto('/pedidos')
  const detalle = await abrirDetalle(page, E.numero)
  await detalle.getByTestId('detalle-cerrar-credito').click()
  const modal = page.getByRole('dialog', { name: `Cerrar a crédito · ${E.numero}` })
  await modal.getByTestId('credito-dias-14').click()
  await modal.getByTestId('credito-verifique').check()
  // El enlace del pedido cambia detrás de la pantalla: el servidor rechaza al cliente confirmado.
  sql(`UPDATE orders SET client_id=${clienteNo} WHERE id=${E.id}`)
  await modal.getByTestId('credito-confirmar').click()
  await expect(modal.getByTestId('credito-error')).toContainText('Confirma el cliente del pedido')
  expect(ventaDe(E.id)).toBe('') // nada se cerró
  await modal.getByTestId('credito-recargar-cliente').click()
  await expect(modal.getByTestId('credito-cliente-nombre')).toHaveText(C_NO)
  await expect(modal.getByTestId('credito-sin-autorizar')).toBeVisible()
  await expect(modal.getByTestId('credito-confirmar')).toBeDisabled()
})

test('cobrar deuda: sin caja abierta, monto mayor a la deuda y "Pedir Cashea" oculto en pedidos cobrados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await sesion(page)
  expect(cajasAbiertas(), 'el negocio de pruebas no debe tener caja abierta').toHaveLength(0)
  const F = await conDeuda(page, `${P} Pedido F`)
  await page.goto('/pedidos')
  await tarjeta(page, F.numero).getByTestId('cobrar-deuda').click()
  const deuda = page.getByRole('dialog', { name: `Cobrar deuda de Cashea · ${F.numero}` })
  await deuda.getByTestId('deuda-confirmar').click()
  await expect(deuda.getByTestId('deuda-error')).toContainText('Abre la caja') // 409 NO_OPEN_REGISTER, tal cual
  abrirCaja()
  await deuda.getByTestId('deuda-monto').fill('100')
  await deuda.getByTestId('deuda-confirmar').click()
  await expect(deuda.getByTestId('deuda-error')).toContainText('supera la deuda') // 422 AMOUNT_EXCEEDS_DEBT
  await expect(deuda.getByTestId('deuda-error-saldo')).toContainText('$70.00')
  await deuda.getByRole('button', { name: 'Cancelar' }).click()

  // "Pedir Cashea" no se ofrece en un pedido ya cobrado (ni con deuda): el servidor tampoco lo admite.
  const G = await pedido(page, `${P} Pedido G`, clienteOk)
  expect((await page.request.post(`/api/orders/${G.id}/cobrar`, { data: { payment_method_id: efectivoId } })).status()).toBe(200)
  await page.reload()
  const detG = await abrirDetalle(page, G.numero)
  await expect(detG.getByTestId('pago-badge').first()).toHaveText('Cobrado')
  await expect(detG.getByRole('button', { name: 'Pedir Cashea' })).toHaveCount(0)
  await cerrarDetalle(detG)
  const detF = await abrirDetalle(page, F.numero)
  await expect(detF.getByRole('button', { name: 'Pedir Cashea' })).toHaveCount(0)
  await expect(detF.getByTestId('detalle-cobrar-deuda')).toBeVisible()
  cerrarCaja()
})
