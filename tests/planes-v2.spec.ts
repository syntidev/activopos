import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'
import { BILLING_CYCLES, PRICES_PUBLISHED, WORKING_ADDON_CYCLES, WORKING_BILLING_CYCLES } from '../src/lib/plan-limits'

/**
 * Planes v2 (backend): derecho (plan + add-on) × preferencia (modules_enabled) × estado de cuenta, aplicado al USAR el KDS en el servidor.
 * Tenant propio ZZA (E2E_BUSINESS_ID): su plan, add-ons, suscripción y módulos se GUARDAN y se RESTAURAN al final. Servidor local en :3001.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN } = ownBusiness()
const TAG = String(Date.now()).slice(-6)
const BASE_MODULES = 'pos,inventory,caja,pedidos,catalog,finanzas,reportes,analytics,suppliers'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

type Plan = 'gratis' | 'negocio_activo' | 'operacion'
type Sub  = 'vigente' | 'vencida' | 'suspendida'

let tenant: APIRequestContext
let superAdmin: APIRequestContext
let original = { plan: '', active: '', expires: '', addons: '', modules: '' }

const token = (role: string) =>
  new SignJWT({ userId: ADMIN, businessId: BID, role, name: 'ZZA Planes' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
const ctx = async (role: string) => pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token(role)}` } })
const lineas = (s: string): string[] => s.split(/\r?\n/).map(x => x.trim()).filter(Boolean)

/** Deja el tenant en un estado exacto (por SQL: es el estado de partida de cada caso, no lo que se prueba). */
function setState(o: { plan: Plan; addon: boolean; pref: boolean; sub: Sub }): void {
  const modules = o.pref ? `${BASE_MODULES},kds` : BASE_MODULES
  const expires = o.sub === 'vencida' ? 'NOW() - INTERVAL 1 DAY' : 'NULL'
  sql(`UPDATE businesses SET catalog_plan='${o.plan}', addons='${o.addon ? 'kds' : ''}', modules_enabled='${modules}', subscription_active=${o.sub === 'suspendida' ? 0 : 1}, subscription_expires_at=${expires} WHERE id=${BID}`)
}
const estadoDb = () => sql(`SELECT CONCAT_WS('|',catalog_plan,addons,modules_enabled,subscription_active) FROM businesses WHERE id=${BID}`)
const logsAddon = (): number => Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${BID} AND model_type='Business' AND model_id=${BID} AND action='addon_updated'`))
const planPatch = (data: object) => superAdmin.patch(`/api/admin/tenants/${BID}/plan`, { data: { status: 'active', ...data } })

function limpiarPedidos(): void {
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id=${BID} AND client_name LIKE 'ZZA Planes %')`)
  sql(`DELETE FROM orders WHERE business_id=${BID} AND client_name LIKE 'ZZA Planes %'`)
}

test.beforeAll(async () => {
  original = {
    plan: sql(`SELECT IFNULL(catalog_plan,'') FROM businesses WHERE id=${BID}`),
    active: sql(`SELECT subscription_active FROM businesses WHERE id=${BID}`),
    expires: sql(`SELECT IFNULL(subscription_expires_at,'NULL') FROM businesses WHERE id=${BID}`),
    addons: sql(`SELECT addons FROM businesses WHERE id=${BID}`),
    modules: sql(`SELECT modules_enabled FROM businesses WHERE id=${BID}`),
  }
  limpiarPedidos()
  tenant = await ctx('admin')
  superAdmin = await ctx('super_admin')
})

test.afterAll(async () => {
  limpiarPedidos()
  sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND model_type='Business' AND model_id=${BID} AND action='addon_updated'`)
  sql(`UPDATE businesses SET catalog_plan=${original.plan ? `'${original.plan}'` : 'NULL'}, addons='${original.addons}', modules_enabled='${original.modules}',
       subscription_active=${original.active || 1}, subscription_expires_at=${original.expires === 'NULL' ? 'NULL' : `'${original.expires}'`} WHERE id=${BID}`)
  await tenant?.dispose()
  await superAdmin?.dispose()
})

test('precios: la vitrina sigue en $19 (nada se publica) y los precios de trabajo v2 salen de un solo lugar', () => {
  expect(PRICES_PUBLISHED).toBe(false)
  // publicado (sin cambios): negocio_activo $19 → 19 / 50 / 90 / 156
  expect(Object.values(BILLING_CYCLES.negocio_activo).map(c => c.totalAmount)).toEqual([19, 50, 90, 156])
  expect(BILLING_CYCLES.negocio_activo.anual).toMatchObject({ savingsPct: 30, savingsAmount: 72 })
  // trabajo v2: Entrada 29 / Operación 39 / add-on KDS 8 con 0 / ≈5 / ≈10 / 2 meses gratis
  expect(Object.values(WORKING_BILLING_CYCLES.negocio_activo).map(c => c.totalAmount)).toEqual([29, 82, 156, 290])
  expect(Object.values(WORKING_BILLING_CYCLES.operacion).map(c => c.totalAmount)).toEqual([39, 111, 210, 390])
  expect(Object.values(WORKING_ADDON_CYCLES.kds).map(c => c.totalAmount)).toEqual([8, 22, 43, 80])
  expect(WORKING_BILLING_CYCLES.operacion.anual).toMatchObject({ monthlyEquivalent: 32.5, savingsAmount: 78, savingsPct: 17 })
})

test('matriz nivel × add-on × preferencia × suscripción: la API de KDS, la lista de cocina, la página y los derechos coinciden', async () => {
  const fallos: string[] = []
  for (const plan of ['gratis', 'negocio_activo', 'operacion'] as const) {
    for (const addon of [false, true]) {
      for (const pref of [true, false]) {
        for (const sub of ['vigente', 'vencida', 'suspendida'] as const) {
          setState({ plan, addon, pref, sub })
          const derecho = sub === 'vigente' && (plan === 'operacion' || addon)
          const esperado = derecho ? (pref ? 200 : 403) : 403
          const codigo = derecho ? (pref ? null : 'MODULE_DISABLED') : 'PLAN_LIMIT'
          const caso = `${plan} addon=${addon} pref=${pref} sub=${sub}`

          for (const ruta of ['/api/kds/orders', '/api/orders?send_to_kds=true&limit=5']) {
            const r = await tenant.get(ruta)
            const code = r.status() === 403 ? ((await r.json()) as { code?: string }).code : null
            if (r.status() !== esperado || (codigo && code !== codigo)) fallos.push(`${caso} ${ruta}: ${r.status()}/${code} (esperado ${esperado}/${codigo})`)
          }
          const page = await tenant.get('/kds', { maxRedirects: 0 })
          const paginaOk = derecho && pref
          if ((page.status() === 200) !== paginaOk) fallos.push(`${caso} /kds: ${page.status()} (esperado ${paginaOk ? 200 : 404})`)

          const mods = (await (await tenant.get('/api/config/business/modules')).json()) as { entitlements: { kds: boolean; restaurante: boolean }; addons: string[] }
          if (mods.entitlements.kds !== derecho) fallos.push(`${caso} entitlements.kds=${mods.entitlements.kds}`)
          if (mods.entitlements.restaurante !== (sub === 'vigente' && plan === 'operacion')) fallos.push(`${caso} entitlements.restaurante=${mods.entitlements.restaurante}`)
          if (JSON.stringify(mods.addons) !== JSON.stringify(addon ? ['kds'] : [])) fallos.push(`${caso} addons=${JSON.stringify(mods.addons)}`)
        }
      }
    }
  }
  expect(fallos).toEqual([])
})

test('PATCH de módulos: activar kds/restaurante exige el derecho (plan o add-on); apagar siempre se puede', async () => {
  const modulos = (...extra: string[]) => ({ modules: ['pos', 'inventory', 'caja', ...extra] })
  setState({ plan: 'negocio_activo', addon: false, pref: false, sub: 'vigente' })
  const sin = await tenant.patch('/api/config/business/modules', { data: modulos('kds') })
  expect(sin.status()).toBe(403)
  expect(await sin.json()).toMatchObject({ code: 'PLAN_LIMIT' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('restaurante') })).status()).toBe(403)
  expect(estadoDb().split('|')[2], 'un PATCH rechazado no escribe nada').toBe(BASE_MODULES)

  setState({ plan: 'negocio_activo', addon: true, pref: false, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('kds') })).status()).toBe(200)
  expect(estadoDb().split('|')[2]).toContain('kds')
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('restaurante') })).status(), 'el add-on KDS no concede Restaurante').toBe(403)

  setState({ plan: 'operacion', addon: false, pref: false, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('kds', 'restaurante') })).status()).toBe(200)

  // bajó de plan: lo ya encendido no se apaga por el chequeo; apagar siempre se permite
  setState({ plan: 'negocio_activo', addon: false, pref: true, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos() })).status()).toBe(200)
  expect(estadoDb().split('|')[2]).not.toContain('kds')

  // suscripción vencida: ni activar lo gateado
  setState({ plan: 'operacion', addon: false, pref: false, sub: 'vencida' })
  const vencida = await tenant.patch('/api/config/business/modules', { data: modulos('kds') })
  expect(vencida.status()).toBe(403)
  expect(await vencida.json()).toMatchObject({ code: 'PLAN_LIMIT' })
})

test('PATCH admin de plan: operacion, add-ons como CONJUNTO ABSOLUTO, ActivityLog solo si cambia, estado canónico, sin tocar modules_enabled', async () => {
  setState({ plan: 'negocio_activo', addon: false, pref: true, sub: 'vigente' })
  const modulosAntes = estadoDb().split('|')[2]
  const logs0 = logsAddon()

  // solo el super_admin escribe derechos (el admin del negocio no)
  expect((await tenant.patch(`/api/admin/tenants/${BID}/plan`, { data: { plan: 'operacion', status: 'active' } })).status()).toBe(403)
  // claves desconocidas y planes inválidos → 400
  expect((await planPatch({ plan: 'operacion', addons: ['kds', 'cocina'] })).status()).toBe(400)
  expect((await planPatch({ plan: 'platino' })).status()).toBe(400)
  expect(estadoDb().split('|')[0], 'nada se escribió con los 400').toBe('negocio_activo')

  // conjunto absoluto: ['kds'] (con repetidos) → queda ['kds']
  const a = await planPatch({ plan: 'negocio_activo', addons: ['kds', 'kds'] })
  expect(a.status(), await a.text()).toBe(200)
  const ja = await a.json()
  expect(ja).toMatchObject({ ok: true, addons_changed: true, business: { id: BID, catalog_plan: 'negocio_activo', addons: ['kds'], subscription_active: true } })
  expect(ja.business.entitlements).toEqual({ kds: true, restaurante: false })
  expect(ja.business.modules_enabled).toEqual(modulosAntes.split(','))
  expect(logsAddon()).toBe(logs0 + 1)
  expect(sql(`SELECT JSON_EXTRACT(new_values,'$.addons[0]') FROM activity_logs WHERE business_id=${BID} AND action='addon_updated' ORDER BY id DESC LIMIT 1`)).toBe('"kds"')

  // idempotente: el mismo conjunto no cambia nada ni deja otro log
  const b = await planPatch({ plan: 'negocio_activo', addons: ['kds'] })
  expect(await b.json()).toMatchObject({ addons_changed: false, business: { addons: ['kds'] } })
  expect(logsAddon()).toBe(logs0 + 1)
  // omitido = sin cambios
  expect((await (await planPatch({ plan: 'negocio_activo' })).json()).business.addons).toEqual(['kds'])

  // subir a operacion (add-on se conserva), y GET devuelve el mismo estado canónico
  const c = await planPatch({ plan: 'operacion' })
  expect((await c.json()).business).toMatchObject({ catalog_plan: 'operacion', addons: ['kds'], entitlements: { kds: true, restaurante: true } })
  const g = await superAdmin.get(`/api/admin/tenants/${BID}/plan`)
  expect((await g.json()).business).toMatchObject({ catalog_plan: 'operacion', addons: ['kds'] })

  // quitar el add-on con [] → conjunto vacío, queda log, y modules_enabled intacto
  const d = await planPatch({ plan: 'negocio_activo', addons: [] })
  expect(await d.json()).toMatchObject({ addons_changed: true, business: { catalog_plan: 'negocio_activo', addons: [], entitlements: { kds: false, restaurante: false } } })
  expect(logsAddon()).toBe(logs0 + 2)
  expect(estadoDb().split('|')[2], 'bajar de nivel / quitar el add-on NO edita modules_enabled').toBe(modulosAntes)
})

test('downgrade con pedidos abiertos en cocina: el panel recibe el conteo, no se borra nada y el KDS se corta al usar', async () => {
  setState({ plan: 'operacion', addon: false, pref: true, sub: 'vigente' })
  limpiarPedidos()
  for (const [n, estado] of [[1, 'received'], [2, 'preparing'], [3, 'delivered']] as const) {
    sql(`INSERT INTO orders (business_id,order_number,status,origin,client_name,total_usd,total_bs,rate_used,send_to_kds,updated_at)
         VALUES (${BID},'ZPL-${TAG}-${n}','${estado}','whatsapp','ZZA Planes ${n}',10,1000,100,1,NOW(3))`)
  }
  expect((await tenant.get('/api/kds/orders')).status()).toBe(200)
  expect((await (await superAdmin.get(`/api/admin/tenants/${BID}/plan`)).json()).business.open_kds_orders, 'recibido + preparando; el entregado no cuenta').toBe(2)

  const modulosAntes = estadoDb().split('|')[2]
  const r = await planPatch({ plan: 'negocio_activo', addons: [] })
  expect(await r.json()).toMatchObject({ business: { catalog_plan: 'negocio_activo', open_kds_orders: 2, entitlements: { kds: false } } })
  expect(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BID} AND client_name LIKE 'ZZA Planes %'`), 'ningún pedido se borra').toBe('3')
  expect(estadoDb().split('|')[2], 'modules_enabled intacto').toBe(modulosAntes)
  const cortado = await tenant.get('/api/kds/orders')
  expect(cortado.status()).toBe(403)
  expect(await cortado.json()).toMatchObject({ code: 'PLAN_LIMIT' })

  // volver a darle el derecho reabre el acceso con los mismos datos
  expect((await planPatch({ plan: 'negocio_activo', addons: ['kds'] })).status()).toBe(200)
  expect((await tenant.get('/api/kds/orders')).status()).toBe(200)
})

test('dos PATCH simultáneos del tenant sobre modules_enabled no pisan el derecho (plan y add-ons) y gana uno entero', async () => {
  setState({ plan: 'negocio_activo', addon: true, pref: false, sub: 'vigente' })
  const A = ['pos', 'inventory', 'caja', 'kds']
  const B = ['pos', 'inventory', 'pedidos', 'finanzas']
  const [ra, rb] = await Promise.all([
    tenant.patch('/api/config/business/modules', { data: { modules: A } }),
    tenant.patch('/api/config/business/modules', { data: { modules: B } }),
  ])
  expect([ra.status(), rb.status()]).toEqual([200, 200])
  const [plan, addons, modules] = estadoDb().split('|')
  expect(plan, 'el derecho no se tocó').toBe('negocio_activo')
  expect(addons).toBe('kds')
  const set = (xs: string[]) => [...new Set(xs)].sort().join(',')
  expect([set(A), set(B)], 'last-write-wins: queda exactamente una de las dos listas').toContain(set(modules.split(',')))
  // y el super_admin puede cambiar el derecho en paralelo a los PATCH del tenant sin que se pisen
  const [rt, rs] = await Promise.all([
    tenant.patch('/api/config/business/modules', { data: { modules: A } }),
    planPatch({ plan: 'operacion', addons: [] }),
  ])
  expect([rt.status(), rs.status()]).toEqual([200, 200])
  const [plan2, addons2] = estadoDb().split('|')
  expect([plan2, addons2]).toEqual(['operacion', ''])
})

test('limpieza: el tenant queda como estaba al empezar', () => {
  limpiarPedidos()
  expect(lineas(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BID} AND client_name LIKE 'ZZA Planes %'`))).toEqual(['0'])
})
