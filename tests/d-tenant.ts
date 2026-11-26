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

export async function tokenFor(userId: number = ADMIN_ID, role = 'admin'): Promise<string> {
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
