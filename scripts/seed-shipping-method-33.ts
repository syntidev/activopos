/**
 * Seed del método de envío MRW (oficina de destino) para un negocio. Pensado para OnBike (id 33).
 * NO toca nada más: ni otros métodos, ni pedidos. Idempotente y NO destructivo: si el código 'mrw'
 * ya existe NO se modifica (el negocio pudo editarlo desde Configuración); si no, lo crea.
 *
 * Por defecto es SIMULACIÓN: solo escribe con --aplicar, y --aplicar exige --host-esperado Y --db-esperada.
 *
 *   npx tsx scripts/seed-shipping-method-33.ts                                          (simulación, negocio 33)
 *   npx tsx scripts/seed-shipping-method-33.ts --aplicar --host-esperado 127.0.0.1 --db-esperada activopos   (escribe, solo si DB_HOST y DB_NAME coinciden)
 *   npx tsx scripts/seed-shipping-method-33.ts --business-id 87                         (prueba local con otro negocio)
 *   npx tsx scripts/seed-shipping-method-33.ts --env-production                         (lee también .env.production)
 *
 * Guardas: el negocio debe existir y su nombre contener "onbike" (sin distinguir mayúsculas).
 * Lee SOLO .env, salvo --env-production (entonces .env.production y luego .env, como Next).
 * No imprime ningún valor de entorno salvo el host de la DB.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const DEFAULT_BUSINESS_ID = 33
const REQUIRED_NAME_PART = 'onbike'
const METHOD = {
  code:            'mrw',
  label:           'MRW',
  kind:            'carrier_branch',
  requires_branch: true,
  active:          true,
  sort_order:      0,
  instructions:    'Indica la oficina MRW de destino: estado, ciudad y nombre de la oficina.',
} as const

const args = process.argv.slice(2)
const APPLY = args.includes('--aplicar')
const bidIdx = args.indexOf('--business-id')
const businessId = bidIdx >= 0 ? Number(args[bidIdx + 1]) : DEFAULT_BUSINESS_ID
const hostIdx = args.indexOf('--host-esperado')
const EXPECTED_HOST = hostIdx >= 0 ? (args[hostIdx + 1] ?? '') : ''
const dbIdx = args.indexOf('--db-esperada')
const EXPECTED_DB = dbIdx >= 0 ? (args[dbIdx + 1] ?? '') : ''
const USE_ENV_PRODUCTION = args.includes('--env-production')

function loadEnv(): string {
  const candidates = USE_ENV_PRODUCTION ? ['.env.production', '.env'] : ['.env']
  const files = candidates.filter(f => existsSync(join(process.cwd(), f)))
  for (const f of files) {
    for (const line of readFileSync(join(process.cwd(), f), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      if (i > 0 && /^[A-Z_][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
        process.env[key] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
      }
    }
  }
  return files.join(' + ') || '(ninguno)'
}

async function main(): Promise<void> {
  if (!Number.isInteger(businessId) || businessId <= 0) throw new Error(`--business-id inválido: ${String(args[bidIdx + 1])}`)
  const envFiles = loadEnv()
  const dbHost = process.env.DB_HOST ?? '127.0.0.1'
  // Escribir exige haber declarado a qué servidor se apunta, y que sea ese: evita aplicar contra otro por error.
  if (APPLY) {
    if (!EXPECTED_HOST) throw new Error('--aplicar exige --host-esperado <host> (el DB_HOST contra el que debe escribir)')
    if (dbHost !== EXPECTED_HOST) throw new Error(`DB_HOST es "${dbHost}" y se esperaba "${EXPECTED_HOST}"; se aborta sin escribir`)
    if (!EXPECTED_DB) throw new Error('--aplicar exige también --db-esperada <nombre> (el DB_NAME contra el que debe escribir)')
    const dbName = process.env.DB_NAME ?? ''
    if (dbName !== EXPECTED_DB) throw new Error(`DB_NAME es "${dbName}" y se esperaba "${EXPECTED_DB}"; se aborta sin escribir`)
  }
  const { prisma } = await import('../src/lib/prisma')
  console.log(`MODO: ${APPLY ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe nada)'} · negocio ${businessId} · DB ${process.env.DB_NAME ?? '?'} @ ${dbHost} · env: ${envFiles}`)
  try {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } })
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!biz.name.toLowerCase().includes(REQUIRED_NAME_PART)) {
      throw new Error(`El negocio ${businessId} se llama "${biz.name}", no contiene "OnBike"; se aborta`)
    }
    console.log(`Negocio verificado: ${biz.id} = "${biz.name}"`)

    const existing = await prisma.businessShippingMethod.findMany({
      where:  { business_id: businessId },
      select: { id: true, code: true, label: true, active: true },
    })
    const others = existing.filter(m => m.code !== METHOD.code)
    const mine = existing.find(m => m.code === METHOD.code)
    console.log(`Métodos existentes: ${existing.length}${others.length ? ` (distintos de '${METHOD.code}': ${others.map(m => `${m.code}${m.active ? '' : ' [inactivo]'}`).join(', ')}; NO se tocan)` : ''}`)
    console.log(`${APPLY ? 'HARÁ/HIZO' : 'HARÍA'}: ${mine ? `dejar '${METHOD.code}' (id ${mine.id}) como está, SIN modificarlo` : `crear '${METHOD.code}'`} → ${METHOD.label} · ${METHOD.kind} · requires_branch=${METHOD.requires_branch}`)
    if (!APPLY) { console.log('\nNo se escribió nada. Para aplicar: repetir con --aplicar'); return }

    const saved = await prisma.businessShippingMethod.upsert({
      where:  { business_id_code: { business_id: businessId, code: METHOD.code } },
      create: { business_id: businessId, ...METHOD },
      update: {}, // si ya existe, no pisa lo que el negocio editó (etiqueta, instrucciones, activo)
      select: { id: true, code: true, label: true, kind: true, requires_branch: true, active: true },
    })
    console.log('LISTO:', JSON.stringify(saved))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1) })
