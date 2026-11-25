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
  sql(`DELETE FROM floor_elements WHERE business_id=${id}`)
  sql(`DELETE FROM dining_tables WHERE business_id=${id}`)
  sql(`DELETE FROM service_areas WHERE business_id=${id}`)
  sql(`DELETE FROM activity_logs WHERE business_id=${id} AND action='restaurante_toggle'`)
  sql(`UPDATE businesses SET restaurante_enabled=${restaurante ? 1 : 0}, modules_enabled='${DEFAULT_MODULES}', subscription_active=1, subscription_expires_at=NULL, catalog_plan='negocio_activo' WHERE id=${id}`)
  return id
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
