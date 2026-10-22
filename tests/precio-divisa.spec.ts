import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, apiAs, cleanupTestProducts, tokenFor } from './p0-helpers'

/**
 * Modo de precio del ticket (bcv | divisa), negocio 87 local. 'divisa' = wholesale_price_usd / _per_kg_usd.
 * Cubre: cambio de modo en pedido web y en venta abierta, bloqueo al cobrar, fallback_bcv, manual preservado, kilo,
 * precedencia del modo explícito sobre el tier mayorista, y que cambiar el modo no mueve stock.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

interface TicketLine { id: number; product_id: number; variant_id: number | null; quantity: number; price_per_unit_usd: number; price_source: string; subtotal_usd: number }
interface Ticket { kind: string; id: number; status: string; price_mode: string; total_usd: number; total_bs: number; fallback_lines: number; items: TicketLine[] }
interface SaleResp { id: number; status: string; price_mode: string; total_usd: number | string; items: Array<{ product_id: number; price_per_unit_usd: number | string; price_source: string | null }> }

const CASH_ID = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BUSINESS_ID} AND is_active=1 AND is_financing=0 ORDER BY id LIMIT 1`))
const PAGO = [{ payment_method_id: CASH_ID, amount_bs: 9_000_000, amount_usd: 10_000 }]

const ids = { a: 0, b: 0, kilo: 0, variante: 0, varS: 0, varM: 0, cliente: 0 }

function cleanup(): void {
  const prods = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Divisa%'`).split('\n').filter(Boolean)
  if (prods.length > 0) {
    const list = prods.join(',')
    sql(`DELETE oi FROM order_items oi WHERE oi.product_id IN (${list})`)
    sql(`DELETE FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Divisa%'`)
    const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${list})`).split('\n').filter(Boolean)
    if (sales.length > 0) {
      const sl = sales.join(',')
      sql(`DELETE FROM sale_payments WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sale_items WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sl})`)
    }
  }
  sql(`DELETE FROM clients WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Divisa%'`)
  cleanupTestProducts('Divisa')
}

const netStock = (productId: number): number =>
  Number(sql(`SELECT IFNULL(SUM(quantity) - SUM(waste), 0) FROM inventory_entries WHERE product_id=${productId}`))

async function crearProducto(api: APIRequestContext, data: Record<string, unknown>): Promise<number> {
  const r = await api.post('/api/products', { data })
  expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
  return (await r.json()).product.id as number
}

/** Sesión con un usuario y rol concretos del negocio 87 (QA: 86/104 admin, 105 cajero). */
async function apiRole(userId: number, role: string): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId, role)}` } })
}
const CASHIER_ID = Number(sql(`SELECT id FROM users WHERE business_id=${BUSINESS_ID} AND role='cashier' ORDER BY id LIMIT 1`))
const OTHER_ADMIN_ID = Number(sql(`SELECT id FROM users WHERE business_id=${BUSINESS_ID} AND role='admin' AND id<>86 ORDER BY id LIMIT 1`))

/** Bitácora de cambios de modo: una fila `quién|modo_anterior>modo_nuevo` por cambio real. */
const modeLog = (modelType: 'Sale' | 'Order', modelId: number): string[] =>
  sql(`SELECT CONCAT(user_id,'|',JSON_UNQUOTE(JSON_EXTRACT(old_values,'$.price_mode')),'>',JSON_UNQUOTE(JSON_EXTRACT(new_values,'$.price_mode')))
       FROM activity_logs WHERE business_id=${BUSINESS_ID} AND action='price_mode_changed' AND model_type='${modelType}' AND model_id=${modelId} ORDER BY id`)
    .split('\n').map(l => l.trim()).filter(Boolean)

async function cambiarModo(api: APIRequestContext, kind: 'sales' | 'orders', id: number, mode: string) {
  return api.patch(`/api/${kind}/${id}/price-mode`, { data: { price_mode: mode } })
}

test.beforeAll(async () => {
  cleanup()
  const api = await apiAs()
  ids.a = await crearProducto(api, { name: 'ZZ Divisa A', cost_per_unit_usd: 40, price_per_unit_usd: 100, wholesale_price_usd: 80, stock_quantity: 20 })
  ids.b = await crearProducto(api, { name: 'ZZ Divisa B sin divisa', cost_per_unit_usd: 20, price_per_unit_usd: 50, stock_quantity: 20 })
  ids.kilo = await crearProducto(api, {
    name: 'ZZ Divisa Kilo', sale_mode: 'weight', unit_type: 'weight', unit_label: 'kg', base_unit_label: 'kg', unit_step: 0.5,
    cost_per_unit_usd: 10, price_per_unit_usd: null, price_per_kg_usd: 30, wholesale_price_per_kg_usd: 24, stock_quantity: 20,
  })
  ids.variante = await crearProducto(api, {
    name: 'ZZ Divisa Variante', cost_per_unit_usd: 20, price_per_unit_usd: 60, wholesale_price_usd: 45, has_variants: true,
    variants: [{ tipo: 'talla', valor: 'S', stock: 5, precio_extra: 5 }, { tipo: 'talla', valor: 'M', stock: 5 }],
  })
  ids.varS = Number(sql(`SELECT id FROM product_variants WHERE product_id=${ids.variante} AND valor='S'`))
  ids.varM = Number(sql(`SELECT id FROM product_variants WHERE product_id=${ids.variante} AND valor='M'`))
  // La M tiene precio propio (override absoluto): no tiene equivalente Divisa.
  sql(`UPDATE product_variants SET price_usd=70 WHERE id=${ids.varM}`)
  const c = await api.post('/api/clients', { data: { name: 'ZZ Divisa cliente', phone: '04125550199' } })
  expect(c.status(), JSON.stringify(await c.json().catch(() => ({})))).toBe(201)
  ids.cliente = (await c.json()).client.id as number
  expect((await api.patch(`/api/clients/${ids.cliente}`, { data: { price_tier: 'mayorista' } })).status()).toBe(200)
  await api.dispose()
})
test.afterAll(() => { cleanup() })

test('pedido web: cambiar a divisa recalcula líneas y total; volver a bcv lo restaura', async () => {
  const api = await apiAs()
  const o = await api.post('/api/orders', {
    data: { origin: 'catalog', client_name: 'ZZ Divisa pedido', items: [
      { product_id: ids.a, product_name: 'ZZ Divisa A', quantity: 2 },
      { product_id: ids.b, product_name: 'ZZ Divisa B sin divisa', quantity: 1 },
    ] },
  })
  expect(o.status()).toBe(201)
  const orderId = (await o.json()).order.id as number
  expect(Number(sql(`SELECT total_usd FROM orders WHERE id=${orderId}`))).toBe(250)

  const d = await cambiarModo(api, 'orders', orderId, 'divisa')
  expect(d.status()).toBe(200)
  const t = (await d.json()).ticket as Ticket
  expect(t).toMatchObject({ kind: 'order', price_mode: 'divisa', total_usd: 210, fallback_lines: 1 })
  expect(t.items.find(i => i.product_id === ids.a)).toMatchObject({ price_per_unit_usd: 80, price_source: 'divisa', subtotal_usd: 160 })
  expect(t.items.find(i => i.product_id === ids.b)).toMatchObject({ price_per_unit_usd: 50, price_source: 'fallback_bcv' })
  expect(sql(`SELECT CONCAT(price_mode,'|',total_usd) FROM orders WHERE id=${orderId}`)).toBe('divisa|210.00')
  expect(sql(`SELECT GROUP_CONCAT(price_source ORDER BY product_id) FROM order_items WHERE order_id=${orderId}`)).toBe('divisa,fallback_bcv')

  const back = (await (await cambiarModo(api, 'orders', orderId, 'bcv')).json()).ticket as Ticket
  expect(back).toMatchObject({ price_mode: 'bcv', total_usd: 250, fallback_lines: 0 })
  expect(back.items.every(i => i.price_source === 'bcv')).toBe(true)
  await api.dispose()
})

test('pedido web: cobrar con price_mode divisa cobra el monto en divisa, descuenta stock al pagar y luego bloquea el cambio (409)', async () => {
  const api = await apiAs()
  const o = await api.post('/api/orders', {
    data: { origin: 'catalog', client_name: 'ZZ Divisa pedido cobrar', items: [{ product_id: ids.a, product_name: 'ZZ Divisa A', quantity: 3 }] },
  })
  const orderId = (await o.json()).order.id as number
  const antes = netStock(ids.a)
  await cambiarModo(api, 'orders', orderId, 'divisa')
  expect(netStock(ids.a)).toBe(antes) // cambiar de modo no mueve stock

  const cobro = await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID, price_mode: 'divisa' } })
  expect(cobro.status(), JSON.stringify(await cobro.json().catch(() => ({})))).toBe(200)
  const saleId = (await cobro.json()).sale_id as number
  expect(sql(`SELECT CONCAT(status,'|',price_mode,'|',total_usd) FROM sales WHERE id=${saleId}`)).toBe('paid|divisa|240.00')
  expect(sql(`SELECT CONCAT(price_per_unit_usd+0,'|',price_source) FROM sale_items WHERE sale_id=${saleId}`)).toBe('80.0000|divisa')
  expect(netStock(ids.a)).toBe(antes - 3) // el stock baja SOLO al cobrar

  const tarde = await cambiarModo(api, 'orders', orderId, 'bcv')
  expect(tarde.status()).toBe(409)
  expect((await tarde.json()).error).toMatch(/ya fue cobrado/)
  await api.dispose()
})

test('venta abierta (draft del POS): cambiar el modo recalcula y no toca stock; bcv por defecto', async () => {
  const api = await apiAs()
  const d = await api.post('/api/pos/drafts', { data: { items: [{ product_id: ids.a, quantity: 1 }, { product_id: ids.b, quantity: 2 }] } })
  expect(d.status(), JSON.stringify(await d.json().catch(() => ({})))).toBe(201)
  const draft = (await d.json()).draft as SaleResp
  expect(draft.price_mode).toBe('bcv')
  expect(Number(draft.total_usd)).toBe(200)
  const antes = netStock(ids.a)

  const r = await cambiarModo(api, 'sales', draft.id, 'divisa')
  expect(r.status()).toBe(200)
  const t = (await r.json()).ticket as Ticket
  expect(t).toMatchObject({ kind: 'sale', status: 'draft', price_mode: 'divisa', total_usd: 180, fallback_lines: 1 })
  expect(sql(`SELECT total_usd FROM sales WHERE id=${draft.id}`)).toBe('180.00')
  expect(netStock(ids.a)).toBe(antes)

  // PATCH del draft sin price_mode conserva el modo de la venta
  const p = await api.patch(`/api/pos/drafts/${draft.id}`, { data: { items: [{ product_id: ids.a, quantity: 2 }] } })
  expect(p.status()).toBe(200)
  expect(sql(`SELECT CONCAT(price_mode,'|',total_usd) FROM sales WHERE id=${draft.id}`)).toBe('divisa|160.00')
  await api.dispose()
})

test('venta pendiente: cambia de modo, se cobra y entonces el cambio se bloquea (409 en español)', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  expect(sale.price_mode).toBe('bcv')
  expect(Number(sale.total_usd)).toBe(100)

  expect(((await (await cambiarModo(api, 'sales', sale.id, 'divisa')).json()).ticket as Ticket).total_usd).toBe(80)
  const pay = await api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: PAGO } })
  expect(pay.status(), JSON.stringify(await pay.json().catch(() => ({})))).toBe(200)
  expect(sql(`SELECT CONCAT(status,'|',price_mode,'|',total_usd) FROM sales WHERE id=${sale.id}`)).toBe('paid|divisa|80.00')

  const tarde = await cambiarModo(api, 'sales', sale.id, 'bcv')
  expect(tarde.status()).toBe(409)
  expect((await tarde.json()).error).toBe('Esta venta ya fue cobrada; no se puede cambiar el modo de precio.')
  await api.dispose()
})

test('checkout: el servidor recalcula desde la DB según price_mode y guarda el origen por línea', async () => {
  const api = await apiAs()
  const crear = async (extra: Record<string, unknown>): Promise<SaleResp> => {
    const r = await api.post('/api/sales', {
      data: { status: 'paid', origin: 'pos', payments: PAGO, items: [
        { product_id: ids.a, quantity: 1, sale_mode: 'unit' }, { product_id: ids.b, quantity: 1, sale_mode: 'unit' },
      ], ...extra },
    })
    expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
    return (await r.json()).sale as SaleResp
  }
  const divisa = await crear({ price_mode: 'divisa' })
  expect(divisa.price_mode).toBe('divisa')
  expect(Number(divisa.total_usd)).toBe(130)
  expect(divisa.items.map(i => i.price_source).sort()).toEqual(['divisa', 'fallback_bcv'])

  // El cliente mayorista NO decide si el POS manda el modo explícito...
  const explicitoBcv = await crear({ client_id: ids.cliente, price_mode: 'bcv' })
  expect(Number(explicitoBcv.total_usd)).toBe(150)
  // ...y sin price_mode el tier mayorista sigue valiendo como divisa (compatibilidad).
  const porTier = await crear({ client_id: ids.cliente })
  expect(porTier.price_mode).toBe('divisa')
  expect(Number(porTier.total_usd)).toBe(130)
  await api.dispose()
})

test('fallback: variante con precio propio cae a bcv; variante con extra suma sobre divisa', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', {
    data: { status: 'pending', origin: 'pos', price_mode: 'divisa', items: [
      { product_id: ids.variante, variant_id: ids.varS, quantity: 1, sale_mode: 'unit' },
      { product_id: ids.variante, variant_id: ids.varM, quantity: 1, sale_mode: 'unit' },
    ] },
  })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  const t = (await (await cambiarModo(api, 'sales', sale.id, 'divisa')).json()).ticket as Ticket
  expect(t.items.find(i => i.variant_id === ids.varS)).toMatchObject({ price_per_unit_usd: 50, price_source: 'divisa' }) // 45 divisa + 5 extra
  expect(t.items.find(i => i.variant_id === ids.varM)).toMatchObject({ price_per_unit_usd: 70, price_source: 'fallback_bcv' }) // override absoluto
  expect(t.fallback_lines).toBe(1)
  const bcv = (await (await cambiarModo(api, 'sales', sale.id, 'bcv')).json()).ticket as Ticket
  expect(bcv.items.find(i => i.variant_id === ids.varS)).toMatchObject({ price_per_unit_usd: 65, price_source: 'bcv' }) // 60 + 5
  await api.dispose()
})

test('manual: el precio puesto a mano se respeta en ambos modos', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', {
    data: { status: 'pending', origin: 'pos', items: [
      { product_id: ids.a, quantity: 1, sale_mode: 'unit', unit_price_override: 55, override_reason: 'prueba' },
      { product_id: ids.b, quantity: 1, sale_mode: 'unit' },
    ] },
  })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  expect(sale.items.find(i => i.product_id === ids.a)).toMatchObject({ price_source: 'manual' })
  for (const modo of ['divisa', 'bcv']) {
    const t = (await (await cambiarModo(api, 'sales', sale.id, modo)).json()).ticket as Ticket
    expect(t.items.find(i => i.product_id === ids.a)).toMatchObject({ price_per_unit_usd: 55, price_source: 'manual' })
    expect(t.total_usd).toBe(105)
  }
  await api.dispose()
})

test('kilo: el modo divisa usa wholesale_price_per_kg_usd', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.kilo, quantity: 1.5, sale_mode: 'weight' }] } })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  expect(Number(sale.total_usd)).toBe(45) // 1.5 kg × 30
  const t = (await (await cambiarModo(api, 'sales', sale.id, 'divisa')).json()).ticket as Ticket
  expect(t.items[0]).toMatchObject({ price_per_unit_usd: 24, price_source: 'divisa', quantity: 1.5 })
  expect(t.total_usd).toBe(36)
  await api.dispose()
})

test('validaciones: modo inválido 400, inexistente 404, sin sesión 401, otro negocio 404, filtro por modo', async () => {
  const api = await apiAs()
  expect((await cambiarModo(api, 'sales', 1, 'oro')).status()).toBe(400)
  expect((await cambiarModo(api, 'sales', 999999999, 'bcv')).status()).toBe(404)
  expect((await cambiarModo(api, 'orders', 999999999, 'bcv')).status()).toBe(404)
  const ajena = sql(`SELECT id FROM sales WHERE business_id<>${BUSINESS_ID} LIMIT 1`)
  if (ajena) expect((await cambiarModo(api, 'sales', Number(ajena), 'divisa')).status()).toBe(404)
  const ajeno = sql(`SELECT id FROM orders WHERE business_id<>${BUSINESS_ID} LIMIT 1`)
  if (ajeno) expect((await cambiarModo(api, 'orders', Number(ajeno), 'divisa')).status()).toBe(404)

  const anon = await apiAs(null)
  // Sin sesión el middleware corta antes de la ruta (307 a /login); no se sigue la redirección.
  const sinSesion = await anon.patch('/api/sales/1/price-mode', { data: { price_mode: 'bcv' }, maxRedirects: 0 })
  expect([307, 401]).toContain(sinSesion.status())
  await anon.dispose()

  const lista = await (await api.get('/api/sales?price_mode=divisa&limit=50')).json() as { sales: Array<{ price_mode: string }> }
  expect(lista.sales.length).toBeGreaterThan(0)
  expect(lista.sales.every(s => s.price_mode === 'divisa')).toBe(true)
  await api.dispose()
})

test('concurrencia: cobrar vs cambiar de modo nunca deja una venta pagada con pago insuficiente', async () => {
  test.setTimeout(120_000)
  const api = await apiAs()
  const resultados: string[] = []
  for (let i = 0; i < 12; i++) {
    const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', price_mode: 'divisa', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })
    expect(v.status()).toBe(201)
    const sale = (await v.json()).sale as SaleResp & { total_bs: number | string }
    // El pago cubre EXACTAMENTE el total en divisa (80); el cambio a bcv lo subiría a 100.
    const pagoDivisa = [{ payment_method_id: CASH_ID, amount_bs: Number(sale.total_bs), amount_usd: Number(sale.total_usd) }]
    // El cambio de modo arranca con un desfase creciente (0..~66 ms) para recorrer los dos órdenes posibles.
    const [pay, mode] = await Promise.all([
      api.patch(`/api/sales/${sale.id}/pay`, { data: { payments: pagoDivisa } }),
      new Promise(r => setTimeout(r, i * 6)).then(() => cambiarModo(api, 'sales', sale.id, 'bcv')),
    ])
    const par = `${pay.status()}/${mode.status()}`
    resultados.push(par)
    // O se cobró primero (cobro 200, cambio 409) o cambió primero (el cobro revalida el total nuevo y falla 400). Nunca 200/200.
    expect(['200/409', '400/200'], `iteración ${i}: ${par}`).toContain(par)
    const [status, totalBs] = sql(`SELECT CONCAT(status,'|',total_bs) FROM sales WHERE id=${sale.id}`).split('|')
    if (pay.status() === 200) {
      expect(status).toBe('paid')
      const pagado = Number(sql(`SELECT IFNULL(SUM(amount_bs),0) FROM sale_payments WHERE sale_id=${sale.id}`))
      expect(pagado + 0.01).toBeGreaterThanOrEqual(Number(totalBs))
    } else {
      expect(status).toBe('pending')
      expect(Number(sql(`SELECT COUNT(*) FROM sale_payments WHERE sale_id=${sale.id}`))).toBe(0)
    }
  }
  console.log('concurrencia pay/price-mode (pago/cambio):', resultados.join(' '))
  await api.dispose()
})

test('concurrencia: dos cobros a la vez del mismo pedido producen UNA sola venta y descuentan el stock una vez', async () => {
  const api = await apiAs()
  const o = await api.post('/api/orders', {
    data: { origin: 'catalog', client_name: 'ZZ Divisa cobro doble', items: [{ product_id: ids.b, product_name: 'ZZ Divisa B sin divisa', quantity: 1 }] },
  })
  const orderId = (await o.json()).order.id as number
  const antes = netStock(ids.b)
  const [c1, c2] = await Promise.all([
    api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID } }),
    api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID } }),
  ])
  expect([c1.status(), c2.status()].sort()).toEqual([200, 409])
  expect(netStock(ids.b)).toBe(antes - 1)
  expect(Number(sql(`SELECT COUNT(*) FROM sales WHERE business_id=${BUSINESS_ID} AND id=(SELECT sale_id FROM orders WHERE id=${orderId})`))).toBe(1)
  await api.dispose()
})

test('bitácora: cada cambio real de modo registra quién, de qué modo a cuál, y el id (venta y pedido)', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }] } })
  const sale = (await v.json()).sale as SaleResp
  await cambiarModo(api, 'sales', sale.id, 'divisa')
  await cambiarModo(api, 'sales', sale.id, 'divisa') // mismo modo: recalcula pero no es un cambio
  await cambiarModo(api, 'sales', sale.id, 'bcv')
  expect(modeLog('Sale', sale.id)).toEqual(['86|bcv>divisa', '86|divisa>bcv'])

  const o = await api.post('/api/orders', { data: { origin: 'catalog', client_name: 'ZZ Divisa bitacora', items: [{ product_id: ids.a, product_name: 'ZZ Divisa A', quantity: 1 }] } })
  const orderId = (await o.json()).order.id as number
  const admin2 = await apiRole(OTHER_ADMIN_ID, 'admin')
  await cambiarModo(admin2, 'orders', orderId, 'divisa')
  expect(modeLog('Order', orderId)).toEqual([`${OTHER_ADMIN_ID}|bcv>divisa`])
  // cobrar con otro modo en el body también es un cambio de modo y queda registrado
  expect((await api.post(`/api/orders/${orderId}/cobrar`, { data: { payment_method_id: CASH_ID, price_mode: 'bcv' } })).status()).toBe(200)
  expect(modeLog('Order', orderId)).toEqual([`${OTHER_ADMIN_ID}|bcv>divisa`, '86|divisa>bcv'])
  await admin2.dispose()
  await api.dispose()
})

test('cajero: solo cambia el modo de SUS tickets (draft, pending, quote); el admin puede con cualquiera', async () => {
  const admin = await apiAs()
  const cajero = await apiRole(CASHIER_ID, 'cashier')
  const item = [{ product_id: ids.a, quantity: 1, sale_mode: 'unit' }]

  const ajena = (await (await admin.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: item } })).json()).sale as SaleResp
  expect((await cambiarModo(cajero, 'sales', ajena.id, 'divisa')).status()).toBe(404)
  const ajenaQuote = (await (await admin.post('/api/sales', { data: { status: 'quote', origin: 'quote', items: item } })).json()).sale as SaleResp
  expect((await cambiarModo(cajero, 'sales', ajenaQuote.id, 'divisa')).status()).toBe(404)
  expect(sql(`SELECT price_mode FROM sales WHERE id=${ajena.id}`)).toBe('bcv')

  const propia = await cajero.post('/api/sales', { data: { status: 'pending', origin: 'pos', items: item } })
  expect(propia.status(), JSON.stringify(await propia.json().catch(() => ({})))).toBe(201)
  const propiaId = ((await propia.json()) as { sale: SaleResp }).sale.id
  expect((await cambiarModo(cajero, 'sales', propiaId, 'divisa')).status()).toBe(200)

  expect((await cambiarModo(admin, 'sales', propiaId, 'bcv')).status()).toBe(200) // el admin sí
  expect((await cambiarModo(admin, 'sales', ajena.id, 'divisa')).status()).toBe(200)
  await cajero.dispose()
  await admin.dispose()
})

test('sale_mode sale del producto en la DB, no del body: un body mentiroso no cambia el precio por kilo', async () => {
  const api = await apiAs()
  const v = await api.post('/api/sales', { data: { status: 'pending', origin: 'pos', price_mode: 'divisa', items: [{ product_id: ids.kilo, quantity: 2, sale_mode: 'unit' }] } })
  expect(v.status(), JSON.stringify(await v.json().catch(() => ({})))).toBe(201)
  const sale = (await v.json()).sale as SaleResp
  expect(Number(sale.total_usd)).toBe(48) // 2 kg × 24 (wholesale_price_per_kg_usd), no 2 × precio de unidad
  expect(sql(`SELECT sale_mode FROM sale_items WHERE sale_id=${sale.id}`)).toBe('weight')
  await api.dispose()
})
