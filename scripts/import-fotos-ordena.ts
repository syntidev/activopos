// Importa la portada, el logo y las fotos de los platos de un negocio desde su sitio en ordena.menu y los deja como archivos PROPIOS de
// ActivoPOS (mismo almacenamiento y formato que las fotos subidas: storage/tenants/<negocio>/<tipo>/<uuid>.webp, 1200 px + miniatura 400 px).
//
//   Simulación (por defecto, no escribe nada):  npx ts-node --project tests/tsconfig.json scripts/import-fotos-ordena.ts [--slug cafeconbike | --business 55]
//   Aplicar (descarga, guarda, asigna y deja respaldo en scripts/backups/):  ... --aplicar
//   Revertir el último respaldo del negocio:                                  ... --revertir
//
// Las fotos de platos se asignan por NOMBRE (sin acentos ni mayúsculas); los platos sin foto en el origen quedan como están.
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ROOT = path.join(__dirname, '..')
const ORIGEN = 'https://cafeconbike.ordena.menu'
const MAX_BYTES = 8 * 1024 * 1024
const BACKUPS = path.join(__dirname, 'backups')

function loadEnvFile(file: string): void {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] = process.env[m[1]] ?? m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const dbHost = process.env.DB_HOST ?? '127.0.0.1'
const loopback = dbHost === '127.0.0.1' || dbHost === 'localhost'
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: dbHost, user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '', database: process.env.DB_NAME ?? 'activopos',
    connectionLimit: 3, ...(loopback ? { allowPublicKeyRetrieval: true } : {}),
  }),
})

const args = process.argv.slice(2)
const flag = (n: string): boolean => args.includes('--' + n)
const opt = (n: string): string | null => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] ?? null) : null }

const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

interface Origen { covers: string[]; logo: string | null; items: { nombre: string; url: string }[] }
type Tipo = 'logo' | 'catalog_cover' | 'products'
interface Descargado { url: string; thumb: string; archivos: string[] }

async function leerOrigen(): Promise<Origen> {
  const res = await fetch(ORIGEN, { headers: { 'User-Agent': 'ActivoPOS-importador' } })
  if (!res.ok) throw new Error('No se pudo leer ' + ORIGEN + ' (' + res.status + ')')
  const html = (await res.text()).replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  const absolutas = (re: RegExp): string[] => Array.from(new Set(Array.from(html.matchAll(re), m => m[0])))
  const covers = absolutas(/https?:\/\/[^"'\s]+\/storage\/tenants\/\d+\/hero_slot_\d+\.webp/g).sort().slice(0, 3)
  const logo = absolutas(/https?:\/\/[^"'\s]+\/storage\/tenants\/\d+\/logo\.[a-z]+/g)[0] ?? null
  const tenant = /\/storage\/tenants\/(\d+)\//.exec(covers[0] ?? logo ?? '')?.[1] ?? null
  const items = new Map<string, string>()
  for (const m of Array.from(html.matchAll(/\{"id":"[^"]*","nombre":"((?:[^"\\]|\\.)*)"[^{}]*?"image_path":"((?:[^"\\]|\\.)+)"/g))) {
    if (!tenant) break
    const nombre = JSON.parse('"' + m[1] + '"') as string
    const ruta = (JSON.parse('"' + m[2] + '"') as string).replace(/^\/+/, '')
    if (!items.has(nombre)) items.set(nombre, ORIGEN + '/storage/tenants/' + tenant + '/' + ruta)
  }
  return { covers, logo, items: Array.from(items, ([nombre, url]) => ({ nombre, url })) }
}

async function descargar(url: string, bid: number, tipo: Tipo): Promise<Descargado> {
  if (!url.startsWith(ORIGEN + '/')) throw new Error('URL fuera del origen permitido: ' + url)
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!res.ok || buf.length === 0 || buf.length > MAX_BYTES) throw new Error('Descarga inválida (' + res.status + ', ' + buf.length + ' bytes): ' + url)
  const dir = path.join(ROOT, 'storage', 'tenants', String(bid), tipo)
  fs.mkdirSync(dir, { recursive: true })
  const full = randomUUID() + '.webp'
  const thumb = randomUUID() + '_thumb.webp'
  await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(dir, full))
  await sharp(buf).resize(400, 400, { fit: 'cover' }).webp({ quality: 75 }).toFile(path.join(dir, thumb))
  const base = '/storage/tenants/' + bid + '/' + tipo + '/'
  return { url: base + full, thumb: base + thumb, archivos: [path.join(dir, full), path.join(dir, thumb)] }
}

async function revertir(bid: number): Promise<void> {
  const files = fs.existsSync(BACKUPS) ? fs.readdirSync(BACKUPS).filter(f => f.startsWith('import-fotos-ordena-' + bid + '-') && f.endsWith('.json') && !f.endsWith('.revertido.json')).sort() : []
  const last = files[files.length - 1]
  if (!last) { console.log('No hay respaldo para el negocio ' + bid); return }
  const b = JSON.parse(fs.readFileSync(path.join(BACKUPS, last), 'utf-8')) as {
    before: { logo_path: string | null; catalog_cover_path: string | null; catalog_cover_path_2: string | null; catalog_cover_path_3: string | null }
    productos: { id: number; images: string | null }[]; archivos: string[]
  }
  await prisma.business.update({ where: { id: bid }, data: b.before })
  for (const p of b.productos) await prisma.product.updateMany({ where: { id: p.id, business_id: bid }, data: { images: p.images } })
  const permitido = path.join(ROOT, 'storage', 'tenants', String(bid)) + path.sep
  for (const f of b.archivos) if (path.resolve(f).startsWith(permitido) && fs.existsSync(f)) fs.rmSync(f)
  fs.renameSync(path.join(BACKUPS, last), path.join(BACKUPS, last.replace('.json', '.revertido.json')))
  console.log('Revertido con ' + last + ': ' + b.productos.length + ' platos, ' + b.archivos.length + ' archivos.')
}

async function main(): Promise<void> {
  const id = opt('business')
  const business = await prisma.business.findFirst({ where: id ? { id: Number(id) } : { catalog_slug: opt('slug') ?? 'cafeconbike' }, select: { id: true, name: true, logo_path: true, catalog_cover_path: true, catalog_cover_path_2: true, catalog_cover_path_3: true } })
  if (!business) throw new Error('Negocio no encontrado')
  const bid = business.id
  console.log('Negocio ' + bid + ' · ' + business.name)

  if (flag('revertir')) { await revertir(bid); return }

  const origen = await leerOrigen()
  const productos = await prisma.product.findMany({ where: { business_id: bid, active: true }, select: { id: true, name: true, images: true } })
  const porNombre = new Map(productos.map(p => [plano(p.name), p]))
  const asignables = origen.items.flatMap(i => { const p = porNombre.get(plano(i.nombre)); return p ? [{ ...i, producto: p }] : [] })
  const sinPlato = origen.items.filter(i => !porNombre.has(plano(i.nombre))).map(i => i.nombre)

  console.log('Origen: ' + origen.covers.length + ' portada(s), ' + (origen.logo ? 'logo' : 'sin logo') + ', ' + origen.items.length + ' plato(s) con foto')
  origen.covers.forEach((u, i) => console.log('  portada ' + (i + 1) + ': ' + u))
  if (origen.logo) console.log('  logo: ' + origen.logo)
  asignables.forEach(a => console.log('  plato "' + a.producto.name + '" (#' + a.producto.id + ') ← ' + a.url))
  if (sinPlato.length > 0) console.log('  SIN plato equivalente en ActivoPOS (se omiten): ' + sinPlato.join(', '))

  if (!flag('aplicar')) { console.log('\nSIMULACIÓN: no se escribió nada. Para aplicar: agrega --aplicar'); return }

  const archivos: string[] = []
  const before = { logo_path: business.logo_path, catalog_cover_path: business.catalog_cover_path, catalog_cover_path_2: business.catalog_cover_path_2, catalog_cover_path_3: business.catalog_cover_path_3 }
  const respaldo = { business_id: bid, creado: new Date().toISOString(), before, productos: asignables.map(a => ({ id: a.producto.id, images: a.producto.images })), archivos }
  fs.mkdirSync(BACKUPS, { recursive: true })
  const archivoRespaldo = path.join(BACKUPS, 'import-fotos-ordena-' + bid + '-' + Date.now() + '.json')
  const guardar = (): void => fs.writeFileSync(archivoRespaldo, JSON.stringify(respaldo, null, 2))
  guardar()

  const data: Record<string, string> = {}
  for (const [i, u] of Array.from(origen.covers.entries())) {
    const d = await descargar(u, bid, 'catalog_cover'); archivos.push(...d.archivos); guardar()
    data[i === 0 ? 'catalog_cover_path' : 'catalog_cover_path_' + (i + 1)] = d.url
  }
  if (origen.logo) { const d = await descargar(origen.logo, bid, 'logo'); archivos.push(...d.archivos); guardar(); data.logo_path = d.url }
  if (Object.keys(data).length > 0) await prisma.business.update({ where: { id: bid }, data })
  for (const a of asignables) {
    const d = await descargar(a.url, bid, 'products'); archivos.push(...d.archivos); guardar()
    await prisma.product.updateMany({ where: { id: a.producto.id, business_id: bid }, data: { images: JSON.stringify([d.url]) } })
  }
  console.log('\nAPLICADO. Respaldo: ' + path.relative(ROOT, archivoRespaldo) + ' (' + archivos.length + ' archivos). Revertir: ... --revertir')
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
