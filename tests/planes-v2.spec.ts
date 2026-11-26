import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'
import { ADDON_KEYS, BILLING_CYCLES, PLAN_TIER_KEYS, PRICES_PUBLISHED, WORKING_ADDON_CYCLES, WORKING_BILLING_CYCLES, isPaidPlan, parseAddons } from '../src/lib/plan-limits'

/**
 * Planes v2 (backend): derecho (plan + add-on) × preferencia (modules_enabled) × estado de cuenta, aplicado al USAR el KDS en el servidor.
 *
 * Tenant propio ZZA (CLI-A = 216): su plan, add-ons, suscripción y módulos se tocan y se restauran al estado base al final.
 * Convención de tenants y puertos: .doc/CONVENCION_Tenants_de_Prueba.md.
 *
 * E2E_BASE_URL es OBLIGATORIA, sin valor por defecto: esta spec ESCRIBE en la DB (plan, add-ons, suscripción de un tenant) y un puerto
 * por defecto puede ser el servidor de OTRA carpeta/CLI, que usa otro código y otras reglas contra la misma base. Hay que apuntar
 * explícitamente al servidor de ESTA carpeta, p. ej.:  E2E_BASE_URL=http://localhost:3001 npx playwright test tests/planes-v2.spec.ts
 */
const BASE = process.env.E2E_BASE_URL ?? ''
if (!BASE) {
  throw new Error(
    'planes-v2.spec: falta E2E_BASE_URL. Defínela con el servidor de ESTA carpeta (CLI-A suele usar http://localhost:3001; ' +
    'el :3000 y otros pueden ser de otra carpeta). Ejemplo: E2E_BASE_URL=http://localhost:3001 npx playwright test tests/planes-v2.spec.ts. ' +
    'No hay valor por defecto porque esta spec modifica el plan y los add-ons de un tenant en la base compartida.',
  )
}
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
const logsPlan = (): number => Number(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${BID} AND model_type='Business' AND model_id=${BID} AND action='plan_updated'`))
const ultimoPlanLog = (): { old: Record<string, unknown>; new: Record<string, unknown>; user: number } => {
  const r = sql(`SELECT JSON_OBJECT('old',old_values,'new',new_values,'user',user_id) FROM activity_logs WHERE business_id=${BID} AND action='plan_updated' ORDER BY id DESC LIMIT 1`)
  return JSON.parse(r) as { old: Record<string, unknown>; new: Record<string, unknown>; user: number }
}
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
  sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND model_type='Business' AND model_id=${BID} AND action IN ('addon_updated','plan_updated')`)
  // Estado BASE del tenant ZZA (el que necesitan las demás specs: Finanzas, crédito, etc.), NO "lo que se encontró": una corrida anterior
  // fallida puede haberlo dejado en gratis/suspendido y restaurar eso envenenaría a las specs siguientes. Solo modules_enabled se devuelve tal cual.
  sql(`UPDATE businesses SET catalog_plan='negocio_activo', addons='', modules_enabled='${original.modules}', subscription_active=1, subscription_expires_at=NULL WHERE id=${BID}`)
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
          // el add-on es complemento de un plan PAGO: gratis + add-on = sin derecho
          const derecho = sub === 'vigente' && (plan === 'operacion' || (addon && plan !== 'gratis'))
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

test('PATCH de módulos: activar kds exige el derecho (plan o add-on de un plan pago); apagar siempre se puede; restaurante NO es un módulo', async () => {
  const modulos = (...extra: string[]) => ({ modules: ['pos', 'inventory', 'caja', ...extra] })
  setState({ plan: 'negocio_activo', addon: false, pref: false, sub: 'vigente' })
  const sin = await tenant.patch('/api/config/business/modules', { data: modulos('kds') })
  expect(sin.status()).toBe(403)
  expect(await sin.json()).toMatchObject({ code: 'PLAN_LIMIT' })
  expect(estadoDb().split('|')[2], 'un PATCH rechazado no escribe nada').toBe(BASE_MODULES)

  setState({ plan: 'negocio_activo', addon: true, pref: false, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('kds') })).status()).toBe(200)
  expect(estadoDb().split('|')[2]).toContain('kds')

  setState({ plan: 'operacion', addon: false, pref: false, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: modulos('kds') })).status()).toBe(200)

  // 'restaurante' ya no es un módulo de modules_enabled (es un derecho; su preferencia será restaurante_enabled): 400 para TODOS los niveles
  for (const plan of ['gratis', 'negocio_activo', 'operacion'] as const) {
    setState({ plan, addon: true, pref: false, sub: 'vigente' })
    const r = await tenant.patch('/api/config/business/modules', { data: modulos('restaurante') })
    expect(r.status(), `restaurante en ${plan}`).toBe(400)
    expect(estadoDb().split('|')[2], 'y nunca entra a modules_enabled').not.toContain('restaurante')
  }
  setState({ plan: 'operacion', addon: false, pref: false, sub: 'vigente' })
  expect(((await (await tenant.get('/api/config/business/modules')).json()) as { allowed_modules: string[] }).allowed_modules).not.toContain('restaurante')

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

test("ActivityLog 'plan_updated' (old/new) solo cuando cambia el plan, la suspensión o el vencimiento", async () => {
  setState({ plan: 'negocio_activo', addon: false, pref: true, sub: 'vigente' })
  const n0 = logsPlan()

  // sin cambios de derecho de cuenta → sin log (aunque se reenvíe el mismo estado, cambie el catálogo o los add-ons)
  expect((await planPatch({ plan: 'negocio_activo' })).status()).toBe(200)
  expect((await planPatch({ plan: 'negocio_activo', catalog_active: true })).status()).toBe(200)
  expect((await planPatch({ plan: 'negocio_activo', addons: ['kds'] })).status()).toBe(200)
  expect(logsPlan(), 'catálogo/add-ons no son un cambio de plan').toBe(n0)

  // cambia el plan
  expect((await planPatch({ plan: 'operacion' })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 1)
  const a = ultimoPlanLog()
  expect(a.old).toEqual({ catalog_plan: 'negocio_activo', subscription_active: true, subscription_expires_at: null })
  expect(a.new).toEqual({ catalog_plan: 'operacion', subscription_active: true, subscription_expires_at: null })
  expect(a.user, 'queda quién lo hizo').toBe(ADMIN)

  // cambia el vencimiento
  expect((await planPatch({ plan: 'operacion', expires_at: '2027-01-15' })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 2)
  expect(ultimoPlanLog()).toMatchObject({ old: { subscription_expires_at: null }, new: { subscription_expires_at: '2027-01-15' } })
  // reenviar la misma fecha no registra nada; quitarla sí
  expect((await planPatch({ plan: 'operacion', expires_at: '2027-01-15' })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 2)
  expect((await planPatch({ plan: 'operacion', expires_at: null })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 3)
  expect(ultimoPlanLog()).toMatchObject({ old: { subscription_expires_at: '2027-01-15' }, new: { subscription_expires_at: null } })

  // suspender y reactivar
  expect((await planPatch({ plan: 'operacion', status: 'suspended' })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 4)
  expect(ultimoPlanLog()).toMatchObject({ old: { subscription_active: true }, new: { subscription_active: false } })
  expect((await planPatch({ plan: 'operacion', status: 'active' })).status()).toBe(200)
  expect(logsPlan()).toBe(n0 + 5)

  // un PATCH inválido no deja log
  expect((await planPatch({ plan: 'platino' })).status()).toBe(400)
  expect(logsPlan()).toBe(n0 + 5)
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

test('gratis + add-on = SIN derecho: el KDS, el PATCH de módulos y los derechos lo niegan aunque el add-on esté guardado', async () => {
  setState({ plan: 'gratis', addon: true, pref: true, sub: 'vigente' })
  const kds = await tenant.get('/api/kds/orders')
  expect(kds.status()).toBe(403)
  expect(await kds.json()).toMatchObject({ code: 'PLAN_LIMIT' })
  const mods = (await (await tenant.get('/api/config/business/modules')).json()) as { entitlements: Record<string, boolean>; addons: string[] }
  expect(mods.entitlements).toEqual({ kds: false, restaurante: false })
  expect(mods.addons, 'el add-on sigue guardado (se activa solo al subir a un plan pago)').toEqual(['kds'])
  expect((await tenant.get('/kds', { maxRedirects: 0 })).status()).toBe(404)
  setState({ plan: 'gratis', addon: true, pref: false, sub: 'vigente' })
  expect((await tenant.patch('/api/config/business/modules', { data: { modules: ['pos', 'inventory', 'kds'] } })).status()).toBe(403)

  // el panel lo refleja: guardar add-on sobre gratis se permite pero el estado canónico dice sin derecho; al subir de plan se activa
  const g = await planPatch({ plan: 'gratis', addons: ['kds'] })
  expect((await g.json()).business).toMatchObject({ catalog_plan: 'gratis', addons: ['kds'], entitlements: { kds: false } })
  const up = await planPatch({ plan: 'negocio_activo', addons: ['kds'] })
  expect((await up.json()).business).toMatchObject({ catalog_plan: 'negocio_activo', entitlements: { kds: true } })
})

/* ── scripts/grant-addon.ts: lista EXPLÍCITA, dry-run por defecto, idempotente, ActivityLog por negocio ── */

// Node SIMPLE (como en el VPS): sin ts-node, sin dotenv, sin tsconfig-paths.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'grant-addon.cjs')
const grant = (...args: string[]) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: path.join(__dirname, '..'), encoding: 'utf-8', timeout: 120_000 })
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}
const conAddons = (): string => sql(`SELECT COUNT(*) FROM businesses WHERE addons<>'' AND id<>${BID}`)

test('script grant-addon: sin ids no hace nada; dry-run no escribe; --apply exige un super_admin; idempotente; omite gratis; solo toca los ids dados', async () => {
  setState({ plan: 'negocio_activo', addon: false, pref: true, sub: 'vigente' })
  const superId = sql(`SELECT id FROM users WHERE role='super_admin' ORDER BY id LIMIT 1`)
  expect(Number(superId), 'hace falta un super_admin en la DB local').toBeGreaterThan(0)
  const otros = conAddons()
  const logs0 = logsAddon()

  const sinIds = grant('--addon', 'kds', '--apply', '--by', superId)
  expect(sinIds.code).toBe(1)
  expect(sinIds.out).toContain('Sin ids')
  expect(grant('--addon', 'kds', '--ids', 'abc').code, 'ids no numéricos').toBe(1)
  expect(grant('--addon', 'cocina', '--ids', String(BID)).code, 'add-on desconocido').toBe(1)
  expect(estadoDb().split('|')[1]).toBe('')

  // dry-run (por defecto): informa, no escribe
  const dry = grant('--addon', 'kds', '--ids', `${BID},999999999`)
  expect(dry.code).toBe(0)
  expect(dry.out).toContain('DRY-RUN')
  expect(dry.out).toMatch(/would_grant/)
  expect(dry.out).toMatch(/#999999999\s+no existe/)
  // el dry-run imprime por id: nombre, plan, suscripción, vencimiento, si kds está en modules_enabled (y cero advertencias si todo está bien)
  expect(dry.out).toContain(`#${BID}  ${sql(`SELECT name FROM businesses WHERE id=${BID}`)}`)
  expect(dry.out).toContain('plan: negocio_activo | subscription_active: sí | subscription_expires_at: sin vencimiento')
  expect(dry.out).toContain('kds en modules_enabled: sí')
  expect(dry.out).not.toContain('⚠')
  expect(dry.out).toMatch(/Base de datos: .+ \/ .+/)
  expect(estadoDb().split('|')[1], 'dry-run no escribe').toBe('')
  expect(logsAddon()).toBe(logs0)

  // --apply exige --by de un super_admin real
  expect(grant('--addon', 'kds', '--ids', String(BID), '--apply').code).toBe(1)
  expect(grant('--addon', 'kds', '--ids', String(BID), '--apply', '--by', String(ADMIN)).code, 'un admin de negocio no basta').toBe(1)
  expect(estadoDb().split('|')[1]).toBe('')

  // aplicar: concede, un ActivityLog por negocio, y no toca ningún otro negocio
  const ok = grant('--addon', 'kds', '--ids', String(BID), '--apply', '--by', superId)
  expect(ok.code, ok.out).toBe(0)
  expect(ok.out).toContain('→ granted')
  expect(estadoDb().split('|')[1]).toBe('kds')
  expect(logsAddon()).toBe(logs0 + 1)
  expect(sql(`SELECT CONCAT(user_id,'|',JSON_EXTRACT(new_values,'$.source')) FROM activity_logs WHERE business_id=${BID} AND action='addon_updated' ORDER BY id DESC LIMIT 1`)).toBe(`${superId}|"scripts/grant-addon.cjs"`)
  expect(conAddons(), 'ningún otro negocio cambió').toBe(otros)
  // contexto nuevo: el script tardó segundos y la conexión keep-alive del `tenant` ya expiró (ECONNRESET al reusarla)
  await tenant.dispose()
  tenant = await ctx('admin')
  expect((await (await tenant.get('/api/config/business/modules')).json()).entitlements.kds).toBe(true)

  // idempotente: segunda vez no cambia ni registra
  const otra = grant('--addon', 'kds', '--ids', String(BID), '--apply', '--by', superId)
  expect(otra.out).toContain('→ already')
  expect(logsAddon()).toBe(logs0 + 1)

  // plan gratis: se omite (el add-on no concede derecho sobre gratis)
  setState({ plan: 'gratis', addon: false, pref: true, sub: 'vigente' })
  const gratis = grant('--addon', 'kds', '--ids', String(BID), '--apply', '--by', superId)
  expect(gratis.out).toContain('→ skipped_free')
  expect(estadoDb().split('|')[1]).toBe('')
})

test('script grant-addon: el dry-run advierte por id (plan gratis, suscripción vencida o suspendida, módulo apagado) y muestra las fechas', () => {
  const dry = () => grant('--addon', 'kds', '--ids', String(BID)).out

  setState({ plan: 'gratis', addon: false, pref: false, sub: 'vigente' })
  const g = dry()
  expect(g).toContain('plan: gratis')
  expect(g).toContain('⚠ plan gratis: el add-on NO concede derecho sobre gratis')
  expect(g).toContain('⚠ kds apagado en modules_enabled')
  expect(g).not.toContain('suscripción vencida')

  setState({ plan: 'operacion', addon: false, pref: true, sub: 'vencida' })
  const v = dry()
  const ayer = sql(`SELECT DATE(subscription_expires_at) FROM businesses WHERE id=${BID}`)
  expect(v).toContain(`subscription_expires_at: ${ayer}`)
  expect(v).toContain(`⚠ suscripción vencida el ${ayer}`)
  expect(v).not.toContain('kds apagado')

  setState({ plan: 'negocio_activo', addon: false, pref: true, sub: 'suspendida' })
  const s = dry()
  expect(s).toContain('subscription_active: NO')
  expect(s).toContain('⚠ suscripción suspendida')
  expect(estadoDb().split('|')[1], 'ningún dry-run escribe').toBe('')
})

test('script grant-addon: es Node simple y no se desalinea de plan-limits (add-ons, planes de pago, parseo)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const g = require('../scripts/grant-addon.cjs') as { ADDON_KEYS: string[]; PAID_PLANS: string[]; parseAddons: (s: string) => string[] }
  expect(g.ADDON_KEYS).toEqual([...ADDON_KEYS])
  expect(g.PAID_PLANS).toEqual(PLAN_TIER_KEYS.filter(isPaidPlan))
  expect(g.parseAddons('kds, cocina ,kds,')).toEqual(parseAddons('kds, cocina ,kds,'))
  const fuente = fs.readFileSync(SCRIPT, 'utf-8')
  expect(fuente, 'solo dependencias de producción').not.toMatch(/require\(['"](ts-node|dotenv|tsconfig-paths)/)
  expect(fuente, 'sin imports de TypeScript ni de src/').not.toMatch(/\bimport\b.+from|require\(['"]\.\.?\/src/)
  expect(fuente, 'sin ids fijos de producción en el código').not.toMatch(/ids\s*=\s*\[|\[\s*4\s*,\s*8\s*,\s*33\s*,\s*55\s*\]/)
})

test('limpieza: el tenant queda como estaba al empezar', () => {
  limpiarPedidos()
  expect(lineas(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BID} AND client_name LIKE 'ZZA Planes %'`))).toEqual(['0'])
})
