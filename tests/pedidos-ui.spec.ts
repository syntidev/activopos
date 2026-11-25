import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import fs from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Pedidos UI: cobro sin bloqueo (Cashea inicial + saldo), insignia de pago, despacho sin cobrar (admin con motivo, cajero sin opción)
 * y panel de cliente. Negocio propio 217 ("ZZ B Pruebas", carpeta B): todo con prefijo ZZB, se borra al terminar. Capturas en .doc/pedidos/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const USER = 162
const OUT = path.join(__dirname, '..', '.doc', 'pedidos')
const P = 'ZZB Ped'
const PRODUCTO = `${P} Producto`
const CLIENTE = `${P} Cliente`
const M_EFECTIVO = `${P} Efectivo`
const M_CASHEA = `${P} Cashea`
const VIEWPORTS = [{ n: '1280', w: 1280, h: 900 }, { n: '375', w: 375, h: 812 }]

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let productId = 0
let clienteId = 0
let financingOriginal = 'NULL'

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
    sql(`DELETE FROM sale_items WHERE sale_id IN (${ventas})`)
    sql(`DELETE FROM sales WHERE business_id=${BIZ} AND id IN (${ventas})`)
  }
  sql(`DELETE FROM inventory_entries WHERE business_id=${BIZ} AND product_id IN (SELECT id FROM products WHERE business_id=${BIZ} AND name LIKE '${P} %')`)
  sql(`DELETE FROM products WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
  sql(`DELETE FROM clients WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BIZ} AND name LIKE '${P} %'`)
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  financingOriginal = sql(`SELECT IFNULL(JSON_EXTRACT(settings,'$.financing'),'NULL') FROM businesses WHERE id=${BIZ}`)
  limpiar()
  sql(`UPDATE businesses SET settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.financing',JSON_OBJECT('enabled',true,'mode','cashea','provider_name','Cashea','phrase','Paga en cuotas con Cashea')) WHERE id=${BIZ}`)
  sql(`INSERT INTO payment_methods (business_id,name,type,sort_order,is_active,is_financing) VALUES (${BIZ},'${M_EFECTIVO}','cash',-30,1,0),(${BIZ},'${M_CASHEA}','other',-29,1,1)`)
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BIZ},'${PRODUCTO}','[]',100,'service','simple',1,1,0,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${PRODUCTO}'`))
  sql(`INSERT INTO clients (business_id,name,phone,cedula,address,price_tier,is_active,origin,created_at,updated_at) VALUES (${BIZ},'${CLIENTE}','04140000000','V12345678','Calle de prueba 1','detal',1,'pos',NOW(3),NOW(3))`)
  clienteId = Number(sql(`SELECT id FROM clients WHERE business_id=${BIZ} AND name='${CLIENTE}'`))
})

test.afterAll(() => {
  limpiar()
  sql(financingOriginal === 'NULL'
    ? `UPDATE businesses SET settings=JSON_REMOVE(settings,'$.financing') WHERE id=${BIZ} AND settings IS NOT NULL`
    : `UPDATE businesses SET settings=JSON_SET(settings,'$.financing',CAST('${financingOriginal}' AS JSON)) WHERE id=${BIZ}`)
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BIZ} AND client_name LIKE '${P} %'`)).toBe('0')
})

async function sesion(page: Page, role: 'admin' | 'cashier'): Promise<void> {
  const token = await new SignJWT({ userId: USER, businessId: BIZ, role, name: 'ZZB Pedidos' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

/** Crea un pedido por la API (sesión admin ya puesta). */
async function pedido(page: Page, conCliente: boolean): Promise<{ id: number; numero: string }> {
  const r = await page.request.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: `${CLIENTE} ${Date.now() % 100000}`, ...(conCliente ? { client_id: clienteId } : {}), items: [{ product_id: productId, product_name: PRODUCTO, quantity: 1 }] },
  })
  expect(r.status(), await r.text()).toBeLessThan(300)
  const id = ((await r.json()) as { order: { id: number } }).order.id
  return { id, numero: sql(`SELECT order_number FROM orders WHERE id=${id}`) }
}

const tarjeta = (page: Page, numero: string) => page.getByRole('listitem', { name: `Pedido ${numero}` })

for (const vp of VIEWPORTS) {
  test(`flujo de cobro, despacho sin cobrar y panel de cliente @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await sesion(page, 'admin')
    const A = await pedido(page, true) // se cobra con Cashea (solicitado)
    const B = await pedido(page, true) // listo y sin cobrar: se intenta despachar
    expect((await page.request.patch(`/api/orders/${A.id}/financing`, { data: { action: 'request' } })).status()).toBe(200)
    for (const s of ['preparing', 'ready']) expect((await page.request.patch(`/api/orders/${B.id}`, { data: { status: s } })).status()).toBe(200)

    // 1. Tarjeta: insignia "Por cobrar"; el botón Cobrar sale en cualquier etapa.
    await page.goto('/pedidos')
    const cardA = tarjeta(page, A.numero)
    await expect(cardA.getByTestId('pago-badge')).toHaveText('Por cobrar')
    await cardA.scrollIntoViewIfNeeded()
    await cardA.screenshot({ path: path.join(OUT, `tarjeta-por-cobrar-${vp.n}.png`) })

    // 2. Cobrar con Cashea SOLICITADO: sin bloqueo, pide la inicial y calcula el saldo a cargo de Cashea (USD y Bs).
    await page.getByRole('button', { name: `Cobrar pedido ${A.numero}` }).click()
    const modal = page.getByRole('dialog', { name: `Cobrar pedido ${A.numero}` })
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('cobro-awaiting-approval')).toHaveCount(0)
    await modal.getByRole('radio', { name: M_CASHEA }).click()
    await expect(modal.getByTestId('cobro-inicial')).toBeVisible()
    await expect(modal.getByTestId('cliente-resumen')).toBeVisible() // panel de cliente también en el cobro
    await modal.locator('#cobrar-cedula').fill('V12345678')
    await modal.getByTestId('cobro-inicial-monto').fill('30')
    await expect(modal.getByTestId('cobro-saldo-cashea')).toContainText('$70.00')
    await expect(modal.getByTestId('cobro-saldo-cashea')).toContainText('Bs')
    await modal.getByTestId('cobro-inicial').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(OUT, `cobro-cashea-inicial-saldo-${vp.n}.png`) })
    await modal.getByRole('button', { name: 'Confirmar cobro' }).click()
    await expect(modal.getByText('Pedido cobrado')).toBeVisible()
    await modal.getByRole('button', { name: 'Listo' }).click()
    expect(sql(`SELECT status FROM orders WHERE id=${A.id}`)).toBe('received') // cobrar NO cambia la etapa
    expect(q(`SELECT CONCAT(pm.name,':',sp.amount_usd) FROM sale_payments sp JOIN payment_methods pm ON pm.id=sp.payment_method_id WHERE sp.sale_id=(SELECT sale_id FROM orders WHERE id=${A.id}) ORDER BY sp.id`))
      .toEqual([`${M_EFECTIVO}:30.00`, `${M_CASHEA}:70.00`])
    await expect(cardA.getByTestId('pago-badge')).toHaveText('Cobrado')
    await expect(cardA.getByTestId('pago-cashea')).toHaveText('Cashea $70.00') // el saldo asignado, aparte
    await expect(cardA.getByRole('button', { name: /^Cobrar pedido/ })).toHaveCount(0)
    await cardA.scrollIntoViewIfNeeded()
    await cardA.screenshot({ path: path.join(OUT, `tarjeta-cobrado-cashea-${vp.n}.png`) })

    // 3. Cajero: despachar sin cobrar muestra el motivo y NO ofrece "Despachar sin cobrar".
    await sesion(page, 'cashier')
    await page.goto('/pedidos')
    await page.getByRole('button', { name: `Avanzar pedido ${B.numero}` }).click()
    const aviso = page.getByTestId('despacho-bloqueado')
    await expect(aviso).toBeVisible()
    await expect(aviso.getByTestId('despacho-motivo')).toContainText('no está cobrado')
    await expect(aviso.getByTestId('despachar-sin-cobrar')).toHaveCount(0)
    await expect(aviso.getByTestId('despacho-motivo-input')).toHaveCount(0)
    await expect(aviso.getByTestId('despacho-cobrar')).toBeVisible()
    expect(sql(`SELECT status FROM orders WHERE id=${B.id}`)).toBe('ready')
    await aviso.getByRole('button', { name: 'Cerrar' }).click()

    // 4. Admin: despacha sin cobrar con motivo obligatorio (queda en la bitácora).
    await sesion(page, 'admin')
    await page.goto('/pedidos')
    await page.getByRole('button', { name: `Avanzar pedido ${B.numero}` }).click()
    const avisoAdmin = page.getByTestId('despacho-bloqueado')
    await expect(avisoAdmin.getByTestId('despacho-motivo')).toContainText('no está cobrado')
    const sin = avisoAdmin.getByTestId('despachar-sin-cobrar')
    await expect(sin).toBeDisabled()
    await avisoAdmin.getByTestId('despacho-motivo-input').fill('ab')
    await expect(sin).toBeDisabled() // mínimo 3 caracteres
    await avisoAdmin.getByTestId('despacho-motivo-input').fill('Cliente frecuente, paga contra entrega')
    await page.screenshot({ path: path.join(OUT, `despacho-sin-cobrar-${vp.n}.png`) })
    await sin.click()
    await expect(avisoAdmin).toHaveCount(0)
    await expect.poll(() => sql(`SELECT status FROM orders WHERE id=${B.id}`)).toBe('dispatched')
    expect(sql(`SELECT reason FROM activity_logs WHERE business_id=${BIZ} AND action='order_dispatch_override' AND model_id=${B.id}`)).toBe('Cliente frecuente, paga contra entrega')

    // 5. Detalle: pago + panel de cliente plegable + ficha lateral sin salir del pedido.
    await page.reload()
    await tarjeta(page, A.numero).getByText(A.numero, { exact: true }).click()
    const detalle = page.getByRole('dialog', { name: `Pedido ${A.numero}` })
    await expect(detalle).toBeVisible()
    await expect(detalle.getByTestId('pago-resumen')).toContainText('A cargo de Cashea')
    await detalle.getByTestId('cliente-resumen').locator('summary').click()
    await expect(detalle.getByTestId('cliente-previos')).toBeVisible()
    await expect(detalle.getByTestId('cliente-saldo')).toContainText('$0.00')
    await detalle.getByTestId('cliente-ver-ficha').click()
    const ficha = page.getByRole('dialog', { name: 'Ficha del cliente' })
    await expect(ficha).toBeVisible()
    await expect(ficha).toContainText(CLIENTE)
    await expect(ficha).toContainText('V12345678')
    await page.screenshot({ path: path.join(OUT, `panel-cliente-${vp.n}.png`) })
    await page.keyboard.press('Escape')
    await expect(ficha).toHaveCount(0)
    await expect(detalle).toBeVisible() // Esc cierra solo la ficha

    // 6. Rechazar Cashea tras cobrar: aviso de que el saldo vuelve al cliente y el pago se recarga.
    const panel = detalle.getByTestId('financing-panel')
    await panel.getByRole('button', { name: 'Rechazar' }).click()
    await expect(panel.getByRole('alertdialog')).toContainText('vuelve a ser deuda del cliente')
    await panel.getByRole('button', { name: 'Confirmar' }).click()
    await expect(detalle.getByTestId('pago-deuda-fila')).toContainText('$70.00')
    await expect(detalle.getByTestId('pago-badge')).toHaveText('Por cobrar')
  })
}

test('pedido sin cliente enlazado: el panel muestra solo teléfono y cédula del pedido', async ({ page }) => {
  await sesion(page, 'admin')
  const S = await pedido(page, false)
  await page.goto('/pedidos')
  await tarjeta(page, S.numero).getByText(S.numero, { exact: true }).click()
  const detalle = page.getByRole('dialog', { name: `Pedido ${S.numero}` })
  const resumen = detalle.getByTestId('cliente-resumen')
  await expect(resumen).toContainText('sin ficha enlazada')
  await resumen.locator('summary').click()
  await expect(resumen).toContainText('no está enlazado a un cliente registrado')
  await expect(detalle.getByTestId('cliente-ver-ficha')).toHaveCount(0)
})

/** Pedido listo → (opcional) cobrado con efectivo → despachado (sin cobrar: con override de admin). */
async function despachado(page: Page, cobrado: boolean): Promise<{ id: number; numero: string }> {
  const o = await pedido(page, true)
  for (const s of ['preparing', 'ready']) expect((await page.request.patch(`/api/orders/${o.id}`, { data: { status: s } })).status()).toBe(200)
  if (cobrado) {
    const efectivo = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BIZ} AND name='${M_EFECTIVO}'`))
    const c = await page.request.post(`/api/orders/${o.id}/cobrar`, { data: { payment_method_id: efectivo } })
    expect(c.status(), await c.text()).toBe(200)
  }
  const d = await page.request.patch(`/api/orders/${o.id}`, { data: { status: 'dispatched', ...(cobrado ? {} : { override_reason: 'Prueba ZZB sin cobrar' }) } })
  expect(d.status(), await d.text()).toBe(200)
  return o
}

const estadoDe = (id: number): string => sql(`SELECT status FROM orders WHERE id=${id}`)

for (const vp of VIEWPORTS) {
  test(`entregar: cobrado+despachado → "Marcar entregado"; sin cobrar+despachado → solo "Cobrar" @${vp.n}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await sesion(page, 'admin')
    const C = await despachado(page, true)
    const E = await despachado(page, false)
    await page.goto('/pedidos')

    // Sin cobrar: solo "Cobrar" (cobrar un despachado ya lo entrega); nada de "Marcar entregado".
    const cardE = tarjeta(page, E.numero)
    await expect(cardE.getByTestId('pago-badge')).toHaveText('Por cobrar')
    await expect(cardE.getByRole('button', { name: `Cobrar pedido ${E.numero}` })).toBeVisible()
    await expect(cardE.getByTestId('marcar-entregado')).toHaveCount(0)

    // Cobrado: "Marcar entregado" (≥ 44 px) y ya no "Cobrar".
    const cardC = tarjeta(page, C.numero)
    const entregar = cardC.getByTestId('marcar-entregado')
    await expect(entregar).toBeVisible()
    expect((await entregar.boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
    await expect(cardC.getByRole('button', { name: /^Cobrar pedido/ })).toHaveCount(0)
    await cardC.scrollIntoViewIfNeeded()
    await cardC.screenshot({ path: path.join(OUT, `tarjeta-marcar-entregado-${vp.n}.png`) })
    await page.screenshot({ path: path.join(OUT, `tablero-despachado-${vp.n}.png`) })

    await entregar.click()
    await expect(page.getByText('Pedido entregado').first()).toBeVisible()
    await expect(cardC).toHaveCount(0) // sale del tablero
    expect(estadoDe(C.id)).toBe('delivered')
    expect(estadoDe(E.id)).toBe('dispatched')
  })
}

test('detalle: cobrado+despachado → "Marcar entregado" entrega; sin cobrar → "Cobrar" abre el cobro', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await sesion(page, 'admin')
  const D = await despachado(page, true)
  const E = await despachado(page, false)
  await page.goto('/pedidos')

  await tarjeta(page, E.numero).getByText(E.numero, { exact: true }).click()
  const detE = page.getByRole('dialog', { name: `Pedido ${E.numero}` })
  await expect(detE.getByTestId('detalle-marcar-entregado')).toHaveCount(0)
  await detE.getByTestId('detalle-cobrar').click()
  await expect(page.getByRole('dialog', { name: `Cobrar pedido ${E.numero}` })).toBeVisible()
  await page.getByRole('dialog', { name: `Cobrar pedido ${E.numero}` }).getByRole('button', { name: 'Cancelar' }).click()

  await tarjeta(page, D.numero).getByText(D.numero, { exact: true }).click()
  const detD = page.getByRole('dialog', { name: `Pedido ${D.numero}` })
  await expect(detD.getByTestId('detalle-cobrar')).toHaveCount(0)
  await detD.getByTestId('detalle-marcar-entregado').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'detalle-marcar-entregado-1280.png') })
  await detD.getByTestId('detalle-marcar-entregado').click()
  await expect(detD).toHaveCount(0)
  await expect(page.getByText('Pedido entregado').first()).toBeVisible()
  expect(estadoDe(D.id)).toBe('delivered')
})

test('entregar sin cobrar: el 422 PAYMENT_REQUIRED se muestra con su motivo y el override de admin no aplica', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await sesion(page, 'admin')
  const F = await despachado(page, true)
  const venta = sql(`SELECT sale_id FROM orders WHERE id=${F.id}`)
  await page.goto('/pedidos')
  const entregar = tarjeta(page, F.numero).getByTestId('marcar-entregado')
  await expect(entregar).toBeVisible()
  // El cobro desaparece detrás de la pantalla (estado viejo en el tablero): el servidor lo rechaza.
  sql(`UPDATE orders SET sale_id=NULL WHERE id=${F.id}`)
  await entregar.click()
  await expect(page.getByText('el pedido debe estar cobrado o a crédito')).toBeVisible()
  await expect(page.getByTestId('despacho-bloqueado')).toHaveCount(0) // sin diálogo de override: solo aplica a despachar
  expect(estadoDe(F.id)).toBe('dispatched')
  await page.screenshot({ path: path.join(OUT, 'entregar-422-375.png') })
  sql(`UPDATE orders SET sale_id=${venta} WHERE id=${F.id}`) // se restaura para que la limpieza borre la venta
})
