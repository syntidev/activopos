import { test, expect, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Kit 200K: corte de la franela (Dama/Caballero…). Negocio propio 217 (prefijo ZZB) con un combo de prueba.
 * Config VIEJA (sin franela_cortes) debe seguir válida con el default; el corte viaja como clave franela_<slug>; el servidor valida
 * corte y talla (400 claro); demanda separa por corte y ordena las tallas (XS…4XL, luego numéricas ascendentes).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let bid = 0
let kitId = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const OLD_CONFIG = `JSON_OBJECT('nombre_evento','ZZB Evento','fecha_texto','x','badge_hero','','seo_title','','seo_description','','activo',true,'mostrar_en_header',false)`

function limpiar(): void {
  q("DELETE FROM reservas WHERE business_id=@BID AND cliente_nombre LIKE 'ZZB %'")
}

test.beforeAll(() => {
  bid = ensureOwnBusiness()
  q("UPDATE businesses SET reservas_enabled=1, kit200k_config=" + OLD_CONFIG + " WHERE id=@BID")
  q("DELETE FROM products WHERE business_id=@BID AND name='ZZB Kit 200K'")
  q("INSERT INTO products (business_id, name, updated_at, price_per_unit_usd, product_type, active) VALUES (@BID, 'ZZB Kit 200K', NOW(3), 100, 'combo', 1)")
  kitId = Number(q("SELECT id FROM products WHERE business_id=@BID AND name='ZZB Kit 200K'"))
  limpiar()
})
test.afterAll(() => {
  limpiar()
  q("DELETE FROM products WHERE business_id=@BID AND name='ZZB Kit 200K'")
  q('UPDATE businesses SET reservas_enabled=0, kit200k_config=NULL WHERE id=@BID')
  ensureOwnBusiness()
})

let n = 0
const reservar = (request: APIRequestContext, kits: Record<string, string>[]) => {
  n += 1
  return request.post('/api/public/reservas/' + OWN_SLUG, {
    data: { cliente_nombre: 'ZZB Cliente ' + n, cliente_telefono: '04141110000', cliente_cedula: 'V-1234567' + (n % 10), cliente_correo: 'zzb' + n + '@example.com', kit_id: kitId, kits: kits.map(componentes_tallas => ({ componentes_tallas })) },
  })
}

test('config vieja (sin franela_cortes) sigue válida: GET público devuelve el default Dama/Caballero', async ({ request }) => {
  const res = await request.get('/api/public/kit-200k/' + OWN_SLUG)
  expect(res.status()).toBe(200)
  const body = await res.json() as { config: { activo: boolean; franela_cortes: { nombre: string; tallas: string[] }[] } }
  expect(body.config.activo).toBe(true) // no queda inválida ni apaga el kit
  expect(body.config.franela_cortes.map(c => c.nombre)).toEqual(['Dama', 'Caballero'])
  expect(body.config.franela_cortes[1].tallas).toEqual(['S', 'M', 'L', 'XL', 'XXL'])
})

test('pedido con kit Dama M + kit Caballero XXL → 2 reservas, cada una con su corte', async ({ request }) => {
  const res = await reservar(request, [{ maillot: 'L', franela_dama: 'M' }, { maillot: 'M', franela_caballero: 'XXL' }])
  expect(res.status(), await res.text()).toBe(201)
  const filas = q("SELECT JSON_EXTRACT(componentes_tallas,'$.franela_dama'), JSON_EXTRACT(componentes_tallas,'$.franela_caballero') FROM reservas WHERE business_id=@BID AND cliente_nombre LIKE 'ZZB %' ORDER BY id").split('\n')
  expect(filas).toHaveLength(2)
  expect(filas[0]).toContain('"M"')
  expect(filas[1]).toContain('"XXL"')
})

test('talla que no pertenece al corte, corte inexistente, dos cortes o clave vieja → 400 con mensaje claro', async ({ request }) => {
  const casos: [Record<string, string>, RegExp][] = [
    [{ maillot: 'L', franela_dama: 'XL' }, /talla XL no existe en el corte Dama/],
    [{ maillot: 'L', franela_ninos: 'M' }, /corte de franela elegido no existe/],
    [{ maillot: 'L', franela_dama: 'M', franela_caballero: 'M' }, /un corte de franela \(uno solo por kit\)/],
    [{ maillot: 'L', franela: 'M' }, /corte de franela elegido no existe/],
  ]
  for (const [kit, mensaje] of casos) {
    const res = await reservar(request, [kit])
    expect(res.status(), JSON.stringify(kit)).toBe(400)
    expect((await res.json() as { error: string }).error).toMatch(mensaje)
  }
})

test('demanda: separa por corte, etiqueta "Franela Dama" y ordena tallas (XS…4XL; niños 4,6,8,10,12,14)', async ({ request }) => {
  q("UPDATE businesses SET kit200k_config=JSON_SET(" + OLD_CONFIG + ",'$.franela_cortes',JSON_ARRAY(JSON_OBJECT('nombre','Dama','tallas',JSON_ARRAY('XS','S','M','L','XL','2XL','3XL','4XL')),JSON_OBJECT('nombre','Niño','tallas',JSON_ARRAY('4','6','8','10','12','14')))) WHERE id=@BID")
  limpiar()
  const dama = ['4XL', '3XL', '2XL', 'XL', 'L', 'XS'].map(t => ({ maillot: 'M', franela_dama: t }))
  const nino = ['10', '4', '14', '6', '12', '8'].map(t => ({ maillot: 'M', franela_nino: t }))
  const res = await reservar(request, [...dama, ...nino])
  expect(res.status(), await res.text()).toBe(201)

  const admin = Number(q("SELECT id FROM users WHERE business_id=@BID AND role='admin' ORDER BY id LIMIT 1"))
  const token = await new SignJWT({ userId: admin, businessId: bid, role: 'admin', name: 'ZZB Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  const d = await request.get('/api/reservas/demanda', { headers: { cookie: 'activopos_session=' + token } })
  expect(d.status()).toBe(200)
  const items = (await d.json() as { items: { componente: string | null; componente_label?: string | null; talla: string | null }[] }).items
  const tallasDe = (c: string) => items.filter(i => i.componente === c).map(i => i.talla)
  expect(tallasDe('franela_dama')).toEqual(['XS', 'L', 'XL', '2XL', '3XL', '4XL'])
  expect(tallasDe('franela_nino')).toEqual(['4', '6', '8', '10', '12', '14'])
  expect(items.find(i => i.componente === 'franela_dama')?.componente_label).toBe('Franela Dama')
  expect(items.find(i => i.componente === 'franela_nino')?.componente_label).toBe('Franela Niño')
})
