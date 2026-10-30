// Descartable. Precarga el diccionario de sinónimos de búsqueda (settings.search_synonyms) SOLO del negocio 33 (OnBike).
// Por defecto es SIMULACION: solo escribe con --aplicar, y antes guarda el settings previo en storage/respaldos/.
// Uso (desde la raíz del proyecto):
//   export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"es2020"}'
//   npx ts-node scripts/_sinonimos_onbike.ts --business-id 33            (simulacion)
//   npx ts-node scripts/_sinonimos_onbike.ts --business-id 33 --aplicar  (respalda y escribe)
// Reemplaza search_synonyms completo; el resto de settings no se toca. Reverso: restaurar el JSON del respaldo.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { synonymsInputSchema } from '../src/lib/search-synonyms'

const ROOT = process.cwd()
const ALLOWED_BUSINESS_ID = 33
const REQUIRED_NAME_PART = 'onbike'

const GRUPOS: string[][] = [
  ['maillot', 'jersey', 'camisa', 'camiseta', 'franela de ciclismo'],
  ['pantaloneta', 'lycra', 'licra', 'culotte', 'bib', 'badana', 'short de ciclismo'],
  ['manguilla', 'manguillas', 'mangas', 'calentadores de brazo'],
  ['medias', 'calcetines'],
  ['lentes', 'gafas', 'anteojos', 'lentes de sol'],
  ['reloj', 'smartwatch', 'reloj inteligente'],
  ['ciclocomputador', 'gps de bici', 'computadora de bici', 'velocimetro'],
  ['audifonos', 'auriculares'],
  ['banda de pecho', 'pulsometro', 'sensor cardiaco'],
  ['correa', 'malla', 'pulsera'],
  ['luz', 'stop', 'radar'],
]

const args = process.argv.slice(2)
const APPLY = args.includes('--aplicar')
const opt = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

// .env.production tiene precedencia sobre .env (igual que Next); no se imprime nada
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

async function main(): Promise<void> {
  const bidArg = opt('--business-id')
  if (bidArg === null) throw new Error('Falta --business-id')
  const businessId = Number(bidArg)
  if (!Number.isInteger(businessId) || businessId !== ALLOWED_BUSINESS_ID) throw new Error(`--business-id debe ser exactamente ${ALLOWED_BUSINESS_ID} (recibido: ${bidArg})`)

  const grupos = synonymsInputSchema.parse(GRUPOS)
  const envFiles = loadEnv()
  const { prisma } = await import('../src/lib/prisma')
  console.log(`MODO: ${APPLY ? 'APLICAR (escribe en DB)' : 'SIMULACION (no escribe nada)'} · negocio ${businessId} · DB ${process.env.DB_NAME ?? '?'} @ ${process.env.DB_HOST ?? '127.0.0.1'} · env: ${envFiles}`)
  try {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, settings: true } })
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!biz.name.toLowerCase().includes(REQUIRED_NAME_PART)) throw new Error(`El negocio ${businessId} se llama "${biz.name}", no contiene "OnBike"; se aborta`)
    console.log(`Negocio verificado: ${biz.id} = "${biz.name}"`)

    const previo = (biz.settings ?? {}) as Record<string, unknown>
    const prevGrupos = Array.isArray(previo.search_synonyms) ? previo.search_synonyms.length : 0
    console.log(`search_synonyms actual: ${prevGrupos} grupos. Nuevo: ${grupos.length} grupos.`)
    for (const g of grupos) console.log(`  ${g.join(' | ')}`)

    if (!APPLY) { console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar'); return }

    const dir = join(ROOT, 'storage', 'respaldos')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `settings_${businessId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(previo, null, 2), 'utf8')
    console.log(`Respaldo del settings previo: ${file}`)

    // Escribe solo la clave, sobre el settings leído justo ahora (no pisa lo demás)
    await prisma.business.update({ where: { id: businessId }, data: { settings: { ...previo, search_synonyms: grupos } } })
    console.log(`HECHO: ${grupos.length} grupos guardados en el negocio ${businessId}.`)
    console.log(`REVERSO: restaurar settings desde ${file} (UPDATE businesses SET settings = <contenido del JSON> WHERE id = ${businessId};)`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', msg(e)); process.exit(1) })
