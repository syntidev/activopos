// Seed idempotente de la Carta: carga el menu de Cafe con Bike (scripts/data/cafeconbike.json: 38 productos, 14 tamanos)
// en un negocio de PRUEBA local (catalog_slug 'cafeconbike-carta', plantilla 'carta'). Solo escribe filas de ese negocio.
// Uso: npx ts-node --project tests/tsconfig.json scripts/seed-carta-demo.ts
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { hashSync } from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function loadEnvFile(file: string): void {
  const full = path.join(__dirname, '..', file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) process.env[match[1]] = process.env[match[1]] ?? match[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const dbHost = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback = dbHost === '127.0.0.1' || dbHost === 'localhost'
const adapter = new PrismaMariaDb({
  host: dbHost,
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'activopos',
  connectionLimit: 5,
  ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
})
const prisma = new PrismaClient({ adapter })

export const CARTA_DEMO_SLUG = 'cafeconbike-carta'
/** Existencias simbolicas: un plato de cocina no lleva inventario, pero el catalogo y el pedido validan stock. */
const STOCK_PLATO = 999

interface Tamano { nombre: string; precio_usd: number; descripcion: string }
interface ProductoJson {
  id: number; categoria: string; nombre: string; descripcion: string; precio_usd: number
  destacado: boolean; etiquetas: string; nota: string; foto_url: string; activo: boolean; tamanos: Tamano[]
}
interface MenuJson { categorias: string[]; productos: ProductoJson[] }

const HORARIO_DIA: [string, string][] = [['07:00', '22:00']]
const HORARIO = { mon: HORARIO_DIA, tue: HORARIO_DIA, wed: HORARIO_DIA, thu: HORARIO_DIA, fri: HORARIO_DIA, sat: HORARIO_DIA, sun: HORARIO_DIA }

async function ensurePaymentMethod(businessId: number, name: string, type: 'cash' | 'transfer' | 'zelle', order: number): Promise<number> {
  const found = await prisma.paymentMethod.findFirst({ where: { business_id: businessId, name } })
  if (found) return found.id
  return (await prisma.paymentMethod.create({ data: { business_id: businessId, name, type, sort_order: order, is_active: true } })).id
}

async function main(): Promise<void> {
  const menu = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cafeconbike.json'), 'utf-8')) as MenuJson

  const existing = await prisma.business.findFirst({ where: { catalog_slug: CARTA_DEMO_SLUG } })
  const base = {
    name: 'Cafe con Bike (demo carta)', catalog_title: 'Cafe con Bike', catalog_slug: CARTA_DEMO_SLUG, catalog_active: true,
    catalog_template: 'carta', catalog_plan: 'negocio_activo', subscription_active: true, phone: '04145550123', city: 'Porlamar',
    catalog_desc: 'Hamburguesas, ciabattas y cortes a las brasas. Pide desde tu telefono y te escribimos por WhatsApp.',
    catalog_hours: 'Todos los dias de 7:00 am a 10:00 pm', segment: 'restaurante',
  }
  const business = existing
    ? await prisma.business.update({ where: { id: existing.id }, data: base })
    : await prisma.business.create({ data: base })
  const bid = business.id

  // POST /api/catalog/[slug]/order atribuye las reservas automaticas al admin del negocio: sin uno responde 500.
  // Contrasena aleatoria que nadie conoce: este usuario no es para iniciar sesion.
  const admin = await prisma.user.findFirst({ where: { business_id: bid, role: 'admin' }, select: { id: true } })
  if (!admin) {
    await prisma.user.create({
      data: { business_id: bid, name: 'Admin Carta demo', email: 'admin@cafeconbike-carta.invalid', role: 'admin', is_active: true, password: hashSync(crypto.randomBytes(24).toString('hex'), 10) },
    })
  }

  const efectivo = await ensurePaymentMethod(bid, 'Efectivo USD', 'cash', 1)
  const zelle = await ensurePaymentMethod(bid, 'Zelle', 'zelle', 2)
  await ensurePaymentMethod(bid, 'Pago Movil', 'transfer', 3)
  const prev = (business.settings ?? {}) as Record<string, unknown>
  await prisma.business.update({
    where: { id: bid },
    data: { settings: { ...prev, carta_preset: 'brasa', carta_style: 'casual', carta_hours: HORARIO, catalog_divisa_methods: [efectivo, zelle] } },
  })

  const user = await prisma.user.findFirst({ select: { id: true } })
  if (!user) throw new Error('No hay ningun usuario en la BD para firmar el stock inicial (created_by).')

  const categoryIds = new Map<string, number>()
  for (let i = 0; i < menu.categorias.length; i++) {
    const name = menu.categorias[i]
    const found = await prisma.category.findFirst({ where: { business_id: bid, name } })
    const row = found
      ? await prisma.category.update({ where: { id: found.id }, data: { sort_order: i, active: true } })
      : await prisma.category.create({ data: { business_id: bid, name, sort_order: i, active: true } })
    categoryIds.set(name, row.id)
  }

  let conTamanos = 0
  let tamanos = 0
  for (const p of menu.productos) {
    const precios = p.tamanos.length > 0 ? p.tamanos.map(t => t.precio_usd) : [p.precio_usd]
    const data = {
      category_id: categoryIds.get(p.categoria) ?? null, description: p.descripcion || null,
      price_per_unit_usd: Math.min(...precios), is_featured: p.destacado, active: p.activo,
      badge: /nuevo/i.test(p.etiquetas) ? 'nuevo' : 'none', has_variants: p.tamanos.length > 0,
      show_in_catalog: true, available_in_pos: true, catalog_visibility: 'visible' as const,
    }
    const found = await prisma.product.findFirst({ where: { business_id: bid, name: p.nombre } })
    const product = found
      ? await prisma.product.update({ where: { id: found.id }, data })
      : await prisma.product.create({ data: { business_id: bid, name: p.nombre, ...data } })

    if (p.tamanos.length > 0) {
      conTamanos++
      for (let i = 0; i < p.tamanos.length; i++) {
        const t = p.tamanos[i]
        const vFound = await prisma.productVariant.findFirst({ where: { product_id: product.id, valor: t.nombre } })
        const vData = { tipo: 'personalizado', variant_group: 'Tamano', price_usd: t.precio_usd, precio_extra: 0, stock: STOCK_PLATO, sort_order: i, is_active: true }
        if (vFound) await prisma.productVariant.update({ where: { id: vFound.id }, data: vData })
        else await prisma.productVariant.create({ data: { product_id: product.id, valor: t.nombre, ...vData } })
        tamanos++
      }
    } else {
      const has = await prisma.inventoryEntry.count({ where: { business_id: bid, product_id: product.id } })
      if (has === 0) {
        await prisma.inventoryEntry.create({ data: { business_id: bid, product_id: product.id, quantity: STOCK_PLATO, entry_type: 'adjustment', notes: 'Seed Carta demo', created_by: user.id } })
      }
    }
  }
  console.log('Carta demo lista: negocio ' + bid + ' (/catalogo-carta/' + CARTA_DEMO_SLUG + '), ' + menu.productos.length + ' platos, ' + conTamanos + ' con tamanos (' + tamanos + ' tamanos).')
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
