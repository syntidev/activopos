/**
 * AUDITORÍA de tallas (SOLO LECTURA): lista las variantes de un negocio cuyo valor/tipo no son canónicos y cómo quedarían.
 * NO escribe nada. Carlos decide si se aplica (la transformación vive en src/lib/talla-canonica.ts, nunca en SQL).
 *
 *   npx ts-node --project tests/tsconfig.json scripts/_auditar_tallas.ts --business-id 216
 *
 * Solo variantes activas con tipo 'talla' o 'personalizado' (los colores no se tocan). Estados:
 *   OK          ya es canónica (valor y tipo)
 *   CAMBIA      valor y/o tipo cambiarían (se muestra cómo quedaría)
 *   ERROR       no es una talla reconocible (hay que corregirla a mano) o le falta EU
 *   NO-TALLA    tipo 'personalizado' cuyo valor no parece talla (se deja igual)
 */
import { sql } from '../tests/alta-helpers'
import { canonizarTalla, esTallaCanonica } from '../src/lib/talla-canonica'

const arg = process.argv.indexOf('--business-id')
const businessId = arg > 0 ? Number(process.argv[arg + 1]) : NaN
if (!Number.isInteger(businessId) || businessId <= 0) {
  console.error('Uso: _auditar_tallas.ts --business-id N')
  process.exit(1)
}

const out = sql(
  `SELECT v.id, p.id, REPLACE(p.name,'\\t',' '), v.tipo, REPLACE(v.valor,'\\t',' ') FROM product_variants v JOIN products p ON p.id=v.product_id ` +
  `WHERE p.business_id=${businessId} AND v.is_active=1 AND v.tipo IN ('talla','personalizado') ORDER BY p.id, v.id`,
)
const filas = out ? out.split('\n').map(l => l.split('\t').map(c => c.trim())) : []

const cuenta = { OK: 0, CAMBIA: 0, ERROR: 0, 'NO-TALLA': 0 }
const lineas: string[] = []
for (const [vid, pid, nombre, tipo, valor] of filas) {
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
