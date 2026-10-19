/**
 * Seed del método de envío MRW (oficina de destino) para un negocio. Pensado para OnBike (id 33).
 * NO toca nada más: ni otros métodos, ni pedidos. Idempotente: si el código 'mrw' ya existe lo
 * deja con estos valores; si no, lo crea.
 *
 * Por defecto es SIMULACIÓN: solo escribe con --aplicar.
 *
 *   npx tsx scripts/seed-shipping-method-33.ts                      (simulación, negocio 33)
 *   npx tsx scripts/seed-shipping-method-33.ts --aplicar            (escribe)
 *   npx tsx scripts/seed-shipping-method-33.ts --business-id 87     (prueba local con otro negocio)
 *
 * Guardas: el negocio debe existir y su nombre contener "onbike" (sin distinguir mayúsculas).
 * Lee .env.production y luego .env (como Next); no imprime ningún valor de entorno.
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

function loadEnv(): string {
  const files = ['.env.production', '.env'].filter(f => existsSync(join(process.cwd(), f)))
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
  const { prisma } = await import('../src/lib/prisma')
  console.log(`MODO: ${APPLY ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe nada)'} · negocio ${businessId} · DB ${process.env.DB_NAME ?? '?'} @ ${process.env.DB_HOST ?? '127.0.0.1'} · env: ${envFiles}`)
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
    console.log(`${APPLY ? 'HARÁ/HIZO' : 'HARÍA'}: ${mine ? `actualizar '${METHOD.code}' (id ${mine.id})` : `crear '${METHOD.code}'`} → ${METHOD.label} · ${METHOD.kind} · requires_branch=${METHOD.requires_branch}`)
    if (!APPLY) { console.log('\nNo se escribió nada. Para aplicar: repetir con --aplicar'); return }

    const saved = await prisma.businessShippingMethod.upsert({
      where:  { business_id_code: { business_id: businessId, code: METHOD.code } },
      create: { business_id: businessId, ...METHOD },
      update: { ...METHOD },
      select: { id: true, code: true, label: true, kind: true, requires_branch: true, active: true },
    })
    console.log('LISTO:', JSON.stringify(saved))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1) })
