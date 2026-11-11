import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { sql } from '../alta-helpers'

/**
 * Negocios de prueba PROPIOS por carpeta (nunca se toca el 80 ni datos de otra letra). Cada carpeta tiene su
 * `.env.test.local` (no versionado) con E2E_BUSINESS_ID (+ E2E_ADMIN_ID / E2E_CASHIER_ID en la carpeta A).
 *  - Carpeta B (activopos-b): "ZZ B Pruebas", plantilla carta → ensureOwnBusiness(): number, ownBusinessId(), OWN_SLUG.
 *  - Carpeta A (activopos):   "ZZ A Pruebas" → ensureOwnBusinessA() / ownBusiness(). Correr: npm run test:own-business
 */

const ROOT = path.join(__dirname, '..', '..')
const ENV_FILE = path.join(ROOT, '.env.test.local')

/* ───────────────────────── Carpeta B (CLI-B) ───────────────────────── */

/** Negocio de prueba propio de CLI-B (carpeta activopos-b): "ZZ B Pruebas", plantilla carta. */
export const OWN_SLUG = 'zzb-pruebas'

/** Idempotente: corre el seed (crea o actualiza solo el negocio OWN_SLUG), guarda E2E_BUSINESS_ID en .env.test.local (no versionado) y devuelve el id. */
export function ensureOwnBusiness(): number {
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', 'tests/tsconfig.json', 'scripts/seed-carta-demo.ts'], { cwd: ROOT, stdio: 'pipe' })
  const id = Number(sql("SELECT id FROM businesses WHERE catalog_slug='" + OWN_SLUG + "'"))
  const prev = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8').split('\n').filter(l => l && !l.startsWith('E2E_BUSINESS_ID=')) : []
  fs.writeFileSync(ENV_FILE, [...prev, 'E2E_BUSINESS_ID=' + id, ''].join('\n'))
  return id
}

/** Id del negocio propio: E2E_BUSINESS_ID (de .env.test.local) o, si falta, el 80 por defecto. */
export function ownBusinessId(): number {
  if (process.env.E2E_BUSINESS_ID) return Number(process.env.E2E_BUSINESS_ID)
  if (fs.existsSync(ENV_FILE)) {
    const m = fs.readFileSync(ENV_FILE, 'utf-8').match(/^E2E_BUSINESS_ID=(\d+)/m)
    if (m) return Number(m[1])
  }
  return 80
}

/* ───────────────────────── Carpeta A (CLI-A) ───────────────────────── */

const LETTER = 'A'
const SLUG_A = `zz${LETTER.toLowerCase()}-pruebas`
const NAME_A = `ZZ ${LETTER} Pruebas`
const DEFAULT_BUSINESS = 80
const DEFAULT_ADMIN = 79

export interface OwnBusiness { businessId: number; adminId: number; cashierId: number; slug: string }

function fileValues(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** Para los specs de la carpeta A: el negocio propio si existe; si no, el 80 con su admin 79 (comportamiento de siempre). */
export function ownBusiness(): OwnBusiness {
  // .env.test.local lo comparte la carpeta B (su helper lo reescribe con SU negocio ZZ B): el de la carpeta A se resuelve por slug,
  // así un spec de A nunca escribe en datos de otra letra aunque ese archivo apunte a otro negocio.
  const ownA = Number(sql(`SELECT COALESCE(MAX(id),0) FROM businesses WHERE catalog_slug='${SLUG_A}'`))
  if (ownA > 0) {
    return {
      businessId: ownA,
      adminId:    Number(sql(`SELECT id FROM users WHERE business_id=${ownA} AND role='admin' ORDER BY id LIMIT 1`)),
      cashierId:  Number(sql(`SELECT id FROM users WHERE business_id=${ownA} AND role='cashier' ORDER BY id LIMIT 1`)),
      slug:       SLUG_A,
    }
  }
  const v: Record<string, string | undefined> = { ...fileValues(), ...(process.env.E2E_BUSINESS_ID ? { E2E_BUSINESS_ID: process.env.E2E_BUSINESS_ID } : {}) }
  const businessId = Number(v.E2E_BUSINESS_ID ?? DEFAULT_BUSINESS)
  const isOwn = v.E2E_BUSINESS_ID !== undefined && businessId !== DEFAULT_BUSINESS
  const cashierId = Number(v.E2E_CASHIER_ID ?? (sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='cashier' ORDER BY id LIMIT 1`) || '0'))
  return {
    businessId,
    adminId: Number(v.E2E_ADMIN_ID ?? DEFAULT_ADMIN),
    cashierId,
    slug: isOwn ? (sql(`SELECT catalog_slug FROM businesses WHERE id=${businessId}`) || SLUG_A) : 'boutique-demo',
  }
}

const q = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "''")

/** Crea (si falta) el negocio propio de la carpeta A con admin, cajero y los medios de pago del 80, y escribe .env.test.local. */
export function ensureOwnBusinessA(): OwnBusiness {
  let businessId = Number(sql(`SELECT COALESCE(MAX(id),0) FROM businesses WHERE catalog_slug='${SLUG_A}'`))
  if (businessId === 0) {
    sql(`INSERT INTO businesses (name,email,catalog_slug,catalog_active,catalog_title,onboarding_completed,segment,catalog_plan,catalog_template,settings,updated_at)
         VALUES ('${q(NAME_A)}','${SLUG_A}@zza.test','${SLUG_A}',1,'${q(NAME_A)}',1,'pruebas','negocio_activo','generic','{}',NOW(3))`)
    businessId = Number(sql(`SELECT id FROM businesses WHERE catalog_slug='${SLUG_A}'`))
    // Contraseña inválida a propósito: los specs firman su propio JWT, nadie inicia sesión con estos usuarios.
    sql(`INSERT INTO users (business_id,name,email,password,role,updated_at) VALUES
         (${businessId},'ZZ ${LETTER} Admin','${SLUG_A}-admin@zza.test','!no-login','admin',NOW(3)),
         (${businessId},'ZZ ${LETTER} Cajero','${SLUG_A}-cajero@zza.test','!no-login','cashier',NOW(3))`)
    // Medios de pago: copia de SOLO LECTURA del 80 (sin los ZZ de otras sesiones).
    sql(`INSERT INTO payment_methods (business_id,name,type,is_active,is_financing,sort_order)
         SELECT ${businessId},name,type,is_active,is_financing,sort_order FROM payment_methods WHERE business_id=${DEFAULT_BUSINESS} AND is_active=1 AND name NOT LIKE 'ZZ%'`)
  }
  const adminId = Number(sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='admin' ORDER BY id LIMIT 1`))
  const cashierId = Number(sql(`SELECT id FROM users WHERE business_id=${businessId} AND role='cashier' ORDER BY id LIMIT 1`))
  const keep = Object.entries(fileValues()).filter(([k]) => !k.startsWith('E2E_BUSINESS_') && k !== 'E2E_ADMIN_ID' && k !== 'E2E_CASHIER_ID')
  const lines = [...keep.map(([k, v]) => `${k}=${v}`), `E2E_BUSINESS_ID=${businessId}`, `E2E_ADMIN_ID=${adminId}`, `E2E_CASHIER_ID=${cashierId}`]
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n')
  return { businessId, adminId, cashierId, slug: SLUG_A }
}

if (require.main === module) {
  const b = ensureOwnBusinessA()
  console.log(`${NAME_A}: id=${b.businessId} admin=${b.adminId} cajero=${b.cashierId} slug=${b.slug}`)
}
