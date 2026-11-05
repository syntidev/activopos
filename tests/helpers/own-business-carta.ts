import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { sql } from '../alta-helpers'

/** Negocio de prueba propio de CLI-B (carpeta activopos-b): "ZZ B Pruebas", plantilla carta. Nunca se toca el 80 ni datos de otra letra. */
export const OWN_SLUG = 'zzb-pruebas'
const ROOT = path.join(__dirname, '..', '..')
const ENV_FILE = path.join(ROOT, '.env.test.local')

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
