// Importa el menú de Café con Bike (categorías, productos, tamaños, destacados) a un negocio con plantilla carta.
//
// Simulación por defecto (no escribe nada). Uso, en el VPS:
//   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/import-cafeconbike.ts --business=<id>
//   ... --business=<id> --aplicar                              escribe, tras guardar el respaldo en storage/respaldos
//   ... --business=<id> --revertir=storage/respaldos/<archivo> borra lo que esa corrida creó
//
// Idempotente: categoría por nombre, producto por nombre + categoría, tamaño por valor. Lo que ya existe no se toca.
// Etiquetas: Product no tiene columna de etiquetas (C2 no existe todavía) → se omiten y se reportan.
// Fotos: las URLs del xlsx son externas; Product.images solo admite rutas propias → se omiten y se reportan.
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import fs from 'fs'
import path from 'path'

function loadEnvFile(file: string): void {
  const full = path.join(__dirname, '..', file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) process.env[match[1]] = process.env[match[1]] ?? match[2].trim()
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const dbHost = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback = dbHost === '127.0.0.1' || dbHost === 'localhost'
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: dbHost,
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'activopos',
    connectionLimit: 5,
    ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
  }),
})

interface Tamano { nombre: string; precio_usd: number }
interface Item {
  nombre: string; categoria: string; descripcion: string | null; precio_usd: number; destacado: boolean
  etiquetas: string[]; nota: string | null; foto_url: string | null; activo: boolean; tamanos: Tamano[]
}
interface Menu { categorias: { orden: number; nombre: string }[]; productos: Item[] }
interface Respaldo {
  business_id: number; creado: string; aplicado: boolean
  existentes: { categorias: number[]; productos: number[] }
  creado_ids: { categorias: number[]; productos: number[]; variantes: number[] }
}

const arg = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string): boolean => process.argv.includes(`--${name}`)
const MAX_NAME = { categoria: 80, producto: 120, valor: 50 }

function fail(msg: string): never {
  console.error(`ABORTA: ${msg}`)
  process.exit(1)
}

/** Descripción pública del plato: descripción + nota (ej. "Incluye juguete"). */
function descripcionDe(p: Item): string | null {
  const partes = [p.descripcion?.trim(), p.nota?.trim()].filter((x): x is string => !!x)
  return partes.length ? partes.join(' · ') : null
}

const precioBase = (p: Item): number => (p.tamanos.length ? Math.min(...p.tamanos.map(t => t.precio_usd)) : p.precio_usd)

function validar(menu: Menu): void {
  const cats = new Set(menu.categorias.map(c => c.nombre))
  for (const c of menu.categorias) if (c.nombre.length > MAX_NAME.categoria) fail(`categoría muy larga: ${c.nombre}`)
  const vistos = new Set<string>()
  for (const p of menu.productos) {
    if (!cats.has(p.categoria)) fail(`producto "${p.nombre}" con categoría inexistente "${p.categoria}"`)
    if (p.nombre.length > MAX_NAME.producto) fail(`nombre muy largo: ${p.nombre}`)
    if (!(p.precio_usd >= 0)) fail(`precio inválido en "${p.nombre}"`)
    const k = `${p.categoria}|${p.nombre}`
    if (vistos.has(k)) fail(`producto repetido en el JSON: ${k}`)
    vistos.add(k)
    const vs = new Set<string>()
    for (const t of p.tamanos) {
      if (t.nombre.length > MAX_NAME.valor || !(t.precio_usd >= 0)) fail(`tamaño inválido en "${p.nombre}": ${t.nombre}`)
      if (vs.has(t.nombre)) fail(`tamaño repetido en "${p.nombre}": ${t.nombre}`)
      vs.add(t.nombre)
    }
  }
}

async function revertir(businessId: number, file: string): Promise<void> {
  if (!fs.existsSync(file)) fail(`no existe el respaldo ${file}`)
  const r = JSON.parse(fs.readFileSync(file, 'utf-8')) as Respaldo
  if (r.business_id !== businessId) fail(`el respaldo es del negocio ${r.business_id}, no del ${businessId}`)
  const { categorias, productos, variantes } = r.creado_ids
  const vendidos = await prisma.saleItem.count({ where: { OR: [{ product_id: { in: productos } }, { variant_id: { in: variantes } }] } })
  if (vendidos > 0) fail(`${vendidos} línea(s) de venta usan lo importado; no se revierte`)
  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { id: { in: variantes }, product: { business_id: businessId } } }),
    prisma.product.deleteMany({ where: { id: { in: productos }, business_id: businessId } }),
    prisma.category.deleteMany({ where: { id: { in: categorias }, business_id: businessId, products: { none: {} } } }),
  ])
  console.log(`REVERTIDO negocio ${businessId}: ${variantes.length} tamaños, ${productos.length} productos, ${categorias.length} categorías`)
}

async function main(): Promise<void> {
  const businessId = Number(arg('business'))
  if (!Number.isInteger(businessId) || businessId <= 0) fail('falta --business=<id>')
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, catalog_template: true } })
  if (!business) fail(`el negocio ${businessId} no existe`)
  if (business.catalog_template !== 'carta') fail(`el negocio ${businessId} (${business.name}) no tiene plantilla carta (tiene "${business.catalog_template}")`)

  const revFile = arg('revertir')
  if (revFile) return revertir(businessId, revFile)

  const menu = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cafeconbike-menu.json'), 'utf-8')) as Menu
  validar(menu)
  const aplicar = flag('aplicar')

  const cats = await prisma.category.findMany({ where: { business_id: businessId }, select: { id: true, name: true } })
  const catId = new Map(cats.map(c => [c.name, c.id]))
  const prods = await prisma.product.findMany({
    where: { business_id: businessId }, select: { id: true, name: true, category_id: true, variants: { select: { valor: true } } },
  })
  const prodKey = (name: string, cid: number | undefined): string => `${cid ?? 'null'}|${name}`
  const prodExist = new Map(prods.map(p => [prodKey(p.name, p.category_id ?? undefined), p]))

  const nuevasCats = menu.categorias.filter(c => !catId.has(c.nombre))
  const nuevos = menu.productos.filter(p => !prodExist.has(prodKey(p.nombre, catId.get(p.categoria))))
  const tamsFaltantes = menu.productos.filter(p => !nuevos.includes(p)).flatMap(p => {
    const ex = prodExist.get(prodKey(p.nombre, catId.get(p.categoria)))
    return p.tamanos.filter(t => !ex?.variants.some(v => v.valor === t.nombre)).map(t => ({ p, t }))
  })
  const nTamNuevos = nuevos.reduce((n, p) => n + p.tamanos.length, 0) + tamsFaltantes.length

  console.log(`${aplicar ? 'APLICAR' : 'SIMULACIÓN'} negocio ${businessId} (${business.name})`)
  for (const c of nuevasCats) console.log(`  + categoría ${c.orden}. ${c.nombre}`)
  for (const p of nuevos) {
    const tams = p.tamanos.length ? ` | tamaños: ${p.tamanos.map(t => `${t.nombre} $${t.precio_usd}`).join(', ')}` : ''
    console.log(`  + producto [${p.categoria}] ${p.nombre} $${precioBase(p)}${p.destacado ? ' ★' : ''}${p.activo ? '' : ' (inactivo)'}${tams}`)
  }
  for (const { p, t } of tamsFaltantes) console.log(`  + tamaño ${t.nombre} $${t.precio_usd} en ${p.nombre}`)
  const conEtiquetas = menu.productos.filter(p => p.etiquetas.length)
  const conFoto = menu.productos.filter(p => p.foto_url)
  console.log(`Resumen: ${nuevasCats.length} categorías, ${nuevos.length} productos, ${nTamNuevos} tamaños, ${nuevos.filter(p => p.destacado).length} destacados nuevos`)
  console.log(`Omitido: etiquetas de ${conEtiquetas.length} productos (${Array.from(new Set(conEtiquetas.flatMap(p => p.etiquetas))).join(', ')}): C2 no existe`)
  console.log(`Omitido: ${conFoto.length} fotos externas (Product.images solo admite rutas propias)`)
  if (!aplicar) { console.log('Sin cambios. Usa --aplicar para escribir.'); return }
  if (!nuevasCats.length && !nuevos.length && !tamsFaltantes.length) { console.log('Nada que crear: ya está importado.'); return }

  const dir = path.join(__dirname, '..', 'storage', 'respaldos')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `cafeconbike-${businessId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const respaldo: Respaldo = {
    business_id: businessId, creado: new Date().toISOString(), aplicado: false,
    existentes: { categorias: cats.map(c => c.id), productos: prods.map(p => p.id) },
    creado_ids: { categorias: [], productos: [], variantes: [] },
  }
  fs.writeFileSync(file, JSON.stringify(respaldo, null, 1))

  const hecho = { categorias: [] as number[], productos: [] as number[], variantes: [] as number[] }
  await prisma.$transaction(async tx => {
    for (const c of nuevasCats) {
      const row = await tx.category.create({ data: { business_id: businessId, name: c.nombre, sort_order: c.orden } })
      catId.set(c.nombre, row.id); hecho.categorias.push(row.id)
    }
    for (const p of nuevos) {
      const row = await tx.product.create({
        data: {
          business_id: businessId, category_id: catId.get(p.categoria), name: p.nombre, description: descripcionDe(p),
          // service: el catálogo nunca lo marca agotado (un plato no lleva inventario).
          sale_mode: 'service', product_type: 'simple', price_per_unit_usd: precioBase(p),
          has_variants: p.tamanos.length > 0, is_featured: p.destacado, active: p.activo,
          show_in_catalog: true, catalog_visibility: 'visible', available_in_pos: true, is_available: true, availability: 'in_stock',
          sort_order: menu.productos.indexOf(p),
          variants: { create: p.tamanos.map((t, i) => ({ tipo: 'personalizado', valor: t.nombre, price_usd: t.precio_usd, sort_order: i })) },
        },
        include: { variants: { select: { id: true } } },
      })
      hecho.productos.push(row.id); hecho.variantes.push(...row.variants.map(v => v.id))
    }
    for (const { p, t } of tamsFaltantes) {
      const ex = prodExist.get(prodKey(p.nombre, catId.get(p.categoria)))
      if (!ex) continue
      const v = await tx.productVariant.create({ data: { product_id: ex.id, tipo: 'personalizado', valor: t.nombre, price_usd: t.precio_usd, sort_order: p.tamanos.indexOf(t) } })
      hecho.variantes.push(v.id)
      await tx.product.update({ where: { id: ex.id }, data: { has_variants: true } })
    }
  })
  respaldo.aplicado = true
  respaldo.creado_ids = hecho
  fs.writeFileSync(file, JSON.stringify(respaldo, null, 1))
  console.log(`APLICADO. Respaldo: ${path.relative(process.cwd(), file)}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
