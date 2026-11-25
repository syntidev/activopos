import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import type { BrowserContext } from '@playwright/test'
import { SignJWT } from 'jose'

/**
 * Ayudas de los specs del módulo Restaurante. Corren SOLO contra activopos_kds (se verifica antes de tocar
 * nada), con negocios ZZ propios. Sesión: JWT firmado con el JWT_SECRET del .env, sin tocar claves de usuarios.
 */

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const ENV_FILE = path.join(__dirname, '..', '..', '.env')
export const CAPTURAS = path.join(__dirname, '..', '..', '.doc', 'restaurante')

export function envValue(key: string): string {
  const line = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} no está en .env`)
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

const DB = (envValue('DATABASE_URL').match(/\/([^/?]+)(\?|$)/) ?? [])[1] ?? ''

export function sql(query: string): string {
  if (DB !== 'activopos_kds') throw new Error(`Estos specs solo corren contra activopos_kds (la base del .env es "${DB}")`)
  return execFileSync('mysql', ['-uroot', '-h127.0.0.1', '--default-character-set=utf8mb4', '-N', '-B', DB, '-e', query], { encoding: 'utf8' }).trim()
}

export type Slug = 'zzkds-a' | 'zzkds-b' | 'zzkds-c' | 'zzkds-d' | 'zzkds-e'

export function businessId(slug: Slug): number {
  return Number(sql(`SELECT id FROM businesses WHERE catalog_slug='${slug}'`))
}

const DEFAULT_MODULES = 'pos,inventory,caja,pedidos,catalog,finanzas,reportes,analytics,suppliers'

/** Crea (si falta) el negocio ZZ y lo deja limpio: sin áreas/mesas, módulos por defecto, flag como se pida. */
export function ensureBusiness(slug: Slug, restaurante: boolean): number {
  if (!businessId(slug)) {
    sql(`INSERT INTO businesses (name,email,catalog_slug,catalog_active,catalog_title,onboarding_completed,segment,catalog_plan,catalog_template,settings,updated_at)
         VALUES ('ZZ KDS ${slug}','${slug}@zzkds.test','${slug}',1,'ZZ KDS ${slug}',1,'pruebas','negocio_activo','generic','{}',NOW(3))`)
  }
  const id = businessId(slug)
  // Cuentas de mesa primero (apuntan a mesas y productos), luego lo demás.
  sql(`DELETE oi FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.business_id=${id} AND o.origin='table'`)
  sql(`DELETE FROM table_events WHERE business_id=${id}`)
  sql(`DELETE FROM orders WHERE business_id=${id} AND origin='table'`)
  sql(`DELETE FROM product_modifiers WHERE business_id=${id}`)
  sql(`DELETE FROM products WHERE business_id=${id} AND name LIKE 'ZZ %'`)
  sql(`DELETE FROM categories WHERE business_id=${id} AND name LIKE 'ZZ %'`)
  sql(`DELETE us FROM user_stations us JOIN prep_stations ps ON ps.id=us.station_id WHERE ps.business_id=${id}`)
  sql(`DELETE FROM prep_stations WHERE business_id=${id}`)
  sql(`DELETE FROM floor_elements WHERE business_id=${id}`)
  sql(`DELETE FROM dining_tables WHERE business_id=${id}`)
  sql(`DELETE FROM service_areas WHERE business_id=${id}`)
  sql(`DELETE FROM activity_logs WHERE business_id=${id} AND action='restaurante_toggle'`)
  sql(`UPDATE businesses SET restaurante_enabled=${restaurante ? 1 : 0}, modules_enabled='${DEFAULT_MODULES}', subscription_active=1, subscription_expires_at=NULL, catalog_plan='negocio_activo' WHERE id=${id}`)
  return id
}

/** Usuario del negocio con ese rol (lo crea si falta). Hace falta uno real: la cuenta valida al mesonero contra la tabla users. */
export function ensureUser(bid: number, role: TestRole, name: string): number {
  const email = `zzkds-${bid}-${role}-${name.toLowerCase().replace(/\W+/g, '')}@zzkds.test`
  if (!Number(sql(`SELECT COUNT(*) FROM users WHERE email='${email}'`))) {
    sql(`INSERT INTO users (business_id,name,email,password,role,is_active,updated_at) VALUES (${bid},'${name}','${email}','!no-login','${role}',1,NOW(3))`)
  }
  return Number(sql(`SELECT id FROM users WHERE email='${email}'`))
}

export interface CartaSeed { categoryId: number; pasta: number; queso: number; cerveza: number }

/** Categoría y productos de prueba: pasta ($14, unidad), queso por kg ($20, peso) y cerveza ($3, unidad). Con costo cargado a propósito. */
export function seedCarta(bid: number): CartaSeed {
  sql(`INSERT INTO categories (business_id,name) VALUES (${bid},'ZZ Platos')`)
  const categoryId = Number(sql(`SELECT id FROM categories WHERE business_id=${bid} AND name='ZZ Platos'`))
  const add = (name: string, mode: string, field: string, price: number): number => {
    sql(`INSERT INTO products (business_id,category_id,name,sale_mode,${field},cost_per_unit_usd,active,updated_at) VALUES (${bid},${categoryId},'${name}','${mode}',${price},7.77,1,NOW(3))`)
    return Number(sql(`SELECT id FROM products WHERE business_id=${bid} AND name='${name}'`))
  }
  return {
    categoryId,
    pasta:   add('ZZ Pasta carbonara', 'unit', 'price_per_unit_usd', 14),
    queso:   add('ZZ Queso por kg', 'weight', 'price_per_kg_usd', 20),
    cerveza: add('ZZ Cerveza Polar', 'unit', 'price_per_unit_usd', 3),
  }
}

export type TestRole = 'admin' | 'cashier' | 'waiter' | 'kitchen'

/** Inicia sesión como `role` del negocio `bid`. userId 1 existe en activopos_kds (lo exige la FK de activity_logs). */
export async function login(context: BrowserContext, bid: number, role: TestRole, userId = 1): Promise<void> {
  const token = await new SignJWT({ userId, businessId: bid, role, name: `ZZ ${role}` })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await context.clearCookies()
  await context.addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}
