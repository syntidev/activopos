/**
 * AUDITORÍA de tallas (SOLO LECTURA): lista las variantes de un negocio cuyo valor/tipo no son canónicos y cómo quedarían.
 * NO escribe nada. Carlos decide si se aplica (la transformación vive en src/lib/talla-canonica.ts, nunca en SQL).
 *
 *   Desde la raíz del repo; lee DB_* de .env.production / .env (sin mysql CLI ni root: corre en el VPS):
 *   export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"es2020"}'
 *   npx ts-node scripts/_auditar_tallas.ts --business-id 33
 *
 * Solo variantes activas con tipo 'talla' o 'personalizado' (los colores no se tocan). Estados:
 *   OK          ya es canónica (valor y tipo)
 *   CAMBIA      valor y/o tipo cambiarían (se muestra cómo quedaría)
 *   ERROR       no es una talla reconocible (hay que corregirla a mano) o le falta EU
 *   NO-TALLA    tipo 'personalizado' cuyo valor no parece talla (se deja igual)
 */
import { existsSync, readFileSync } from 'fs'
import { canonizarTalla, esTallaCanonica } from '../src/lib/talla-canonica'

// Credenciales DB_* del .env.production / .env (como Next: .env.production precede); no pisa lo ya exportado.
for (const f of ['.env.production', '.env']) {
  if (!existsSync(f)) continue
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(DB_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const arg = process.argv.indexOf('--business-id')
const businessId = arg > 0 ? Number(process.argv[arg + 1]) : NaN
if (!Number.isInteger(businessId) || businessId <= 0) {
  console.error('Uso: _auditar_tallas.ts --business-id N')
  process.exit(1)
}

interface Fila { id: number; pid: number; nombre: string; tipo: string; valor: string }

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma') // después de cargar el .env
  const filas = await prisma.$queryRaw<Fila[]>`
    SELECT v.id AS id, p.id AS pid, p.name AS nombre, v.tipo AS tipo, v.valor AS valor
    FROM product_variants v JOIN products p ON p.id = v.product_id
    WHERE p.business_id = ${businessId} AND v.is_active = 1 AND v.tipo IN ('talla','personalizado')
    ORDER BY p.id, v.id`
  await prisma.$disconnect()
  informe(filas)
}

function informe(filas: Fila[]): void {
const cuenta = { OK: 0, CAMBIA: 0, ERROR: 0, 'NO-TALLA': 0 }
const lineas: string[] = []
for (const { id: vid, pid, nombre, tipo, valor } of filas) {
  const c = canonizarTalla(valor)
  let estado: keyof typeof cuenta
  let detalle: string
  if (esTallaCanonica(c)) {
    estado = c.valor === valor && tipo === 'talla' ? 'OK' : 'CAMBIA'
    detalle = `'${valor}' (${tipo}) -> '${c.valor}' (talla)`
  } else if (tipo === 'talla') {
    estado = 'ERROR'; detalle = `'${valor}': ${c.error}`
  } else {
    estado = 'NO-TALLA'; detalle = `'${valor}' (${tipo}) se deja igual`
  }
  cuenta[estado]++
  if (estado !== 'OK') lineas.push(`${estado.padEnd(8)} variante ${vid} · producto ${pid} "${nombre}": ${detalle}`)
}

console.log(`Auditoría de tallas — negocio ${businessId} — ${filas.length} variantes activas (talla/personalizado). SOLO LECTURA.`)
console.log(lineas.join('\n') || '(todas canónicas)')
console.log(`\nResumen: OK ${cuenta.OK} · CAMBIA ${cuenta.CAMBIA} · ERROR ${cuenta.ERROR} · NO-TALLA ${cuenta['NO-TALLA']}`)
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
