/**
 * Seed cuentas demo (Boutique Pro / Bodega Negocio / Cafetín Mostrador) — datos venezolanos reales.
 * Idempotente: busca cada cuenta por email antes de crear, no duplica en corridas repetidas.
 * boutique-demo además recibe categorías con color, productos con imágenes reales de Unsplash
 * y métodos de pago venezolanos si aún no los tiene.
 *
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-demo.ts
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

// Script standalone (ts-node, sin Next.js) — Next.js carga .env/.env.local automático
// en `next dev`/`next build`, pero un script suelto no. Réplica mínima de esa precedencia
// (sin agregar dotenv como dependencia nueva solo para esto).
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

// Mismo patrón de adapter que src/lib/prisma.ts — Prisma 7 en este proyecto usa
// driver adapters (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME), no DATABASE_URL simple.
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

const PASSWORD = 'Demo2026$'

interface DemoAccountSpec {
  ownerName: string
  businessName: string
  slug: string | null
  email: string
  city: string
  themeColor: string
  segment: string
  catalogPlan: 'inicio' | 'pro' | 'business'
  catalogActive: boolean
}

// Mismos datos de HANDOFF Sprint 84 — cuentas ya existentes en VPS, este script las verifica/recrea si faltan.
const ACCOUNTS: DemoAccountSpec[] = [
  {
    ownerName: 'Demo Pro', businessName: 'Boutique Demo Pro', slug: 'boutique-demo',
    email: 'demo-pro@activopos.com', city: 'Caracas', themeColor: '#0038BD',
    segment: 'boutique', catalogPlan: 'business', catalogActive: true,
  },
  {
    ownerName: 'Demo Negocio', businessName: 'Bodega Demo Negocio', slug: null,
    email: 'demo-negocio@activopos.com', city: 'Valencia', themeColor: '#16A34A',
    segment: 'bodega', catalogPlan: 'pro', catalogActive: false,
  },
  {
    ownerName: 'Demo Mostrador', businessName: 'Cafetín Demo Mostrador', slug: null,
    email: 'demo-mostrador@activopos.com', city: 'Maracaibo', themeColor: '#EF8E01',
    segment: 'cafeteria', catalogPlan: 'inicio', catalogActive: false,
  },
]

// Métodos de pago venezolanos base — mismo set mínimo que POST /api/onboarding/setup
// seedea para cualquier cuenta nueva (una cuenta sin métodos de pago no sirve para demo de POS).
const PAYMENT_METHODS: { name: string; type: Prisma.PaymentMethodCreateManyInput['type']; sort_order: number }[] = [
  { name: 'Efectivo Bs',  type: 'cash',     sort_order: 1 },
  { name: 'Efectivo USD', type: 'cash',     sort_order: 2 },
  { name: 'Pago Móvil',   type: 'transfer', sort_order: 3 },
  { name: 'Zelle',        type: 'zelle',    sort_order: 4 },
]

interface CategorySpec { name: string; color: string }

const BOUTIQUE_CATEGORIES: CategorySpec[] = [
  { name: 'Ropa',        color: '#0038BD' },
  { name: 'Calzado',     color: '#EF8E01' },
  { name: 'Accesorios',  color: '#16A34A' },
  { name: 'Otros',       color: '#6366F1' },
]

interface ProductSpec {
  name: string
  category: string
  price: number
  cost: number
  stock: number
  image: string // URL pública de Unsplash, verificada resoluble antes de escribir este script
}

// URLs verificadas con curl (200) contra images.unsplash.com antes de escribir este script.
const BOUTIQUE_PRODUCTS: ProductSpec[] = [
  { name: 'Camisa Oxford Blanca',   category: 'Ropa',       price: 25, cost: 12, stock: 18, image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80&auto=format&fit=crop' },
  { name: 'Pantalón Chino Beige',   category: 'Ropa',       price: 35, cost: 18, stock: 14, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80&auto=format&fit=crop' },
  { name: 'Vestido Floral',         category: 'Ropa',       price: 45, cost: 22, stock: 9,  image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80&auto=format&fit=crop' },
  { name: 'Zapatos Casuales',       category: 'Calzado',    price: 55, cost: 30, stock: 12, image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80&auto=format&fit=crop' },
  { name: 'Bolso de Cuero',         category: 'Accesorios', price: 65, cost: 35, stock: 7,  image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80&auto=format&fit=crop' },
  { name: 'Gorra Snapback',         category: 'Accesorios', price: 15, cost: 7,  stock: 20, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop' },
]

async function ensureBusiness(spec: DemoAccountSpec): Promise<{ businessId: number; userId: number; created: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { email: spec.email },
    select: { id: true, business_id: true },
  })
  if (existing) {
    console.log(`  ✓ ${spec.email} ya existe (business_id=${existing.business_id})`)
    return { businessId: existing.business_id, userId: existing.id, created: false }
  }

  const hashed = await bcrypt.hash(PASSWORD, 10)

  const result = await prisma.$transaction(async tx => {
    const biz = await tx.business.create({
      data: {
        name: spec.businessName,
        catalog_slug: spec.slug,
        catalog_active: spec.catalogActive,
        catalog_title: spec.businessName,
        city: spec.city,
        theme_color: spec.themeColor,
        segment: spec.segment,
        catalog_plan: spec.catalogPlan,
        onboarding_completed: true,
      },
    })

    const usr = await tx.user.create({
      data: {
        business_id: biz.id,
        name: spec.ownerName,
        email: spec.email,
        password: hashed,
        role: 'admin',
      },
    })

    await tx.paymentMethod.createMany({
      data: PAYMENT_METHODS.map(pm => ({ ...pm, business_id: biz.id })),
    })

    return { biz, usr }
  })

  console.log(`  + ${spec.email} creada (business_id=${result.biz.id})`)
  return { businessId: result.biz.id, userId: result.usr.id, created: true }
}

async function ensureBoutiqueCatalog(businessId: number, userId: number): Promise<void> {
  const existingProductCount = await prisma.product.count({ where: { business_id: businessId, active: true } })
  if (existingProductCount > 0) {
    console.log(`  ✓ boutique-demo ya tiene ${existingProductCount} producto(s) — catálogo no se re-siembra`)
    return
  }

  const categoryIds = new Map<string, number>()
  for (const cat of BOUTIQUE_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { business_id: businessId, name: cat.name } })
    if (existing) {
      categoryIds.set(cat.name, existing.id)
      continue
    }
    const created = await prisma.category.create({
      data: { business_id: businessId, name: cat.name, color: cat.color },
    })
    categoryIds.set(cat.name, created.id)
  }
  console.log(`  + ${categoryIds.size} categorías listas`)

  for (const p of BOUTIQUE_PRODUCTS) {
    const categoryId = categoryIds.get(p.category)
    await prisma.$transaction(async tx => {
      const product = await tx.product.create({
        data: {
          business_id: businessId,
          category_id: categoryId ?? null,
          name: p.name,
          price_per_unit_usd: p.price,
          cost_per_unit_usd: p.cost,
          images: JSON.stringify([p.image]),
          show_in_catalog: true,
          catalog_visibility: 'visible',
          available_in_pos: true,
          is_available: true,
        },
      })
      await tx.inventoryEntry.create({
        data: {
          business_id: businessId,
          product_id: product.id,
          quantity: p.stock,
          entry_type: 'adjustment',
          notes: 'Stock inicial — seed demo',
          created_by: userId,
        },
      })
    })
  }
  console.log(`  + ${BOUTIQUE_PRODUCTS.length} productos con imagen real creados`)
}

async function main() {
  console.log('Seed cuentas demo — inicio')
  for (const spec of ACCOUNTS) {
    console.log(`\n${spec.businessName} (${spec.email})`)
    const { businessId, userId } = await ensureBusiness(spec)
    if (spec.slug === 'boutique-demo') {
      await ensureBoutiqueCatalog(businessId, userId)
    }
  }
  console.log('\n✅ Seed cuentas demo — listo')
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
