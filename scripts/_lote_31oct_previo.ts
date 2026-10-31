// Descartable. PASO 1 del lote 31-oct de OnBike (negocio 33). Se corre ANTES de importar el Excel.
// Hace 3 cosas: (a) crea las marcas nuevas, (b) deja visibles + Cashea los 6 productos existentes del lote,
// (c) AGREGA grupos de sinónimos (no borra los existentes).
// Por defecto es SIMULACION: solo escribe con --aplicar y antes guarda respaldo JSON en storage/respaldos/.
// Uso (desde la raíz del proyecto):
//   export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"es2020"}'
//   npx ts-node scripts/_lote_31oct_previo.ts --business-id 33                      (simulacion)
//   npx ts-node scripts/_lote_31oct_previo.ts --business-id 33 --aplicar            (respalda y escribe)
//   npx ts-node scripts/_lote_31oct_previo.ts --business-id 33 --revertir <respaldo.json> --aplicar
// Reverso: restaura productos y settings desde el respaldo y OCULTA las marcas creadas (no borra nada).
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { synonymsInputSchema } from '../src/lib/search-synonyms'

const ROOT = process.cwd()
const ALLOWED_BUSINESS_ID = 33
const REQUIRED_NAME_PART = 'onbike'

// Marcas nuevas. search_term en minúscula (filtra por texto). SIS usa la frase completa para no chocar con "sis" de Garmin.
const MARCAS: { name: string; search_term: string }[] = [
  { name: 'CONTINENTAL', search_term: 'continental' },
  { name: 'VITTORIA', search_term: 'vittoria' },
  { name: 'PIRELLI', search_term: 'pirelli' },
  { name: 'ZEFAL', search_term: 'zefal' },
  { name: 'FSA', search_term: 'fsa' },
  { name: 'CARBS FUEL', search_term: 'carbs fuel' },
  { name: 'SCIENCE IN SPORT', search_term: 'science in sport' },
  { name: 'MAURTEN', search_term: 'maurten' },
]

// Productos existentes que pasan a visible + Cashea. La guarda de nombre evita tocar otro producto si un id no coincide.
const EXISTENTES: { id: number; contiene: string }[] = [
  { id: 587, contiene: 'z adventure' },
  { id: 592, contiene: 'maurten' },
  { id: 593, contiene: 'carbs' },
  { id: 594, contiene: 'sis' },
  { id: 600, contiene: 'tripa' },
  { id: 601, contiene: 'tripa' },
]

// Grupos NUEVOS (se agregan a los existentes; un grupo cuyo primer término ya existe se omite).
const GRUPOS_NUEVOS: string[][] = [
  ['caucho', 'cauchos', 'cubierta', 'cubiertas', 'neumatico'],
  ['tripa', 'tripas', 'camara de aire'],
  ['termo', 'thermo', 'termos', 'bidon', 'botella'],
  ['portabidon', 'porta bidon', 'portatermo', 'porta termo'],
  ['gel', 'geles', 'energetico'],
  ['morado', 'purpura', 'violeta'],
  ['naranja', 'anaranjado'],
  ['gris', 'plomo'],
  ['bolso', 'alforja', 'bolsa de tubo'],
  ['vittoria', 'vitoria'],
  ['camelbak', 'camelback'],
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

interface ProdPrevio { id: number; name: string; active: boolean; available_in_pos: boolean; catalog_visibility: string; financing_excluded: boolean }
interface Respaldo { business_id: number; creado: string; productos: ProdPrevio[]; marcas_creadas: number[]; settings: Record<string, unknown> }

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
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, settings: true } })
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!biz.name.toLowerCase().includes(REQUIRED_NAME_PART)) throw new Error(`El negocio ${businessId} se llama "${biz.name}", no contiene "OnBike"; se aborta`)
    console.log(`Negocio verificado: ${biz.id} = "${biz.name}"`)

    // ---------- REVERSO ----------
    if (revertir) {
      const r = JSON.parse(readFileSync(revertir, 'utf8')) as Respaldo
      if (r.business_id !== businessId) throw new Error('El respaldo es de otro negocio')
      console.log(`Reverso desde ${revertir}: ${r.productos.length} productos, ${r.marcas_creadas.length} marcas a ocultar, settings previo.`)
      if (!APPLY) { console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar'); return }
      for (const p of r.productos) {
        await prisma.product.update({ where: { id: p.id }, data: { active: p.active, available_in_pos: p.available_in_pos, catalog_visibility: p.catalog_visibility as 'visible', financing_excluded: p.financing_excluded } })
      }
      if (r.marcas_creadas.length) await prisma.brand.updateMany({ where: { id: { in: r.marcas_creadas }, business_id: businessId }, data: { visible: false } })
      await prisma.business.update({ where: { id: businessId }, data: { settings: r.settings as object } })
      console.log('REVERSO HECHO. Los productos creados por el Excel se ocultan aparte (ver instrucciones del paquete).')
      return
    }

    // ---------- (a) marcas ----------
    const marcasExistentes = await prisma.brand.findMany({ where: { business_id: businessId }, select: { id: true, name: true, order: true } })
    const nombresExistentes = new Set(marcasExistentes.map(m => m.name.toLowerCase()))
    const faltan = MARCAS.filter(m => !nombresExistentes.has(m.name.toLowerCase()))
    let orden = marcasExistentes.reduce((mx, m) => Math.max(mx, m.order), 0)
    console.log(`\nMarcas: ${MARCAS.length - faltan.length} ya existen, ${faltan.length} por crear: ${faltan.map(m => m.name).join(', ') || '(ninguna)'}`)

    // ---------- (b) productos existentes ----------
    const prods = await prisma.product.findMany({
      where: { business_id: businessId, id: { in: EXISTENTES.map(e => e.id) } },
      select: { id: true, name: true, active: true, available_in_pos: true, catalog_visibility: true, financing_excluded: true },
    })
    const aTocar: ProdPrevio[] = []
    for (const e of EXISTENTES) {
      const p = prods.find(x => x.id === e.id)
      if (!p) { console.log(`  [AVISO] id ${e.id} no existe en el negocio ${businessId}: se omite`); continue }
      if (!p.name.toLowerCase().includes(e.contiene)) { console.log(`  [AVISO] id ${e.id} se llama "${p.name}" y no contiene "${e.contiene}": se omite por seguridad`); continue }
      const ok = p.active && p.available_in_pos && p.catalog_visibility === 'visible' && !p.financing_excluded
      console.log(`  id ${p.id} "${p.name}" -> activo=${p.active} pos=${p.available_in_pos} catalogo=${p.catalog_visibility} sin_cashea=${p.financing_excluded} ${ok ? '(ya OK)' : '(se corrige)'}`)
      if (!ok) aTocar.push({ ...p, catalog_visibility: String(p.catalog_visibility) })
    }

    // ---------- (c) sinónimos ----------
    const previo = (biz.settings ?? {}) as Record<string, unknown>
    const actuales = Array.isArray(previo.search_synonyms) ? (previo.search_synonyms as string[][]) : []
    const nuevosValid = synonymsInputSchema.parse(GRUPOS_NUEVOS)
    const primeros = new Set(actuales.map(g => g[0]))
    const terminosUsados = new Set(actuales.flat())
    const agregar: string[][] = []
    for (const g of nuevosValid) {
      const solapa = g.filter(t => terminosUsados.has(t))
      if (primeros.has(g[0]) || solapa.length) { console.log(`  [SINONIMO OMITIDO] ${g.join(' | ')} (ya existe/solapa: ${solapa.join(', ') || g[0]})`); continue }
      agregar.push(g); g.forEach(t => terminosUsados.add(t))
    }
    const finales = synonymsInputSchema.parse([...actuales, ...agregar])
    console.log(`\nSinónimos: ${actuales.length} grupos actuales + ${agregar.length} nuevos = ${finales.length}`)
    for (const g of agregar) console.log(`  + ${g.join(' | ')}`)

    if (!APPLY) { console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar'); return }

    // respaldo ANTES de escribir
    const dir = join(ROOT, 'storage', 'respaldos')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `lote31oct_${businessId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    const creadas: number[] = []
    const respaldo: Respaldo = { business_id: businessId, creado: new Date().toISOString(), productos: aTocar, marcas_creadas: creadas, settings: previo }
    writeFileSync(file, JSON.stringify(respaldo, null, 2), 'utf8')
    console.log(`\nRespaldo: ${file}`)

    for (const m of faltan) {
      orden += 1
      const b = await prisma.brand.create({ data: { business_id: businessId, name: m.name, search_term: m.search_term, order: orden, visible: true } })
      creadas.push(b.id)
      writeFileSync(file, JSON.stringify(respaldo, null, 2), 'utf8') // actualiza ids creados
      console.log(`  marca creada: ${b.id} ${b.name}`)
    }
    for (const p of aTocar) {
      await prisma.product.update({ where: { id: p.id }, data: { active: true, available_in_pos: true, catalog_visibility: 'visible', financing_excluded: false } })
      console.log(`  producto ${p.id} -> visible + Cashea`)
    }
    if (agregar.length) await prisma.business.update({ where: { id: businessId }, data: { settings: { ...previo, search_synonyms: finales } } })
    console.log(`\nHECHO. REVERSO: npx ts-node scripts/_lote_31oct_previo.ts --business-id ${businessId} --revertir "${file}" --aplicar`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', msg(e)); process.exit(1) })
