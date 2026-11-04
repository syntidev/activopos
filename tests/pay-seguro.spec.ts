import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * /pay solo cobra lo guardado en la venta: cargo_pct / discount_pct del body se ignoran; el cargo lo fija quien opera
 * la venta pendiente (POST /api/sales o PATCH /api/sales/[id]/cargo). Negocio 80, servidor local, datos ZZ con limpieza.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const ADMIN_ID = 79
const OTRO_CAJERO_ID = 79001
const TAG = String(Date.now()).slice(-6)
const NAME = `ZZ Pay ${TAG}`
const PIN_USER = 'ZZ Pay PIN'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let admin: APIRequestContext
let cajero: APIRequestContext
let otroCajero: APIRequestContext
let abriCaja = false
let productId = 0
let metodo = 0
const ventas: number[] = []

const token = (role: 'admin' | 'cashier', userId: number) =>
  new SignJWT({ userId, businessId: BID, role, name: 'ZZ Pay' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const ctx = async (role: 'admin' | 'cashier', userId: number) =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(role, userId)}` } })

function limpiar(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Pay %'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    const s = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
    if (s) {
      sql(`DELETE FROM sale_payments WHERE sale_id IN (${s})`)
      sql(`DELETE FROM sale_items WHERE sale_id IN (${s})`)
      sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${s})`)
    }
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM users WHERE business_id=${BID} AND name='${PIN_USER}'`)
}

interface VentaCreada { id: number; total_usd: number; total_bs: number }

async function crearPendiente(who: APIRequestContext, cargoPct?: number): Promise<VentaCreada> {
  const r = await who.post('/api/sales', {
    data: {
      items: [{ product_id: productId, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
      status: 'pending', origin: 'pos',
      ...(cargoPct !== undefined ? { cargo_pct: cargoPct } : {}),
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  const sale = ((await r.json()) as { sale: { id: number; total_usd: string | number; total_bs: string | number } }).sale
  ventas.push(sale.id)
  return { id: sale.id, total_usd: Number(sale.total_usd), total_bs: Number(sale.total_bs) }
}

const totalDb = (id: number): number => Number(sql(`SELECT total_usd FROM sales WHERE id=${id}`))
const cargoDb = (id: number): number => Number(sql(`SELECT cargo_pct FROM sales WHERE id=${id}`))
const netoCobrado = (id: number): number =>
  Number(sql(`SELECT ROUND(SUM(p.amount_usd) - s.vuelto_usd, 2) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE p.sale_id=${id}`))

test.beforeAll(async () => {
  limpiar()
  admin = await ctx('admin', ADMIN_ID)
  cajero = await ctx('cashier', ADMIN_ID)
  otroCajero = await ctx('cashier', OTRO_CAJERO_ID)
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
    const open = await admin.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0, close_notes: 'ZZ pay-seguro' } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  metodo = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='Efectivo USD'`))
  // PIN de autorización = contraseña de un usuario del negocio (verifyPin): usuario ZZ con PIN 1234, borrado al final.
  sql(`INSERT INTO users (business_id,name,email,password,role,is_active,created_at,updated_at) VALUES (${BID},'${PIN_USER}','zz-pay-pin@example.invalid','$2b$10$MX6AL3RSSGCxUKo4vBp.JeBCXr5bLGb0AzDpw1sbeAMPkuIYmDl2W','admin',1,NOW(3),NOW(3))`)
  const p = await admin.post('/api/products', { data: { name: NAME, price_per_unit_usd: 10, cost_per_unit_usd: 2, is_fixed_price: true, stock_quantity: 50 } })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
})

test.afterAll(async () => {
  limpiar()
  if (abriCaja && admin) await admin.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ pay-seguro' } })
  await admin?.dispose(); await cajero?.dispose(); await otroCajero?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Pay %'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM users WHERE business_id=${BID} AND name='${PIN_USER}'`))).toBe(0)
})

test('cajero manda cargo_pct:0 y discount_pct:50 a /pay: el total guardado no cambia', async () => {
  const v = await crearPendiente(cajero, 10)
  expect(v.total_usd).toBe(11)
  expect(cargoDb(v.id)).toBe(10)

  // Pago que solo alcanzaría si el servidor creyera el cargo 0 y el descuento 50% del body (total 5.00): se rechaza.
  const bajo = await cajero.patch(`/api/sales/${v.id}/pay`, {
    data: { payments: [{ payment_method_id: metodo, amount_usd: 5.5, amount_bs: v.total_bs / 2 }], cargo_pct: 0, discount_pct: 50 },
  })
  expect(bajo.status(), await bajo.text()).toBe(400)
  expect(totalDb(v.id)).toBe(11)
  expect(sql(`SELECT status FROM sales WHERE id=${v.id}`)).toBe('pending')

  // Pago completo con los mismos campos maliciosos: cobra 11.00 y conserva el cargo guardado.
  const ok = await cajero.patch(`/api/sales/${v.id}/pay`, {
    data: { payments: [{ payment_method_id: metodo, amount_usd: 11, amount_bs: v.total_bs }], cargo_pct: 0, discount_pct: 50 },
  })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(totalDb(v.id)).toBe(11)
  expect(cargoDb(v.id)).toBe(10)
  expect(netoCobrado(v.id)).toBe(11)
})

test('PATCH /cargo: el cajero fija el cargo en su venta pendiente; valida, aísla y no toca ventas cobradas', async () => {
  const v = await crearPendiente(cajero)
  expect(v.total_usd).toBe(10)

  const ajeno = await otroCajero.patch(`/api/sales/${v.id}/cargo`, { data: { cargo_pct: 20 } })
  expect(ajeno.status(), 'otro cajero no ve esta venta').toBe(404)
  expect((await cajero.patch(`/api/sales/${v.id}/cargo`, { data: { cargo_pct: 101 } })).status()).toBe(400)
  expect((await cajero.patch(`/api/sales/${v.id}/cargo`, { data: { cargo_pct: 20, total_usd: 1 } })).status(), 'clave desconocida').toBe(400)

  const r = await cajero.patch(`/api/sales/${v.id}/cargo`, { data: { cargo_pct: 20 } })
  expect(r.status(), await r.text()).toBe(200)
  expect(totalDb(v.id)).toBe(12)
  expect(cargoDb(v.id)).toBe(20)

  const pago = await cajero.patch(`/api/sales/${v.id}/pay`, { data: { payments: [{ payment_method_id: metodo, amount_usd: 12, amount_bs: v.total_bs * 1.2 + 1 }] } })
  expect(pago.status(), await pago.text()).toBe(200)
  expect(totalDb(v.id)).toBe(12)

  const tarde = await cajero.patch(`/api/sales/${v.id}/cargo`, { data: { cargo_pct: 0 } })
  expect(tarde.status(), 'una venta cobrada no admite cambio de cargo').toBe(409)
  expect(totalDb(v.id)).toBe(12)
})

test('descuento con PIN y cargo se conservan entre sí y tras cambiar el modo de precio', async () => {
  // Cargo primero, descuento después: antes el descuento recalculaba el total y borraba el cargo (9.00 en vez de 9.90).
  const a = await crearPendiente(cajero, 10)
  const d = await admin.post(`/api/sales/${a.id}/authorize-discount`, { data: { pin: '1234', discount_pct: 10 } })
  expect(d.status(), await d.text()).toBe(200)
  expect(totalDb(a.id)).toBe(9.9)
  expect(cargoDb(a.id)).toBe(10)

  // Cambiar el modo de precio recalcula las líneas: el descuento y el cargo guardados siguen aplicando.
  for (const mode of ['divisa', 'bcv']) {
    const pm = await cajero.patch(`/api/sales/${a.id}/price-mode`, { data: { price_mode: mode } })
    expect(pm.status(), await pm.text()).toBe(200)
    expect(totalDb(a.id), `modo ${mode}`).toBe(9.9)
  }

  // Descuento primero, cargo después (flujo P0-2): total = 10 x 0.9 x 1.1.
  const b = await crearPendiente(cajero)
  expect((await admin.post(`/api/sales/${b.id}/authorize-discount`, { data: { pin: '1234', discount_pct: 10 } })).status()).toBe(200)
  expect(totalDb(b.id)).toBe(9)
  expect((await cajero.patch(`/api/sales/${b.id}/cargo`, { data: { cargo_pct: 10 } })).status()).toBe(200)
  expect(totalDb(b.id)).toBe(9.9)
  const bsB = Number(sql(`SELECT total_bs FROM sales WHERE id=${b.id}`))
  const pago = await cajero.patch(`/api/sales/${b.id}/pay`, { data: { payments: [{ payment_method_id: metodo, amount_usd: 9.9, amount_bs: bsB }], cargo_pct: 0 } })
  expect(pago.status(), await pago.text()).toBe(200)
  expect(totalDb(b.id)).toBe(9.9)
  expect(netoCobrado(b.id)).toBe(9.9)
})
