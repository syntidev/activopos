import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'

/**
 * Restaurante R1 — plano, áreas y mesas.
 * Corre SOLO contra la base activopos_kds (se verifica antes de tocar nada) y crea sus propios negocios ZZ.
 * Servidor: E2E_BASE_URL (por defecto http://localhost:3000). Sesión: JWT firmado con el JWT_SECRET del .env.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const ENV_FILE = path.join(__dirname, '..', '.env')
const CAPTURAS = path.join(__dirname, '..', '.doc', 'restaurante', 'r1')

function envValue(key: string): string {
  const line = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} no está en .env`)
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

const DB = (envValue('DATABASE_URL').match(/\/([^/?]+)(\?|$)/) ?? [])[1] ?? ''
function sql(query: string): string {
  if (DB !== 'activopos_kds') throw new Error(`Este spec solo corre contra activopos_kds (la base del .env es "${DB}")`)
  return execFileSync('mysql', ['-uroot', '-h127.0.0.1', '--default-character-set=utf8mb4', '-N', '-B', DB, '-e', query], { encoding: 'utf8' }).trim()
}

type Slug = 'zzkds-a' | 'zzkds-b' | 'zzkds-c'
function businessId(slug: Slug): number { return Number(sql(`SELECT id FROM businesses WHERE catalog_slug='${slug}'`)) }

function ensureBusiness(slug: Slug, restaurante: boolean): number {
  if (!businessId(slug)) {
    sql(`INSERT INTO businesses (name,email,catalog_slug,catalog_active,catalog_title,onboarding_completed,segment,catalog_plan,catalog_template,settings,updated_at)
         VALUES ('ZZ KDS ${slug}','${slug}@zzkds.test','${slug}',1,'ZZ KDS ${slug}',1,'pruebas','negocio_activo','generic','{}',NOW(3))`)
  }
  const id = businessId(slug)
  sql(`DELETE FROM floor_elements WHERE business_id=${id}`)
  sql(`DELETE FROM dining_tables WHERE business_id=${id}`)
  sql(`DELETE FROM service_areas WHERE business_id=${id}`)
  sql(`UPDATE businesses SET restaurante_enabled=${restaurante ? 1 : 0} WHERE id=${id}`)
  return id
}

async function login(context: BrowserContext, bid: number, role: 'admin' | 'cashier'): Promise<void> {
  const token = await new SignJWT({ userId: 1, businessId: bid, role, name: `ZZ ${role}` })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await context.clearCookies()
  await context.addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

interface TableRow { id: number; label: string; pos_x: number; pos_y: number; area_name: string }
async function listTables(page: Page, q?: string): Promise<TableRow[]> {
  const res = await page.request.get(`${BASE}/api/restaurante/mesas${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  expect(res.status()).toBe(200)
  return ((await res.json()) as { tables: TableRow[] }).tables
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
}

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

let A = 0, B = 0, C = 0

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  B = ensureBusiness('zzkds-b', true)
  C = ensureBusiness('zzkds-c', false)
})

test('1 · sin flag: la página, el link y la API no existen', async ({ page, context }) => {
  await login(context, C, 'admin')
  expect((await page.request.get(`${BASE}/restaurante/mesas`)).status()).toBe(404)
  expect((await page.request.get(`${BASE}/configuracion/restaurante`)).status()).toBe(404)

  await page.goto('/escritorio')
  await expect(page.getByRole('link', { name: 'Plano' })).toHaveCount(0)

  expect((await page.request.get(`${BASE}/api/restaurante/mesas`)).status()).toBe(404)
  expect((await page.request.post(`${BASE}/api/restaurante/areas`, { data: { name: 'X' } })).status()).toBe(404)
})

test('2 · con flag: crear área y 3 mesas, arrastrar una y conservar la posición al recargar', async ({ page, context }) => {
  await login(context, A, 'admin')

  await page.goto('/configuracion/restaurante')
  await page.getByLabel('Nueva área').fill('Salón')
  await page.getByRole('button', { name: 'Crear área' }).click()
  await expect(page.getByText('Salón').first()).toBeVisible()

  await page.getByLabel('Del número').fill('1')
  await page.getByLabel('Al número').fill('3')
  await page.getByRole('button', { name: 'Crear 3 mesas' }).click()
  await expect.poll(async () => (await listTables(page)).length).toBe(3)

  const before = (await listTables(page)).find(t => t.label === '1')!

  await page.goto('/restaurante/mesas')
  await expect(page.getByRole('link', { name: 'Plano' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Editar plano' }).click()

  const svg = page.getByRole('group', { name: /Editor del plano/ })
  const box = (await svg.boundingBox())!
  const cols = Number((await svg.getAttribute('viewBox'))!.split(' ')[2])
  const cell = box.width / cols
  const mesa1 = page.getByRole('button', { name: /^Mesa 1,/ })
  const m = (await mesa1.boundingBox())!
  const from = { x: m.x + m.width / 2, y: m.y + m.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + cell * 2, from.y + cell * 3, { steps: 8 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Guardar plano' }).click()
  await expect(page.getByRole('button', { name: 'Editar plano' })).toBeVisible()

  await page.reload()
  const after = (await listTables(page)).find(t => t.label === '1')!
  expect(after.pos_x).toBe(before.pos_x + 2)
  expect(after.pos_y).toBe(before.pos_y + 3)
})

test('3 · la búsqueda "salon 2" filtra la mesa 2 del área Salón', async ({ page, context }) => {
  await login(context, A, 'admin')
  const found = await listTables(page, 'salon 2')
  expect(found.map(t => t.label)).toEqual(['2'])
  expect(found[0].area_name).toBe('Salón')

  await page.goto('/restaurante/mesas')
  await page.getByLabel('Buscar mesa').fill('salon 2')
  await expect(page.getByRole('button', { name: /^Mesa 2,/ })).toHaveCSS('opacity', '1')
  await expect(page.getByRole('button', { name: /^Mesa 1,/ })).not.toHaveCSS('opacity', '1')

  const bad = await page.request.get(`${BASE}/api/restaurante/mesas?q=${encodeURIComponent('x'.repeat(61))}`)
  expect(bad.status()).toBe(400)
})

test('4 · el cajero no crea mesas (403) y el negocio B no ve las del A', async ({ page, context }) => {
  await login(context, A, 'cashier')
  const area = (await (await page.request.get(`${BASE}/api/restaurante/areas`)).json() as { areas: { id: number }[] }).areas[0]
  const tableId = (await listTables(page))[0].id
  expect((await page.request.post(`${BASE}/api/restaurante/mesas`, { data: { area_id: area.id, label: '99' } })).status()).toBe(403)
  expect((await page.request.post(`${BASE}/api/restaurante/areas`, { data: { name: 'Nueva' } })).status()).toBe(403)
  expect((await page.request.patch(`${BASE}/api/restaurante/mesas/${tableId}`, { data: { pos_x: 9 } })).status()).toBe(403)
  // Las marcas manuales sí las puede hacer.
  expect((await page.request.patch(`${BASE}/api/restaurante/mesas/${tableId}`, { data: { cleaning_pending: true } })).status()).toBe(200)
  await page.request.patch(`${BASE}/api/restaurante/mesas/${tableId}`, { data: { cleaning_pending: false } })
  // Ni la cuenta ni el cajero entran a la configuración (middleware: ADMIN_ONLY).
  await page.goto('/configuracion/restaurante')
  expect(page.url()).toContain('/pos')

  await login(context, B, 'admin')
  expect(await listTables(page)).toHaveLength(0)
  expect((await page.request.patch(`${BASE}/api/restaurante/mesas/${tableId}`, { data: { label: 'robada' } })).status()).toBe(404)
  expect((await page.request.delete(`${BASE}/api/restaurante/mesas/${tableId}`)).status()).toBe(404)
  const forged = await page.request.post(`${BASE}/api/restaurante/mesas`, { data: { area_id: area.id, label: '7' } })
  expect(forged.status()).toBe(404) // el área es de otro negocio
})

for (const vp of [{ w: 1280, h: 800 }, { w: 375, h: 812 }]) {
  test(`5 · ${vp.w}px sin desborde horizontal y capturas`, async ({ page, context }) => {
    await login(context, A, 'admin')
    const tables = await listTables(page)
    await page.request.patch(`${BASE}/api/restaurante/mesas/${tables[1].id}`, { data: { cleaning_pending: true } })
    await page.request.patch(`${BASE}/api/restaurante/mesas/${tables[2].id}`, { data: { reserved_for: 'Rosa', reserved_at: new Date(2026, 10, 24, 20, 30).toISOString() } })
    await page.setViewportSize({ width: vp.w, height: vp.h })

    await page.goto('/restaurante/mesas')
    await expect(page.getByRole('heading', { name: 'Salón' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(CAPTURAS, `plano-${vp.w}.png`), fullPage: true })

    if (vp.w >= 760) {
      await page.getByRole('button', { name: 'Editar plano' }).click()
      await page.getByRole('button', { name: /^Mesa 2,/ }).click()
      expect(await noHorizontalOverflow(page)).toBe(true)
      await page.screenshot({ path: path.join(CAPTURAS, `editor-${vp.w}.png`), fullPage: true })
    } else {
      await page.getByRole('button', { name: /^Mesa 3,/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1') // termina la animación de entrada
      await page.screenshot({ path: path.join(CAPTURAS, `detalle-${vp.w}.png`) })
      await page.keyboard.press('Escape')
    }

    await page.goto('/configuracion/restaurante')
    await expect(page.getByRole('heading', { name: 'Salón: áreas, mesas y plano' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
    await page.screenshot({ path: path.join(CAPTURAS, `config-${vp.w}.png`), fullPage: true })
  })
}
