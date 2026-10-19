/**
 * Purga de llaves de serialización del checkout público (tabla web_order_locks): borra las filas cuyo
 * touched_at tenga MÁS de 90 días. Cada pedido web actualiza touched_at de sus llaves, así que una llave
 * vieja es de un cliente que no compra hace meses; si vuelve, la fila se recrea sola.
 * NO está programado: se corre a mano, de preferencia fuera de horas pico (borrar una fila que un pedido
 * tiene bloqueado espera a que termine).
 *
 * Por defecto es SIMULACIÓN: solo cuenta. --aplicar exige --host-esperado Y --db-esperada.
 *
 *   npx tsx scripts/purge-web-order-locks.ts                                                       (simulación)
 *   npx tsx scripts/purge-web-order-locks.ts --aplicar --host-esperado 127.0.0.1 --db-esperada activopos
 *   npx tsx scripts/purge-web-order-locks.ts --dias 180                                            (otro umbral)
 *
 * Lee SOLO .env. No imprime ningún valor de entorno salvo el host y el nombre de la DB.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const DEFAULT_DAYS = 90
const MS_PER_DAY = 24 * 60 * 60 * 1000

const args = process.argv.slice(2)
const APPLY = args.includes('--aplicar')
const argOf = (flag: string): string => {
  const i = args.indexOf(flag)
  return i >= 0 ? (args[i + 1] ?? '') : ''
}
const EXPECTED_HOST = argOf('--host-esperado')
const EXPECTED_DB = argOf('--db-esperada')
const days = args.includes('--dias') ? Number(argOf('--dias')) : DEFAULT_DAYS

function loadEnv(): void {
  const file = join(process.cwd(), '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    if (i > 0 && /^[A-Z_][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
      process.env[key] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
    }
  }
}

async function main(): Promise<void> {
  if (!Number.isInteger(days) || days < 30) throw new Error('--dias debe ser un entero >= 30')
  loadEnv()
  const dbHost = process.env.DB_HOST ?? '127.0.0.1'
  const dbName = process.env.DB_NAME ?? ''
  if (APPLY) {
    if (!EXPECTED_HOST || !EXPECTED_DB) throw new Error('--aplicar exige --host-esperado <host> y --db-esperada <nombre>')
    if (dbHost !== EXPECTED_HOST) throw new Error(`DB_HOST es "${dbHost}" y se esperaba "${EXPECTED_HOST}"; se aborta sin borrar`)
    if (dbName !== EXPECTED_DB) throw new Error(`DB_NAME es "${dbName}" y se esperaba "${EXPECTED_DB}"; se aborta sin borrar`)
  }
  const { prisma } = await import('../src/lib/prisma')
  const cutoff = new Date(Date.now() - days * MS_PER_DAY)
  console.log(`MODO: ${APPLY ? 'APLICAR (borra)' : 'SIMULACIÓN (no borra nada)'} · DB ${dbName || '?'} @ ${dbHost} · umbral: touched_at < ${cutoff.toISOString()} (${days} días)`)
  try {
    const total = await prisma.webOrderLock.count()
    const old = await prisma.webOrderLock.count({ where: { touched_at: { lt: cutoff } } })
    console.log(`Filas en web_order_locks: ${total} · con más de ${days} días: ${old}`)
    if (!APPLY) { console.log('\nNo se borró nada. Para aplicar: repetir con --aplicar --host-esperado <host> --db-esperada <nombre>'); return }
    const res = await prisma.webOrderLock.deleteMany({ where: { touched_at: { lt: cutoff } } })
    console.log(`BORRADAS: ${res.count}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1) })
