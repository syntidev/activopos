import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Tenant PROPIO de CLI-D: negocio 267 "ZZ D Pruebas" (admin 212, cajero 213). Los specs que abren/cierran caja o
 * crean ventas corren acá y NO en el 87 (OnBike Margarita, datos del cliente real). Misma forma que p0-helpers
 * (que sigue atado al 87 para los otros specs P0); se importa con los mismos nombres.
 */
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const BUSINESS_ID = 267
export const ADMIN_ID = 212
export const CASHIER_ID = 213
export const SLUG = 'zzd-pruebas'

/** Aborta si el negocio 267 no es un tenant de pruebas "ZZ D…": evita escribir en un negocio real por un id mal puesto. */
export function assertOwnTenant(): void {
  const name = sql(`SELECT name FROM businesses WHERE id=${BUSINESS_ID}`)
  if (!name.startsWith('ZZ D')) throw new Error(`El negocio ${BUSINESS_ID} ("${name}") no es el tenant de pruebas ZZ D: no se escribe en él`)
}

/** Toda sesión (JWT) pasa por acá: si el 267 no es "ZZ D…", ningún spec puede autenticarse contra él. */
export async function tokenFor(userId: number = ADMIN_ID, role = 'admin'): Promise<string> {
  assertOwnTenant()
  return new SignJWT({ userId, businessId: BUSINESS_ID, role, name: 'ZZ D Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

/** Sesión del navegador (cookie) como admin del 267. */
export async function login(page: Page, userId: number = ADMIN_ID): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(userId), url: BASE }])
}

/** Cliente de API con sesión admin del 267; `null` = sin sesión (público). */
export async function apiAs(userId: number | null = ADMIN_ID): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    ...(userId === null ? {} : { extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId)}` } }),
  })
}

/**
 * Pone la plantilla del catálogo del 267 (p. ej. 'premium': sin ella /catalogo-premium/<slug> responde 404) y
 * devuelve el restaurador, que deja el valor anterior. Llamarlo en beforeAll y el restaurador en afterAll.
 */
export function setCatalogTemplate(template: string): () => void {
  const prev = sql(`SELECT IFNULL(catalog_template,'') FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='${template}' WHERE id=${BUSINESS_ID}`)
  return () => { sql(`UPDATE businesses SET catalog_template=${prev ? `'${prev}'` : 'NULL'} WHERE id=${BUSINESS_ID}`) }
}

export interface CashSnapshot { register: number; log: number; sale: number }

/** Marca de agua de cajas, ventas y bitácora del 267, para purgar después solo lo que creó el spec. */
export function cashSnapshot(): CashSnapshot {
  const max = (table: string): number => Number(sql(`SELECT IFNULL(MAX(id),0) FROM ${table} WHERE business_id=${BUSINESS_ID}`))
  return { register: max('cash_registers'), log: max('activity_logs'), sale: max('sales') }
}

/**
 * Borra lo creado desde el snapshot: ventas sueltas (p. ej. los borradores DRF que el POS crea al abrirse),
 * cajas con sus movimientos y TODA la bitácora. El 267 es solo de pruebas, así que la bitácora de esa ventana
 * es de los specs. Llamarla al final, después de que cada spec borre sus productos.
 */
export function purgeCashSince(s: CashSnapshot): void {
  const sales = sql(`SELECT id FROM sales WHERE business_id=${BUSINESS_ID} AND id > ${s.sale}`).split('\n').filter(Boolean)
  if (sales.length > 0) {
    const list = sales.join(',')
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${list})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${list})`)
    sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
  }
  sql(`DELETE FROM cash_movements WHERE business_id=${BUSINESS_ID} AND cash_register_id > ${s.register}`)
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND id > ${s.log}`)
  sql(`DELETE FROM cash_registers WHERE business_id=${BUSINESS_ID} AND id > ${s.register}`)
}

/**
 * El checkout y el catálogo premium reparten los medios de pago según settings.catalog_divisa_methods (ids de
 * payment_methods). El 267 no lo trae: se marcan Zelle y Efectivo USD y devuelve el restaurador.
 */
export function setDivisaMethods(): () => void {
  const ids = sql(`SELECT id FROM payment_methods WHERE business_id=${BUSINESS_ID} AND (type='zelle' OR name='Efectivo USD')`)
    .split('\n').filter(Boolean)
  sql(`UPDATE businesses SET settings = JSON_SET(IFNULL(settings, JSON_OBJECT()), '$.catalog_divisa_methods', JSON_ARRAY(${ids.join(',')})) WHERE id=${BUSINESS_ID}`)
  return () => { sql(`UPDATE businesses SET settings = JSON_REMOVE(IFNULL(settings, JSON_OBJECT()), '$.catalog_divisa_methods') WHERE id=${BUSINESS_ID}`) }
}

const OWN_CATEGORY = 'ZZ D Cat'

/** Categoría propia del 267 (el tenant no trae ninguna y los specs de producto la necesitan). Devuelve su id. */
export function ensureOwnCategory(): number {
  sql(`INSERT IGNORE INTO categories (business_id, name, active, sort_order, requires_preparation) VALUES (${BUSINESS_ID}, '${OWN_CATEGORY}', 1, 0, 0)`)
  return Number(sql(`SELECT id FROM categories WHERE business_id=${BUSINESS_ID} AND name='${OWN_CATEGORY}'`))
}

/** Borra la categoría propia; llamarla DESPUÉS de borrar los productos que la usan. */
export function removeOwnCategory(): void {
  sql(`DELETE FROM categories WHERE business_id=${BUSINESS_ID} AND name='${OWN_CATEGORY}'`)
}

const SECOND_ADMIN_EMAIL = 'zz-d-admin2@example.invalid'

/** Segundo admin del 267 (el tenant trae uno solo y algunos specs comparan "quién" hizo cada cambio). Devuelve su id. */
export function ensureSecondAdmin(): number {
  if (!sql(`SELECT id FROM users WHERE email='${SECOND_ADMIN_EMAIL}'`)) {
    // Contraseña inválida a propósito: solo se usa con JWT, nunca con login.
    sql(`INSERT INTO users (business_id, name, email, password, role, is_active, updated_at) VALUES (${BUSINESS_ID}, 'ZZ D Admin 2', '${SECOND_ADMIN_EMAIL}', '!sin-login', 'admin', 1, NOW(3))`)
  }
  return Number(sql(`SELECT id FROM users WHERE email='${SECOND_ADMIN_EMAIL}'`))
}

/** Borra el segundo admin y su bitácora (que lo referencia). Llamarla al final del spec. */
export function removeSecondAdmin(): void {
  const id = sql(`SELECT id FROM users WHERE email='${SECOND_ADMIN_EMAIL}'`)
  if (!id) return
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND user_id=${id}`)
  sql(`DELETE FROM users WHERE id=${id} AND business_id=${BUSINESS_ID}`)
}

/** Borra por SQL TODO lo que dejaron los productos de prueba `ZZ <prefijo>%` del 267. */
export function cleanupTestProducts(prefix: string): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ ${prefix}%'`).split('\n').filter(Boolean)
  if (ids.length === 0) return
  const list = ids.join(',')
  sql(`DELETE oi FROM order_items oi WHERE oi.product_id IN (${list})`)
  sql(`DELETE FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ ${prefix}%'`)
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${list})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${list})`)
  sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${list})`)
}
