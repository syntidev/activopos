import fs from 'fs'
import http from 'http'
import path from 'path'
import { execSync } from 'child_process'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Admin › plantillas por negocio (superadmin), URL pública única /c/[slug], asistente "Nuevo negocio" y seed de demos.
 * Puerto 3001 (carpeta activopos). Datos de prueba con prefijo ZZA: negocios zza-pl-*; se borran por la API admin al final.
 * Los demos (demo-*) son el entregable del seed: se conservan.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const TAG = String(Date.now()).slice(-6)
const SLUG = `zza-pl-${TAG}`
const SLUG_UI = `zza-ui-${TAG}`
const OWN = ownBusiness() // negocio de prueba propio (E2E_BUSINESS_ID); nunca se usa el 80 para escribir
const CARTA_EXISTS = fs.existsSync(path.resolve('src', 'app', 'catalogo-carta'))

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let superId = 0
let superBiz = 0
let sa: APIRequestContext
let bizId = 0
let uiBizId = 0
const toDelete: number[] = []

const tokenFor = (userId: number, businessId: number, role: string) => new SignJWT({ userId, businessId, role, name: 'ZZA Prueba' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const ctxFor = async (userId: number, businessId: number, role: string): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId, businessId, role)}` } })

const conteoDemos = (): string => sql(
  "SELECT CONCAT_WS('|',(SELECT COUNT(*) FROM businesses WHERE catalog_slug LIKE 'demo-%')," +
  "(SELECT COUNT(*) FROM products p JOIN businesses b ON b.id=p.business_id WHERE b.catalog_slug LIKE 'demo-%')," +
  "(SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id=v.product_id JOIN businesses b ON b.id=p.business_id WHERE b.catalog_slug LIKE 'demo-%')," +
  "(SELECT COUNT(*) FROM users u JOIN businesses b ON b.id=u.business_id WHERE b.catalog_slug LIKE 'demo-%'))",
)

test.beforeAll(async () => {
  const row = sql("SELECT CONCAT(id,'|',business_id) FROM users WHERE role='super_admin' ORDER BY id LIMIT 1")
  expect(row, 'hace falta un super_admin en la DB local').not.toBe('')
  ;[superId, superBiz] = row.split('|').map(Number)
  sa = await ctxFor(superId, superBiz, 'super_admin')
})

test.afterAll(async () => {
  for (const id of toDelete) await sa?.delete(`/api/admin/tenants/${id}`)
  await sa?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM businesses WHERE catalog_slug LIKE 'zza-%' AND catalog_slug<>'zza-pruebas'`))).toBe(0)
})

test('asistente (API): crea un negocio generic por la vía única; credenciales una vez; enlace /c/slug', async () => {
  const email = `zza-pl-${TAG}@zza.test`
  const r = await sa.post('/api/admin/tenants', { data: {
    business_name: `ZZA Plantilla ${TAG}`, slug: SLUG, rubro: 'boutique', template: 'generic',
    collect_in: 'both', cashea: false, divisa: false, admin_name: 'ZZA Admin', admin_email: email,
  } })
  expect(r.status(), await r.text()).toBe(201)
  const j = (await r.json()) as { business_id: number; public_url: string; admin_email: string; admin_password: string }
  expect(j.public_url).toBe(`/c/${SLUG}`)
  expect(j.admin_password.length).toBeGreaterThanOrEqual(8)
  bizId = j.business_id
  toDelete.push(bizId)
  // la contraseña no se guarda en claro ni en el log de auditoría
  expect(sql(`SELECT password FROM users WHERE email='${email}'`)).not.toBe(j.admin_password)
  expect(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${bizId} AND new_values LIKE '%${j.admin_password}%'`)).toBe('0')
  expect(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${bizId} AND action='tenant_created_by_admin' AND user_id=${superId}`)).toBe('1')
  // y esas credenciales sirven para entrar
  const login = await pwRequest.newContext({ baseURL: BASE })
  expect((await login.post('/api/auth/login', { data: { email, password: j.admin_password } })).status()).toBe(200)
  await login.dispose()
  // slug repetido: 409 por la misma vía
  const dup = await sa.post('/api/admin/tenants', { data: { business_name: 'ZZA Dup', slug: SLUG, rubro: 'x', template: 'generic', admin_name: 'ZZA Dup', admin_email: `dup-${email}` } })
  expect(dup.status()).toBe(409)
  // un producto visible para comprobar que la plantilla sirve contenido
  const adminId = Number(sql(`SELECT id FROM users WHERE email='${email}'`))
  const adm = await ctxFor(adminId, bizId, 'admin')
  const p = await adm.post('/api/products', { data: { name: `ZZA Producto ${TAG}`, cost_per_unit_usd: 5, price_per_unit_usd: 20, is_fixed_price: true, stock_quantity: 10, catalog_visibility: 'visible' } })
  expect(p.status(), await p.text()).toBe(201)
  await adm.dispose()
})

test('no superadmin recibe 403 (admin y cajero) en plantilla y asistente; sin sesión no entra', async () => {
  const adminCtx = await ctxFor(OWN.adminId, OWN.businessId, 'admin')
  expect((await adminCtx.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' }, maxRedirects: 0 })).status()).toBe(403)
  expect((await adminCtx.get(`/api/admin/tenants/${bizId}/plantilla`, { maxRedirects: 0 })).status()).toBe(403)
  expect((await adminCtx.post('/api/admin/tenants', { data: { business_name: 'ZZA X' }, maxRedirects: 0 })).status()).toBe(403)
  await adminCtx.dispose()
  const cashierId = Number(sql(`SELECT id FROM users WHERE business_id=${OWN.businessId} AND role='cashier' LIMIT 1`) || '0')
  if (cashierId > 0) {
    const c = await ctxFor(cashierId, OWN.businessId, 'cashier')
    expect((await c.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' }, maxRedirects: 0 })).status()).toBe(403)
    await c.dispose()
  }
  const anon = await pwRequest.newContext({ baseURL: BASE })
  expect((await anon.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' }, maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300)
  await anon.dispose()
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${bizId}`)).toBe('generic') // nada cambió
})

test('zod estricto: clave desconocida, preset "Próximamente", carta_* sin carta y plantilla inválida dan 400', async () => {
  const bad = async (data: Record<string, unknown>) => (await sa.patch(`/api/admin/tenants/${bizId}/plantilla`, { data })).status()
  expect(await bad({ template: 'premium', business_id: 1 })).toBe(400)
  expect(await bad({ template: 'carta', carta_preset: 'cafe' })).toBe(400)
  expect(await bad({ template: 'carta', carta_preset: 'mar' })).toBe(400)
  expect(await bad({ template: 'premium', carta_style: 'fine' })).toBe(400)
  expect(await bad({ template: 'restaurante' })).toBe(400)
  expect(await bad({})).toBe(400)
  expect((await sa.patch('/api/admin/tenants/abc/plantilla', { data: { template: 'premium' } })).status()).toBe(400)
  expect((await sa.patch('/api/admin/tenants/999999999/plantilla', { data: { template: 'premium' } })).status()).toBe(404)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${bizId}`)).toBe('generic')
})

test('el superadmin cambia la plantilla y la MISMA URL /c/slug sirve la nueva (generic → premium → carta → premium)', async ({ page }) => {
  const final = async (): Promise<string> => { await page.goto(`/c/${SLUG}`); return new URL(page.url()).pathname }

  // generic
  expect(await final()).toBe(`/catalogo/${SLUG}`)
  await expect(page.getByText(`ZZA Producto ${TAG}`).first()).toBeVisible()

  // premium
  let r = await sa.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' } })
  expect(r.status(), await r.text()).toBe(200)
  expect(((await r.json()) as { public_url: string }).public_url).toBe(`/c/${SLUG}`) // el enlace no cambió
  expect(await final()).toBe(`/catalogo-premium/${SLUG}`)
  await expect(page.getByText(`ZZA Producto ${TAG}`).first()).toBeVisible()
  await page.screenshot({ path: 'tests/__capturas__/zza-plantilla-premium-1280.png' })

  // carta + preset + estilo (claves de la plantilla Carta)
  r = await sa.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'carta', carta_preset: 'noche', carta_style: 'fine' } })
  expect(r.status(), await r.text()).toBe(200)
  expect(sql(`SELECT CONCAT(catalog_template,'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_preset')),'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_style'))) FROM businesses WHERE id=${bizId}`)).toBe('carta|noche|fine')
  expect(await final()).toBe(CARTA_EXISTS ? `/catalogo-carta/${SLUG}` : `/catalogo/${SLUG}`) // sin la ruta de la carta, se sirve la genérica
  await expect(page.getByText(`ZZA Producto ${TAG}`).first()).toBeVisible()

  // volver a premium conserva carta_* (por si regresan a la carta) y el enlace sigue igual
  r = await sa.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' } })
  expect(r.status()).toBe(200)
  expect(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_preset')) FROM businesses WHERE id=${bizId}`)).toBe('noche')
  expect(await final()).toBe(`/catalogo-premium/${SLUG}`)

  // auditoría: quién, qué y cuándo
  expect(sql(`SELECT COUNT(*) FROM activity_logs WHERE business_id=${bizId} AND action='plantilla_updated' AND user_id=${superId} AND created_at IS NOT NULL`)).toBe('3')
})

test('resolver /c: subrutas y query se conservan; slug inválido o inexistente da 404', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE })
  const get = (p: string) => anon.get(p, { maxRedirects: 0 })
  const a = await get(`/c/${SLUG}/productos?q=zza`)
  expect(a.status()).toBe(307)
  expect(a.headers().location).toBe(`/catalogo-premium/${SLUG}/productos?q=zza`)
  const b = await get(`/c/${SLUG}/p/123`)
  expect(b.headers().location).toBe(`/catalogo-premium/${SLUG}/p/123`)
  expect((await get('/c/no-existe-zza-xyz')).status()).toBe(404)
  expect((await get('/c/Mayus_Invalido')).status()).toBe(404)
  // '..' no se redirige (el navegador lo normalizaría a otra ruta). Petición cruda: el cliente de Playwright normaliza %2e%2e antes de enviar.
  const raw = (p: string): Promise<number> => new Promise(resolve => { http.get({ host: 'localhost', port: Number(new URL(BASE).port), path: p }, r => { r.resume(); resolve(r.statusCode ?? 0) }) })
  expect(await raw(`/c/${SLUG}/%2e%2e/%2e%2e/login`)).toBe(404)
  expect((await get(`/c/${SLUG}/a/b/c/d/e/f/g`)).status()).toBe(404) // profundidad acotada
  await anon.dispose()
})

test('asistente (UI): crea un negocio con plantilla carta, muestra enlace y credenciales una vez, y el enlace abre', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(superId, superBiz, 'super_admin'), url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/businesses')
  await page.getByTestId('nuevo-negocio-link').click()
  await expect(page.getByTestId('nuevo-form')).toBeVisible()

  await page.getByLabel('Nombre del negocio').fill(`ZZA Carta ${TAG}`)
  await expect(page.getByLabel('Slug (enlace /c/…)')).toHaveValue(`zza-carta-${TAG}`)
  await page.getByLabel('Slug (enlace /c/…)').fill(SLUG_UI)
  await page.getByLabel('Rubro').fill('restaurante')
  await page.getByLabel('Plantilla').selectOption('carta')
  // presets "Próximamente" deshabilitados
  const presetSel = page.getByLabel('Preset de la carta')
  await expect(presetSel.locator('option[value="cafe"]')).toBeDisabled()
  await expect(presetSel.locator('option[value="cafe"]')).toContainText('Próximamente')
  await expect(presetSel.locator('option[value="brasa"]')).toBeEnabled()
  await presetSel.selectOption('noche')
  await page.getByLabel('Estilo de la carta').selectOption('fine')
  await page.getByLabel('Cobra en').selectOption('both')
  await page.getByLabel('Usuario admin: nombre').fill('ZZA Dueño')
  await page.getByLabel('Usuario admin: correo').fill(`zza-ui-${TAG}@zza.test`)
  await page.screenshot({ path: 'tests/__capturas__/zza-asistente-1280.png', fullPage: true })
  await page.getByRole('button', { name: 'Crear negocio' }).click()

  const res = page.getByTestId('nuevo-resultado')
  await expect(res).toBeVisible()
  await expect(page.getByTestId('nuevo-url')).toHaveText(`/c/${SLUG_UI}`)
  const pass = (await page.getByTestId('nuevo-password').textContent()) ?? ''
  expect(pass.length).toBeGreaterThanOrEqual(8)
  await page.screenshot({ path: 'tests/__capturas__/zza-asistente-credenciales-1280.png' })
  uiBizId = Number(sql(`SELECT id FROM businesses WHERE catalog_slug='${SLUG_UI}'`))
  expect(uiBizId).toBeGreaterThan(0)
  toDelete.push(uiBizId)
  expect(sql(`SELECT CONCAT(catalog_template,'|',catalog_plan,'|',catalog_active,'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_preset')),'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_style'))) FROM businesses WHERE id=${uiBizId}`)).toBe('carta|negocio_activo|1|noche|fine')

  // credenciales válidas y enlace abierto (la carta o su sustituto mientras la ruta de la carta no esté en el código)
  const login = await pwRequest.newContext({ baseURL: BASE })
  expect((await login.post('/api/auth/login', { data: { email: `zza-ui-${TAG}@zza.test`, password: pass } })).status()).toBe(200)
  await login.dispose()
  const open = await page.goto(`/c/${SLUG_UI}`)
  expect(open?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe(CARTA_EXISTS ? `/catalogo-carta/${SLUG_UI}` : `/catalogo/${SLUG_UI}`)
  // al recargar la pantalla, la contraseña no vuelve a mostrarse
  await page.goto('/businesses/nuevo')
  await expect(page.getByTestId('nuevo-password')).toHaveCount(0)
})

test('detalle del negocio: el selector de plantilla guarda y muestra el enlace único', async ({ page }) => {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(superId, superBiz, 'super_admin'), url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/businesses/${bizId}`)
  const picker = page.getByTestId('plantilla-picker')
  await expect(picker).toBeVisible()
  await expect(picker.getByTestId('plantilla-public-url')).toHaveText(`/c/${SLUG}`)
  await picker.getByLabel('Plantilla').selectOption('carta')
  await expect(picker.getByLabel('Preset de la carta').locator('option[value="verde"]')).toBeDisabled()
  await picker.getByLabel('Preset de la carta').selectOption('brasa')
  await picker.getByLabel('Estilo de la carta').selectOption('casual')
  await picker.getByRole('button', { name: 'Guardar plantilla' }).click()
  await expect(picker.getByRole('status')).toContainText('Plantilla guardada')
  expect(sql(`SELECT CONCAT(catalog_template,'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.carta_preset')))  FROM businesses WHERE id=${bizId}`)).toBe('carta|brasa')
  await page.screenshot({ path: 'tests/__capturas__/zza-detalle-plantilla-1280.png', fullPage: true })
  await sa.patch(`/api/admin/tenants/${bizId}/plantilla`, { data: { template: 'premium' } })
})

test('seed-demos dos veces no duplica; los tres enlaces únicos abren', async ({ page }) => {
  execSync('npm run seed:demos', { stdio: 'pipe', timeout: 120_000 })
  const antes = conteoDemos()
  const out = execSync('npm run seed:demos', { stdio: 'pipe', timeout: 120_000 }).toString()
  expect(conteoDemos()).toBe(antes)
  expect(out).not.toContain('creado')
  const [negocios] = antes.split('|').map(Number)
  expect(negocios).toBe(3)

  const esperado: Record<string, string> = {
    'demo-tienda':  '/catalogo/demo-tienda',
    'demo-premium': '/catalogo-premium/demo-premium',
    'demo-carta':   CARTA_EXISTS ? '/catalogo-carta/demo-carta' : '/catalogo/demo-carta',
  }
  for (const [slug, finalPath] of Object.entries(esperado)) {
    const r = await page.goto(`/c/${slug}`)
    expect(r?.status(), slug).toBe(200)
    expect(new URL(page.url()).pathname).toBe(finalPath)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/c/demo-premium')
  await page.screenshot({ path: 'tests/__capturas__/zza-demo-premium-1280.png' })
  await page.goto('/c/demo-carta')
  await page.screenshot({ path: 'tests/__capturas__/zza-demo-carta-1280.png' })
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/c/demo-carta')
  await page.screenshot({ path: 'tests/__capturas__/zza-demo-carta-375.png' })
})

test('regresión: las rutas viejas siguen funcionando (OnBike premium, boutique genérica)', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE })
  const onbike = sql("SELECT catalog_slug FROM businesses WHERE id=87")
  expect((await anon.get(`/catalogo-premium/${onbike}`)).status()).toBe(200)
  expect((await anon.get('/catalogo/boutique-demo')).status()).toBe(200)
  expect((await anon.get('/catalogo-premium/demo-premium')).status()).toBe(200)
  await anon.dispose()
})

test('regresión del refactor: el registro público (/api/onboarding/setup) sigue creando por la misma vía', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE })
  const slug = `zza-ob-${TAG}`
  const payload = {
    owner_name: 'ZZA Registro', business_name: `ZZA Registro ${TAG}`, business_slug: slug, email: `Zza-Ob-${TAG}@zza.test`,
    password: 'Test12345!', business_type: 'cafeteria', categories: ['Bebidas'],
    paymentMethods: [{ type: 'binance', detail: 'zza-id' }, { type: 'zelle', email: 'zza@zza.test' }],
  }
  const r = await anon.post('/api/onboarding/setup', { data: payload })
  // límite existente: 3 registros por hora por IP (en memoria). Si el servidor ya lo agotó, se reinicia el servidor de prueba.
  test.skip(r.status() === 429, 'onboardingLimiter agotado (3/hora): reinicia el servidor y repite')
  expect(r.status(), await r.text()).toBe(201)
  const j = (await r.json()) as { ok: boolean; business_id: number; user_id: number }
  toDelete.push(j.business_id)
  expect(j.ok).toBe(true)
  // mismo resultado de siempre: email normalizado, catálogo apagado, producto de muestra, 4 medios base + binance, categoría, cobro_data
  expect(sql(`SELECT CONCAT(email,'|',catalog_active,'|',catalog_template,'|',segment) FROM businesses WHERE id=${j.business_id}`)).toBe(`zza-ob-${TAG}@zza.test|0|generic|cafeteria`)
  expect(sql(`SELECT name FROM products WHERE business_id=${j.business_id}`)).toBe('Café con Leche')
  expect(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${j.business_id}`)).toBe('5')
  expect(sql(`SELECT COUNT(*) FROM categories WHERE business_id=${j.business_id} AND name='Bebidas'`)).toBe('1')
  expect(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(cobro_data,'$.binance_id')) FROM businesses WHERE id=${j.business_id}`)).toBe('zza-id')
  expect(sql(`SELECT role FROM users WHERE id=${j.user_id}`)).toBe('admin')
  // errores de siempre
  const dupSlug = await anon.post('/api/onboarding/setup', { data: { ...payload, email: `otro-${TAG}@zza.test` } })
  expect(dupSlug.status()).toBe(409)
  expect(((await dupSlug.json()) as { field: string }).field).toBe('business_slug')
  const dupMail = await anon.post('/api/onboarding/setup', { data: { ...payload, business_slug: `${slug}-b` } })
  expect(dupMail.status()).toBe(409)
  expect(((await dupMail.json()) as { field: string }).field).toBe('email')
  await anon.dispose()
})
