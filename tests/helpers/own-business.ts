import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { sql } from '../alta-helpers'

/**
 * Negocio de prueba PROPIO de esta carpeta ("ZZ A Pruebas", slug zza-pruebas): los specs no comparten negocio con otras
 * sesiones. Su id vive en .env.test.local (no versionado) como E2E_BUSINESS_ID (+ E2E_ADMIN_ID / E2E_CASHIER_ID).
 *  - ownBusiness():      lee E2E_BUSINESS_ID (entorno o archivo); si no existe, cae al negocio 80 (para no romper a los demás).
 *  - ensureOwnBusiness(): crea el negocio de forma idempotente y escribe el archivo. Correr: npm run test:own-business
 * Del negocio 80 solo se LEE (se copian sus medios de pago); jamás se modifica.
 */

const LETTER = 'A'
const SLUG = `zz${LETTER.toLowerCase()}-pruebas`
const NAME = `ZZ ${LETTER} Pruebas`
const ENV_FILE = path.join(__dirname, '..', '..', '.env.test.local')
const DEFAULT_BUSINESS = 80
const DEFAULT_ADMIN = 79

export interface OwnBusiness { businessId: number; adminId: number; cashierId: number; slug: string }

function fileValues(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** Para los specs: el negocio propio si existe; si no, el 80 con su admin 79 (comportamiento de siempre). */
export function ownBusiness(): OwnBusiness {
  const v: Record<string, string | undefined> = { ...fileValues(), ...(process.env.E2E_BUSINESS_ID ? { E2E_BUSINESS_ID: process.env.E2E_BUSINESS_ID } : {}) }
  const businessId = Number(v.E2E_BUSINESS_ID ?? DEFAULT_BUSINESS)
  const isOwn = v.E2E_BUSINESS_ID !== undefined && businessId !== DEFAULT_BUSINESS
  const cashierId = Number(v.E2E_CASHIER_ID ?? (sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='cashier' ORDER BY id LIMIT 1`) || '0'))
  return {
    businessId,
    adminId: Number(v.E2E_ADMIN_ID ?? DEFAULT_ADMIN),
    cashierId,
    slug: isOwn ? (sql(`SELECT catalog_slug FROM businesses WHERE id=${businessId}`) || SLUG) : 'boutique-demo',
  }
}

const q = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "''")

/** Crea (si falta) el negocio propio con admin, cajero y los medios de pago del 80, y escribe .env.test.local. */
export function ensureOwnBusiness(): OwnBusiness {
  let businessId = Number(sql(`SELECT COALESCE(MAX(id),0) FROM businesses WHERE catalog_slug='${SLUG}'`))
  if (businessId === 0) {
    sql(`INSERT INTO businesses (name,email,catalog_slug,catalog_active,catalog_title,onboarding_completed,segment,catalog_plan,catalog_template,settings,updated_at)
         VALUES ('${q(NAME)}','${SLUG}@zza.test','${SLUG}',1,'${q(NAME)}',1,'pruebas','negocio_activo','generic','{}',NOW(3))`)
    businessId = Number(sql(`SELECT id FROM businesses WHERE catalog_slug='${SLUG}'`))
    // Contraseña inválida a propósito: los specs firman su propio JWT, nadie inicia sesión con estos usuarios.
    sql(`INSERT INTO users (business_id,name,email,password,role,updated_at) VALUES
         (${businessId},'ZZ ${LETTER} Admin','${SLUG}-admin@zza.test','!no-login','admin',NOW(3)),
         (${businessId},'ZZ ${LETTER} Cajero','${SLUG}-cajero@zza.test','!no-login','cashier',NOW(3))`)
    // Medios de pago: copia de SOLO LECTURA del 80 (sin los ZZ de otras sesiones).
    sql(`INSERT INTO payment_methods (business_id,name,type,is_active,is_financing,sort_order)
         SELECT ${businessId},name,type,is_active,is_financing,sort_order FROM payment_methods WHERE business_id=${DEFAULT_BUSINESS} AND is_active=1 AND name NOT LIKE 'ZZ%'`)
  }
  const adminId = Number(sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='admin' ORDER BY id LIMIT 1`))
  const cashierId = Number(sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='cashier' ORDER BY id LIMIT 1`))
  const keep = Object.entries(fileValues()).filter(([k]) => !k.startsWith('E2E_BUSINESS_') && k !== 'E2E_ADMIN_ID' && k !== 'E2E_CASHIER_ID')
  const lines = [...keep.map(([k, v]) => `${k}=${v}`), `E2E_BUSINESS_ID=${businessId}`, `E2E_ADMIN_ID=${adminId}`, `E2E_CASHIER_ID=${cashierId}`]
  writeFileSync(ENV_FILE, lines.join('\n') + '\n')
  return { businessId, adminId, cashierId, slug: SLUG }
}

if (require.main === module) {
  const b = ensureOwnBusiness()
  console.log(`${NAME}: id=${b.businessId} admin=${b.adminId} cajero=${b.cashierId} slug=${b.slug}`)
}
