import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/** Ayudas de los specs P0 (precios, borrado, financiamiento, búsqueda): negocio 87, servidor local (E2E_BASE_URL). */
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const BUSINESS_ID = 87
export const ADMIN_ID = 86
export const SLUG = 'onbike'

export async function tokenFor(userId: number = ADMIN_ID, role = 'admin'): Promise<string> {
  return new SignJWT({ userId, businessId: BUSINESS_ID, role, name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

/** Sesión del navegador (cookie) como admin del 87. */
export async function login(page: Page, userId: number = ADMIN_ID): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(userId), url: BASE }])
}

/** Cliente de API con sesión admin; `null` = sin sesión (público). */
export async function apiAs(userId: number | null = ADMIN_ID): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    ...(userId === null ? {} : { extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId)}` } }),
  })
}

/** Borra por SQL TODO lo que dejaron los productos de prueba `ZZ <prefijo>%` del 87 (incluye historial de prueba). */
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
