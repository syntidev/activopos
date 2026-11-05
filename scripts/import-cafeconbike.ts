// Importa el menú de Café con Bike (categorías, productos, tamaños, destacados y GRUPOS DE OPCIONES) a un negocio con plantilla carta.
//
// Simulación por defecto (no escribe nada). Uso, en el VPS:
//   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/import-cafeconbike.ts --business=<id>
//   ... --business=<id> --aplicar                              escribe, tras guardar el respaldo en storage/respaldos
//   ... --business=<id> --revertir=storage/respaldos/<archivo> borra lo que esa corrida creó y devuelve lo que movió
//
// Idempotente: categoría por nombre, producto por nombre + categoría, tamaño por valor, grupo de opciones por (producto, nombre)
// y opción por nombre dentro de su grupo. Lo que ya existe no se toca (un grupo existente solo recibe las opciones que le falten).
// Datos: scripts/data/cafeconbike-menu.json y scripts/data/cafeconbike-opciones.json.
// Reubicación: "Ceviche de Cochino" pasa de "Pescado y mar" a "Cortes de carne" SOLO si sigue en la categoría vieja (si el admin
// lo movió a mano, se respeta); la corrida lo registra en el respaldo para poder devolverlo.
// Etiquetas: Product no tiene columna de etiquetas en este flujo → se omiten y se reportan.
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

type OpcionJson = string | { nombre: string; extra_usd?: number }
interface GrupoJson { producto: string; grupo: string; obligatorio: boolean; multiple: boolean; max?: number; opciones: OpcionJson[] }
interface Opciones { grupos: GrupoJson[] }
interface Opcion { nombre: string; extra: number }

interface Movido { id: number; de_categoria_id: number; de: string; a: string }
interface Respaldo {
  business_id: number; creado: string; aplicado: boolean
  existentes: { categorias: number[]; productos: number[] }
  creado_ids: { categorias: number[]; productos: number[]; variantes: number[]; grupos?: number[]; opciones?: number[] }
  movidos?: Movido[]
}

const arg = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string): boolean => process.argv.includes(`--${name}`)
const MAX_NAME = { categoria: 80, producto: 120, valor: 50, grupo: 60, opcion: 60 }

/** Productos que cambian de categoría respecto a la importación anterior (solo si siguen en `de`). */
const REUBICAR = new Map<string, { de: string; a: string }>([
  ['Ceviche de Cochino', { de: 'Pescado y mar', a: 'Cortes de carne' }],
])

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
const opcionesDe = (g: GrupoJson): Opcion[] => g.opciones.map(o => (typeof o === 'string' ? { nombre: o, extra: 0 } : { nombre: o.nombre, extra: o.extra_usd ?? 0 }))

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
  const nombres = menu.productos.map(p => p.nombre)
  if (new Set(nombres).size !== nombres.length) fail('hay dos productos con el mismo nombre en el menú (las opciones se asignan por nombre)')
  Array.from(REUBICAR).forEach(([nombre, r]) => {
    const p = menu.productos.find(x => x.nombre === nombre)
    if (!p) fail(`REUBICAR: "${nombre}" no está en el menú`)
    if (p.categoria !== r.a) fail(`REUBICAR: el JSON del menú tiene "${nombre}" en "${p.categoria}", se esperaba "${r.a}"`)
  })
}

function validarOpciones(menu: Menu, ops: Opciones): void {
  const productos = new Set(menu.productos.map(p => p.nombre))
  const gruposVistos = new Set<string>()
  for (const g of ops.grupos) {
    if (!productos.has(g.producto)) fail(`opciones: el producto "${g.producto}" no está en el menú`)
    if (!g.grupo.trim() || g.grupo.length > MAX_NAME.grupo) fail(`opciones: nombre de grupo inválido en "${g.producto}"`)
    const k = `${g.producto}|${g.grupo.toLowerCase()}`
    if (gruposVistos.has(k)) fail(`opciones: grupo repetido "${g.grupo}" en "${g.producto}"`)
    gruposVistos.add(k)
    const os = opcionesDe(g)
    if (os.length === 0) fail(`opciones: "${g.grupo}" de "${g.producto}" no tiene opciones`)
    const nombres = new Set<string>()
    for (const o of os) {
      if (!o.nombre.trim() || o.nombre.length > MAX_NAME.opcion || !(o.extra >= 0)) fail(`opciones: opción inválida en "${g.grupo}" de "${g.producto}": ${o.nombre}`)
      if (nombres.has(o.nombre.toLowerCase())) fail(`opciones: opción repetida "${o.nombre}" en "${g.grupo}" de "${g.producto}"`)
      nombres.add(o.nombre.toLowerCase())
    }
    if (g.max !== undefined && (!g.multiple || !Number.isInteger(g.max) || g.max < 1 || g.max > os.length)) fail(`opciones: tope inválido en "${g.grupo}" de "${g.producto}"`)
  }
}

async function revertir(businessId: number, file: string): Promise<void> {
  if (!fs.existsSync(file)) fail(`no existe el respaldo ${file}`)
  const r = JSON.parse(fs.readFileSync(file, 'utf-8')) as Respaldo
  if (r.business_id !== businessId) fail(`el respaldo es del negocio ${r.business_id}, no del ${businessId}`)
  const { categorias, productos, variantes } = r.creado_ids
  const grupos = r.creado_ids.grupos ?? []
  const opciones = r.creado_ids.opciones ?? []
  const movidos = r.movidos ?? []
  const vendidos = await prisma.saleItem.count({ where: { OR: [{ product_id: { in: productos } }, { variant_id: { in: variantes } }] } })
  if (vendidos > 0) fail(`${vendidos} línea(s) de venta usan lo importado; no se revierte`)
  await prisma.$transaction([
    // 1) opciones y grupos de esta corrida (borrar un grupo arrastra sus opciones)
    prisma.productOption.deleteMany({ where: { id: { in: opciones }, group: { product: { business_id: businessId } } } }),
    prisma.productOptionGroup.deleteMany({ where: { id: { in: grupos }, product: { business_id: businessId } } }),
    // 2) lo que esta corrida movió vuelve a su categoría anterior
    ...movidos.map(m => prisma.product.updateMany({ where: { id: m.id, business_id: businessId }, data: { category_id: m.de_categoria_id } })),
    // 3) lo creado
    prisma.productVariant.deleteMany({ where: { id: { in: variantes }, product: { business_id: businessId } } }),
    prisma.product.deleteMany({ where: { id: { in: productos }, business_id: businessId } }),
    prisma.category.deleteMany({ where: { id: { in: categorias }, business_id: businessId, products: { none: {} } } }),
  ])
  console.log(`REVERTIDO negocio ${businessId}: ${opciones.length} opciones, ${grupos.length} grupos, ${movidos.length} movidos, ${variantes.length} tamaños, ${productos.length} productos, ${categorias.length} categorías`)
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
  const ops = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cafeconbike-opciones.json'), 'utf-8')) as Opciones
  validar(menu)
  validarOpciones(menu, ops)
  const aplicar = flag('aplicar')

  const cats = await prisma.category.findMany({ where: { business_id: businessId }, select: { id: true, name: true } })
  const catId = new Map(cats.map(c => [c.name, c.id]))
  const prods = await prisma.product.findMany({
    where: { business_id: businessId }, select: { id: true, name: true, category_id: true, variants: { select: { valor: true } } },
  })
  const prodKey = (name: string, cid: number | undefined): string => `${cid ?? 'null'}|${name}`
  const prodExist = new Map(prods.map(p => [prodKey(p.name, p.category_id ?? undefined), p]))

  /** Producto ya existente del menú: por nombre + categoría o, si es de los reubicados, en su categoría vieja (entonces hay que moverlo). */
  const resolver = (p: Item): { ex: (typeof prods)[number] | undefined; mover: { de: string; a: string } | null } => {
    const directo = prodExist.get(prodKey(p.nombre, catId.get(p.categoria)))
    if (directo) return { ex: directo, mover: null }
    const r = REUBICAR.get(p.nombre)
    const viejo = r ? prodExist.get(prodKey(p.nombre, catId.get(r.de))) : undefined
    return viejo && r ? { ex: viejo, mover: r } : { ex: undefined, mover: null }
  }
  const estado = menu.productos.map(p => ({ p, ...resolver(p) }))
  const existe = new Map(estado.map(e => [e.p.nombre, e.ex]))

  const nuevasCats = menu.categorias.filter(c => !catId.has(c.nombre))
  const nuevos = estado.filter(e => !e.ex).map(e => e.p)
  const aMover = estado.filter(e => e.ex && e.mover)
  const tamsFaltantes = estado.filter(e => e.ex).flatMap(e => e.p.tamanos.filter(t => !e.ex?.variants.some(v => v.valor === t.nombre)).map(t => ({ p: e.p, t })))
  const nTamNuevos = nuevos.reduce((n, p) => n + p.tamanos.length, 0) + tamsFaltantes.length

  // Opciones: grupo existente por (producto, nombre) → solo se agregan las opciones que falten; grupo ausente → se crea completo.
  const gruposEx = await prisma.productOptionGroup.findMany({
    where: { product: { business_id: businessId } }, select: { id: true, product_id: true, name: true, options: { select: { name: true, sort_order: true } } },
  })
  const gruposPorProducto = new Map<string, number>() // sort_order: los grupos nuevos van después de los que ya tiene el producto
  const planOps = ops.grupos.map(g => {
    const prodEx = existe.get(g.producto)
    const gEx = prodEx ? gruposEx.find(x => x.product_id === prodEx.id && x.name.toLowerCase() === g.grupo.toLowerCase()) : undefined
    const todas = opcionesDe(g)
    const faltan = gEx ? todas.filter(o => !gEx.options.some(x => x.name.toLowerCase() === o.nombre.toLowerCase())) : todas
    const base = prodEx ? gruposEx.filter(x => x.product_id === prodEx.id).length : 0
    const orden = base + (gruposPorProducto.get(g.producto) ?? 0)
    if (!gEx) gruposPorProducto.set(g.producto, (gruposPorProducto.get(g.producto) ?? 0) + 1)
    // las opciones que faltan van DESPUÉS de las que ya tiene el grupo (mayor sort_order + 1), no por cantidad
    const baseOpciones = gEx ? Math.max(-1, ...gEx.options.map(o => o.sort_order)) + 1 : 0
    return { g, productoId: prodEx?.id, grupoId: gEx?.id, baseOpciones, faltan, orden, nuevoGrupo: !gEx }
  }).filter(x => x.nuevoGrupo || x.faltan.length > 0)
  const nGrupos = planOps.filter(x => x.nuevoGrupo).length
  const nOpciones = planOps.reduce((n, x) => n + x.faltan.length, 0)

  console.log(`${aplicar ? 'APLICAR' : 'SIMULACIÓN'} negocio ${businessId} (${business.name})`)
  for (const c of nuevasCats) console.log(`  + categoría ${c.orden}. ${c.nombre}`)
  for (const p of nuevos) {
    const tams = p.tamanos.length ? ` | tamaños: ${p.tamanos.map(t => `${t.nombre} $${t.precio_usd}`).join(', ')}` : ''
    console.log(`  + producto [${p.categoria}] ${p.nombre} $${precioBase(p)}${p.destacado ? ' ★' : ''}${p.activo ? '' : ' (inactivo)'}${tams}`)
  }
  for (const e of aMover) console.log(`  ~ mover ${e.p.nombre}: ${e.mover?.de} → ${e.mover?.a}`)
  for (const { p, t } of tamsFaltantes) console.log(`  + tamaño ${t.nombre} $${t.precio_usd} en ${p.nombre}`)
  for (const x of planOps) {
    const regla = `${x.g.obligatorio ? 'obligatorio' : 'opcional'}, ${x.g.multiple ? 'varias' : 'una'}`
    console.log(x.nuevoGrupo
      ? `  + grupo [${x.g.producto}] ${x.g.grupo} (${regla}): ${x.faltan.map(o => (o.extra ? `${o.nombre} +$${o.extra}` : o.nombre)).join(', ')}`
      : `  + opciones en [${x.g.producto}] ${x.g.grupo}: ${x.faltan.map(o => o.nombre).join(', ')}`)
  }
  const conEtiquetas = menu.productos.filter(p => p.etiquetas.length)
  const conFoto = menu.productos.filter(p => p.foto_url)
  console.log(`Resumen: ${nuevasCats.length} categorías, ${nuevos.length} productos, ${nTamNuevos} tamaños, ${nuevos.filter(p => p.destacado).length} destacados nuevos, ${aMover.length} movidos, ${nGrupos} grupos de opciones, ${nOpciones} opciones`)
  console.log(`Omitido: etiquetas de ${conEtiquetas.length} productos (${Array.from(new Set(conEtiquetas.flatMap(p => p.etiquetas))).join(', ')}): C2 no existe`)
  console.log(`Omitido: ${conFoto.length} fotos externas (Product.images solo admite rutas propias)`)
  if (!aplicar) { console.log('Sin cambios. Usa --aplicar para escribir.'); return }
  if (!nuevasCats.length && !nuevos.length && !tamsFaltantes.length && !aMover.length && !planOps.length) { console.log('Nada que crear: ya está importado.'); return }

  const dir = path.join(__dirname, '..', 'storage', 'respaldos')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `cafeconbike-${businessId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const respaldo: Respaldo = {
    business_id: businessId, creado: new Date().toISOString(), aplicado: false,
    existentes: { categorias: cats.map(c => c.id), productos: prods.map(p => p.id) },
    creado_ids: { categorias: [], productos: [], variantes: [], grupos: [], opciones: [] },
    movidos: [],
  }
  fs.writeFileSync(file, JSON.stringify(respaldo, null, 1))

  const hecho = { categorias: [] as number[], productos: [] as number[], variantes: [] as number[], grupos: [] as number[], opciones: [] as number[] }
  const movidos: Movido[] = []
  await prisma.$transaction(async tx => {
    for (const c of nuevasCats) {
      const row = await tx.category.create({ data: { business_id: businessId, name: c.nombre, sort_order: c.orden } })
      catId.set(c.nombre, row.id); hecho.categorias.push(row.id)
    }
    const idNuevo = new Map<string, number>()
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
      hecho.productos.push(row.id); hecho.variantes.push(...row.variants.map(v => v.id)); idNuevo.set(p.nombre, row.id)
    }
    for (const e of aMover) {
      const destino = catId.get(e.mover?.a ?? '')
      const de = catId.get(e.mover?.de ?? '')
      if (!e.ex || destino === undefined || de === undefined) continue
      await tx.product.update({ where: { id: e.ex.id }, data: { category_id: destino } })
      movidos.push({ id: e.ex.id, de_categoria_id: de, de: e.mover?.de ?? '', a: e.mover?.a ?? '' })
    }
    for (const { p, t } of tamsFaltantes) {
      const ex = existe.get(p.nombre)
      if (!ex) continue
      const v = await tx.productVariant.create({ data: { product_id: ex.id, tipo: 'personalizado', valor: t.nombre, price_usd: t.precio_usd, sort_order: p.tamanos.indexOf(t) } })
      hecho.variantes.push(v.id)
      await tx.product.update({ where: { id: ex.id }, data: { has_variants: true } })
    }
    for (const x of planOps) {
      const productoId = x.productoId ?? idNuevo.get(x.g.producto)
      if (productoId === undefined) continue
      if (x.nuevoGrupo) {
        const row = await tx.productOptionGroup.create({
          data: {
            product_id: productoId, name: x.g.grupo, required: x.g.obligatorio, multiple: x.g.multiple, max_select: x.g.multiple ? (x.g.max ?? null) : null, sort_order: x.orden,
            options: { create: x.faltan.map((o, i) => ({ name: o.nombre, price_extra_usd: o.extra, sort_order: i })) },
          },
          include: { options: { select: { id: true } } },
        })
        hecho.grupos.push(row.id); hecho.opciones.push(...row.options.map(o => o.id))
      } else if (x.grupoId !== undefined) {
        for (let i = 0; i < x.faltan.length; i++) {
          const row = await tx.productOption.create({ data: { group_id: x.grupoId, name: x.faltan[i].nombre, price_extra_usd: x.faltan[i].extra, sort_order: x.baseOpciones + i } })
          hecho.opciones.push(row.id)
        }
      }
    }
  })
  respaldo.aplicado = true
  respaldo.creado_ids = hecho
  respaldo.movidos = movidos
  fs.writeFileSync(file, JSON.stringify(respaldo, null, 1))
  console.log(`APLICADO. Respaldo: ${path.relative(process.cwd(), file)}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
