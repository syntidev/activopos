// Descartable, para el VPS. Enlaza fotos YA preparadas (carpeta local) a los productos Garmin del negocio 33.
// No descarga nada de la web. Por defecto es SIMULACION: solo escribe con --aplicar.
// Uso (desde /var/www/activopos):
//   export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","target":"es2020"}'
//   npx ts-node scripts/_garmin_imagenes_prod.ts --business-id 33 --fotos /root/garmin_fotos            (simulacion)
//   npx ts-node scripts/_garmin_imagenes_prod.ts --business-id 33 --fotos /root/garmin_fotos --aplicar  (escribe)
// Carpeta de fotos: "{nombre exacto del producto}/1.webp..3.webp". Se enlaza por nombre exacto = products.name.
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const ROOT = process.cwd()
const ALLOWED_BUSINESS_ID = 33
const GARMIN_BRAND_ID = 1
const REQUIRED_NAME_PART = 'onbike'
const PHOTOS_PER_PRODUCT = 3
const MAX_SIZE = 5 * 1024 * 1024 // mismo tope que el endpoint de upload

const args = process.argv.slice(2)
const flag = (n: string): boolean => args.includes(n)
const opt = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
const APPLY = flag('--aplicar')

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const hasImages = (raw: string | null): boolean => !!raw && !['', '[]', 'null'].includes(raw.trim())
// Nombres con ®, ™, ē: se comparan en NFC para que no dependa de como el SO guardo el nombre de la carpeta
const nfc = (s: string): string => s.normalize('NFC')
const sqlStr = (s: string | null): string => (s === null ? 'NULL' : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`)

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

// Copia de los parametros de src/app/api/upload/image/route.ts:60-80 (type 'products').
async function saveProductImage(buffer: Buffer, businessId: number, written: string[]): Promise<string> {
  const meta = await sharp(buffer).metadata()
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('formato no JPG/PNG/WebP')
  const filenameFull = `${randomUUID()}.webp`
  const filenameThumb = `${randomUUID()}_thumb.webp`
  const uploadDir = join(ROOT, 'storage', 'tenants', String(businessId), 'products')
  const urlBase = `/storage/tenants/${businessId}/products`
  await mkdir(uploadDir, { recursive: true, mode: 0o755 })
  const fullData = await sharp(buffer).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
  const thumbData = await sharp(buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 75 }).toBuffer()
  await writeFile(join(uploadDir, filenameFull), fullData); written.push(join(uploadDir, filenameFull))
  await writeFile(join(uploadDir, filenameThumb), thumbData); written.push(join(uploadDir, filenameThumb))
  return `${urlBase}/${filenameFull}`
}

interface Reverse { id: number; original: string | null; files: string[] }

async function main(): Promise<void> {
  // Guarda 1a: parametro explicito y solo 33
  const bidArg = opt('--business-id')
  if (bidArg === null) throw new Error('Falta --business-id')
  const businessId = Number(bidArg)
  if (!Number.isInteger(businessId) || businessId !== ALLOWED_BUSINESS_ID) throw new Error(`--business-id debe ser exactamente ${ALLOWED_BUSINESS_ID} (recibido: ${bidArg})`)
  const fotosDir = opt('--fotos')
  if (!fotosDir) throw new Error('Falta --fotos <carpeta>')
  if (!existsSync(fotosDir) || !statSync(fotosDir).isDirectory()) throw new Error(`Carpeta de fotos no existe: ${fotosDir}`)

  const envFiles = loadEnv()
  const { prisma } = await import('../src/lib/prisma')
  console.log(`MODO: ${APPLY ? 'APLICAR (escribe archivos y DB)' : 'SIMULACION (no escribe nada)'} · negocio ${businessId} · DB ${process.env.DB_NAME ?? '?'} @ ${process.env.DB_HOST ?? '127.0.0.1'} · env: ${envFiles}`)
  console.log(`Storage destino: ${join(ROOT, 'storage', 'tenants', String(businessId), 'products')}`)
  try {
    // Guarda 1b: el negocio 33 debe llamarse OnBike
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } })
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!biz.name.toLowerCase().includes(REQUIRED_NAME_PART)) throw new Error(`El negocio ${businessId} se llama "${biz.name}", no contiene "OnBike"; se aborta`)
    console.log(`Negocio verificado: ${biz.id} = "${biz.name}"`)
    const brand = await prisma.brand.findUnique({ where: { id: GARMIN_BRAND_ID }, select: { name: true } })
    console.log(`brand_id ${GARMIN_BRAND_ID} = "${brand?.name ?? '(no existe)'}"${brand?.name.toLowerCase() === 'garmin' ? '' : '  <-- ATENCION: no se llama GARMIN en esta DB'}`)

    // Guarda 2: todos los productos del negocio (para detectar nombres repetidos aunque sean de otra marca/inactivos)
    const all = await prisma.product.findMany({
      where: { business_id: businessId },
      select: { id: true, name: true, brand_id: true, active: true, images: true },
    })
    const garmin = all.filter(p => p.brand_id === GARMIN_BRAND_ID && p.active)
    const dirs = readdirSync(fotosDir).filter(d => statSync(join(fotosDir, d)).isDirectory())

    let linked = 0, photos = 0
    const skipped: string[] = [], errs: string[] = [], reverse: Reverse[] = []
    for (const dir of dirs) {
      const same = all.filter(p => nfc(p.name) === nfc(dir))
      if (same.length === 0) { skipped.push(`"${dir}": ningun producto con ese nombre exacto en negocio ${businessId}`); continue }
      if (same.length > 1) { skipped.push(`"${dir}": ${same.length} productos con ese nombre (ambiguo), ids ${same.map(p => p.id).join(',')}`); continue }
      const p = same[0]
      if (p.brand_id !== GARMIN_BRAND_ID || !p.active) { skipped.push(`"${dir}": producto ${p.id} no es Garmin activo (brand_id=${p.brand_id}, active=${p.active})`); continue }
      // Guarda 4: no sobrescribir
      if (hasImages(p.images)) { skipped.push(`"${dir}": producto ${p.id} ya tiene imagen`); continue }
      // Guarda 3: 1..3 como maximo
      const files: Buffer[] = []
      for (let i = 1; i <= PHOTOS_PER_PRODUCT; i++) {
        const f = join(fotosDir, dir, `${i}.webp`)
        if (!existsSync(f)) { errs.push(`"${dir}": falta ${i}.webp`); continue }
        const buf = readFileSync(f)
        if (buf.length === 0 || buf.length > MAX_SIZE) { errs.push(`"${dir}": ${i}.webp vacio o > 5 MB`); continue }
        try { await sharp(buf).metadata() } catch { errs.push(`"${dir}": ${i}.webp no es una imagen valida`); continue }
        files.push(buf)
      }
      if (!files.length) { skipped.push(`"${dir}": sin fotos validas`); continue }
      if (!APPLY) { console.log(`HARIA "${dir}": producto ${p.id} <- ${files.length} fotos`); linked++; photos += files.length; reverse.push({ id: p.id, original: p.images, files: [] }); continue }

      const written: string[] = []
      try {
        const urls: string[] = []
        for (const b of files) urls.push(await saveProductImage(b, businessId, written))
        // Guarda 4 de nuevo en el WHERE: no pisa nada aunque cambie entre lectura y escritura
        const upd = await prisma.product.updateMany({
          where: { id: p.id, business_id: businessId, brand_id: GARMIN_BRAND_ID, active: true, OR: [{ images: null }, { images: '' }, { images: '[]' }, { images: 'null' }] },
          data: { images: JSON.stringify(urls) },
        })
        if (upd.count !== 1) {
          for (const w of written) await unlink(w).catch(() => undefined)
          skipped.push(`"${dir}": producto ${p.id} cambio durante la corrida (ya tiene imagen); archivos revertidos`)
          continue
        }
        console.log(`HIZO "${dir}": producto ${p.id} <- ${urls.length} fotos`)
        linked++; photos += urls.length; reverse.push({ id: p.id, original: p.images, files: written })
      } catch (e) {
        for (const w of written) await unlink(w).catch(() => undefined)
        errs.push(`"${dir}": ${msg(e)} (archivos revertidos)`)
      }
    }

    // Para que Carlos decida: todos los Garmin activos que siguen sin imagen despues de esta corrida
    const linkedIds = new Set(APPLY ? reverse.map(r => r.id) : [])
    const sinImagen = garmin.filter(p => !hasImages(p.images) && !linkedIds.has(p.id))
    console.log(`\nGARMIN ACTIVOS SIN IMAGEN${APPLY ? '' : ' (hoy, antes de aplicar)'} (${sinImagen.length}):`)
    for (const p of sinImagen) {
      const sera = !APPLY && reverse.some(r => r.id === p.id) ? '  [esta corrida le pondria fotos]' : ''
      console.log(`  ${p.id}\t${p.name}${sera}`)
    }

    console.log(`\nRESUMEN (${APPLY ? 'APLICADO' : 'SIMULACION'}): productos ${APPLY ? 'enlazados' : 'a enlazar'}: ${linked}; fotos: ${photos}`)
    console.log(`SALTADOS (${skipped.length}):\n${skipped.join('\n') || '-'}`)
    console.log(`ERRORES (${errs.length}):\n${errs.join('\n') || '-'}`)

    if (reverse.length) {
      console.log(`\nSQL DE REVERSO${APPLY ? '' : ' (si aplicas)'} (valor original de images):`)
      for (const r of reverse) console.log(`UPDATE products SET images = ${sqlStr(r.original)} WHERE id = ${r.id} AND business_id = ${businessId};`)
      if (APPLY) console.log(`Archivos creados (borrar tambien):\n${reverse.flatMap(r => r.files).join('\n')}`)
    }
    if (!APPLY) console.log('\nNo se escribio nada. Para aplicar: repetir con --aplicar')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error('ERROR:', msg(e)); process.exit(1) })
