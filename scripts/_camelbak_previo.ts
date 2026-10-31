// Descartable. PASO 1 del mini-lote CamelBak de OnBike (negocio 33). Se corre ANTES de importar import_camelbak_31oct.xlsx.
// (a) Corrige la marca 14 "KAMELBAK" -> "CAMELBAK" (search_term 'camelbak', visible).
// (b) Deja visibles + Cashea los 2 registros existentes 590 (21 oz) y 591 (24 oz); el Excel los renombra después.
// Por defecto SIMULACION; escribe solo con --aplicar y antes guarda respaldo JSON en storage/respaldos/.
// Uso (en el VPS, /var/www/activopos):
//   export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"es2020"}'
//   npx ts-node scripts/_camelbak_previo.ts --business-id 33               (simulacion)
//   npx ts-node scripts/_camelbak_previo.ts --business-id 33 --aplicar     (respalda y escribe)
//   npx ts-node scripts/_camelbak_previo.ts --business-id 33 --revertir <respaldo.json> --aplicar
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const ALLOWED_BUSINESS_ID = 33
const REQUIRED_NAME_PART = 'onbike'
const BRAND_ID = 14
const BRAND_NAME = 'CAMELBAK'
const BRAND_TERM = 'camelbak'
const PRODUCTOS: { id: number; contiene: string }[] = [
  { id: 590, contiene: '21' },
  { id: 591, contiene: '24' },
]

const args = process.argv.slice(2)
const APPLY = args.includes('--aplicar')
const opt = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function loadEnv(): string {
  const files = ['.env.production', '.env'].filter(f => existsSync(join(ROOT, f)))
  for (const f of files) {
    for (const l of readFileSync(join(ROOT, f), 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(l)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
  return files.join(' + ') || '(ninguno)'
}

interface MarcaPrevia { id: number; name: string; search_term: string; visible: boolean }
interface ProdPrevio { id: number; name: string; active: boolean; available_in_pos: boolean; catalog_visibility: string; financing_excluded: boolean }
interface Respaldo { business_id: number; creado: string; marca: MarcaPrevia; productos: ProdPrevio[] }

async function main(): Promise<void> {
  const bidArg = opt('--business-id')
  if (bidArg === null) throw new Error('Falta --business-id')
  const businessId = Number(bidArg)
  if (!Number.isInteger(businessId) || businessId !== ALLOWED_BUSINESS_ID) throw new Error(`--business-id debe ser exactamente ${ALLOWED_BUSINESS_ID} (recibido: ${bidArg})`)
  const revertir = opt('--revertir')

  const envFiles = loadEnv()
  const { prisma } = await import('../src/lib/prisma')
  console.log(`MODO: ${APPLY ? 'APLICAR (escribe en DB)' : 'SIMULACION (no escribe nada)'}${revertir ? ' · REVERSO' : ''} · negocio ${businessId} · DB ${process.env.DB_NAME ?? '?'} @ ${process.env.DB_HOST ?? '127.0.0.1'} · env: ${envFiles}`)
  try {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } })
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!biz.name.toLowerCase().includes(REQUIRED_NAME_PART)) throw new Error(`El negocio ${businessId} se llama "${biz.name}"; se aborta`)
    console.log(`Negocio verificado: ${biz.id} = "${biz.name}"`)

    if (revertir) {
      const r = JSON.parse(readFileSync(revertir, 'utf8')) as Respaldo
      if (r.business_id !== businessId) throw new Error('El respaldo es de otro negocio')
      console.log(`Reverso desde ${revertir}: marca ${r.marca.id} -> "${r.marca.name}", ${r.productos.length} productos.`)
      if (!APPLY) { console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar'); return }
      await prisma.brand.update({ where: { id: r.marca.id }, data: { name: r.marca.name, search_term: r.marca.search_term, visible: r.marca.visible } })
      for (const p of r.productos) {
        await prisma.product.update({ where: { id: p.id }, data: { active: p.active, available_in_pos: p.available_in_pos, catalog_visibility: p.catalog_visibility as 'visible', financing_excluded: p.financing_excluded } })
      }
      console.log('REVERSO HECHO. Los 9 creados por el Excel se ocultan aparte con el filtro de /productos.')
      return
    }

    const marca = await prisma.brand.findFirst({ where: { id: BRAND_ID, business_id: businessId }, select: { id: true, name: true, search_term: true, visible: true } })
    if (!marca) throw new Error(`La marca ${BRAND_ID} no existe en el negocio ${businessId}`)
    if (!marca.name.toLowerCase().includes('melbak')) throw new Error(`La marca ${BRAND_ID} se llama "${marca.name}", no parece CamelBak; se aborta`)
    const dup = await prisma.brand.findFirst({ where: { business_id: businessId, name: BRAND_NAME, NOT: { id: BRAND_ID } }, select: { id: true } })
    if (dup) throw new Error(`Ya existe otra marca "${BRAND_NAME}" (id ${dup.id}); se aborta para no duplicar`)
    console.log(`\nMarca ${marca.id}: "${marca.name}" (term "${marca.search_term}", visible=${marca.visible}) -> "${BRAND_NAME}" (term "${BRAND_TERM}", visible=true)`)

    const prods = await prisma.product.findMany({
      where: { business_id: businessId, id: { in: PRODUCTOS.map(p => p.id) } },
      select: { id: true, name: true, active: true, available_in_pos: true, catalog_visibility: true, financing_excluded: true },
    })
    const aTocar: ProdPrevio[] = []
    for (const e of PRODUCTOS) {
      const p = prods.find(x => x.id === e.id)
      if (!p) { console.log(`  [AVISO] id ${e.id} no existe: se omite`); continue }
      const n = p.name.toLowerCase()
      if (!n.includes('podium') || !n.includes(e.contiene)) { console.log(`  [AVISO] id ${e.id} se llama "${p.name}": se omite por seguridad`); continue }
      console.log(`  id ${p.id} "${p.name}" -> catalogo=${p.catalog_visibility} sin_cashea=${p.financing_excluded} -> visible + Cashea`)
      aTocar.push({ ...p, catalog_visibility: String(p.catalog_visibility) })
    }

    if (!APPLY) { console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar'); return }

    const dir = join(ROOT, 'storage', 'respaldos')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `camelbak_${businessId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    const respaldo: Respaldo = { business_id: businessId, creado: new Date().toISOString(), marca, productos: aTocar }
    writeFileSync(file, JSON.stringify(respaldo, null, 2), 'utf8')
    console.log(`\nRespaldo: ${file}`)

    await prisma.brand.update({ where: { id: BRAND_ID }, data: { name: BRAND_NAME, search_term: BRAND_TERM, visible: true } })
    console.log(`  marca ${BRAND_ID} -> ${BRAND_NAME}`)
    for (const p of aTocar) {
      await prisma.product.update({ where: { id: p.id }, data: { active: true, available_in_pos: true, catalog_visibility: 'visible', financing_excluded: false } })
      console.log(`  producto ${p.id} -> visible + Cashea`)
    }
    console.log(`\nHECHO. REVERSO: npx ts-node scripts/_camelbak_previo.ts --business-id ${businessId} --revertir "${file}" --aplicar`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', msg(e)); process.exit(1) })
