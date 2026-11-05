/**
 * Negocios DEMO por plantilla — datos 100 % ficticios (nada de OnBike ni de Café con Bike).
 *   · Demo Tienda   (generic)  /c/demo-tienda   — boutique ficticia
 *   · Demo Premium  (premium)  /c/demo-premium  — tienda de ciclismo ficticia, con precio Divisa
 *   · Demo Carta    (carta)    /c/demo-carta    — restaurante ficticio "Arepera El Budare", con tamaños
 *
 * IDEMPOTENTE: el negocio se busca por slug y cada producto por (negocio, nombre); correrlo dos veces no duplica nada y
 * NO pisa lo que el superadmin cambie después (plantilla, settings, precios). Los negocios nacen por la ÚNICA vía de
 * creación (src/lib/tenant-create.ts). Las contraseñas se imprimen solo cuando el negocio se crea en esa corrida.
 *
 * Run:  npm run seed:demos        (DEMO_ADMIN_PASSWORD=... para fijar la contraseña; si no, se genera una por negocio)
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { prisma } from '../src/lib/prisma'
import { buildTenantSettings, createTenant, type TenantSettingsInput } from '../src/lib/tenant-create'
import { publicPath } from '../src/lib/plantillas'

interface SizeSpec { label: string; extra: number; stock: number }
interface ProductSpec {
  name:        string
  category:    string
  price:       number
  /** Precio Divisa (menor que el de lista). */
  divisa?:     number
  cost:        number
  stock?:      number
  image?:      string
  description?: string
  sizes?:      SizeSpec[]
}
interface DemoSpec {
  slug:     string
  name:     string
  title:    string
  desc:     string
  rubro:    string
  email:    string
  settings: TenantSettingsInput
  products: ProductSpec[]
}

// Fotos de Unsplash verificadas con curl (HTTP 200) antes de escribir este script.
const U = (id: string): string => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`

const DEMOS: DemoSpec[] = [
  {
    slug: 'demo-tienda', name: 'Demo Tienda', title: 'Demo Tienda', rubro: 'boutique', email: 'demo-tienda@demo.activopos.com',
    desc: 'Tienda de ropa y accesorios ficticia para probar la plantilla genérica.',
    settings: { template: 'generic', collect_in: 'both', cashea: false, divisa: false },
    products: [
      { name: 'Camisa Oxford Blanca', category: 'Ropa',       price: 25, cost: 12, stock: 18, image: U('photo-1596755094514-f87e34085b2c') },
      { name: 'Pantalón Chino Beige', category: 'Ropa',       price: 35, cost: 18, stock: 14, image: U('photo-1591047139829-d91aecb6caea') },
      { name: 'Vestido Floral',       category: 'Ropa',       price: 45, cost: 22, stock: 9,  image: U('photo-1595777457583-95e059d581b8') },
      { name: 'Zapatos Casuales',     category: 'Calzado',    price: 55, cost: 30, stock: 12, image: U('photo-1560769629-975ec94e6a86') },
      { name: 'Bolso de Cuero',       category: 'Accesorios', price: 65, cost: 35, stock: 7,  image: U('photo-1548036328-c9fa89d128fa') },
      { name: 'Gorra Snapback',       category: 'Accesorios', price: 15, cost: 7,  stock: 20, image: U('photo-1521572163474-6864f9cf17ab') },
    ],
  },
  {
    slug: 'demo-premium', name: 'Demo Premium', title: 'Demo Premium — Ciclismo', rubro: 'ciclismo', email: 'demo-premium@demo.activopos.com',
    desc: 'Tienda de ciclismo ficticia para probar la plantilla premium (precio Divisa y Cashea).',
    settings: { template: 'premium', collect_in: 'both', cashea: true, divisa: true },
    products: [
      { name: 'Bicicleta Urbana Lumen',   category: 'Bicicletas', price: 420,  divisa: 380,  cost: 300, stock: 5, image: U('photo-1485965120184-e220f721d03e'), description: 'Fixie urbana de acero, ligera y lista para la ciudad.' },
      { name: 'Bicicleta de Ruta Alba',   category: 'Bicicletas', price: 1200, divisa: 1080, cost: 900, stock: 3, image: U('photo-1576435728678-68d0fbf94e91'), description: 'Ruta con cuadro de aluminio y frenos de disco.' },
      { name: 'Jersey Pro Serie 1',       category: 'Ropa',       price: 70,   divisa: 62,   cost: 35,  stock: 15, image: U('photo-1541625602330-2277a4c46182') },
      { name: 'Culotte Gel Pro',          category: 'Ropa',       price: 85,   divisa: 76,   cost: 42,  stock: 12, image: U('photo-1517649763962-0c623066013b') },
      { name: 'Casco Ruta Aero',          category: 'Protección', price: 120,  divisa: 105,  cost: 60,  stock: 10, image: U('photo-1541625602330-2277a4c46182') },
      { name: 'Luz Frontal LED 800',      category: 'Accesorios', price: 35,   divisa: 30,   cost: 15,  stock: 25, image: U('photo-1485965120184-e220f721d03e') },
    ],
  },
  {
    slug: 'demo-carta', name: 'Demo Carta', title: 'Arepera El Budare', rubro: 'restaurante', email: 'demo-carta@demo.activopos.com',
    desc: 'Arepera ficticia para probar la plantilla Carta: platos con foto y tamaños.',
    settings: { template: 'carta', carta_preset: 'brasa', carta_style: 'casual', collect_in: 'both', cashea: false, divisa: true },
    products: [
      { name: 'Hamburguesa El Budare',   category: 'Hamburguesas', price: 6,  cost: 2.5, image: U('photo-1568901346375-23c9450c58cd'), description: 'Carne smash, queso, lechuga y salsa de la casa.',
        sizes: [{ label: 'Sencilla', extra: 0, stock: 40 }, { label: 'Doble', extra: 3, stock: 40 }] },
      { name: 'Hamburguesa Criolla',     category: 'Hamburguesas', price: 10, cost: 4,   image: U('photo-1572802419224-296b0aeee0d9'), description: 'Doble carne, doble queso y cebolla caramelizada.',
        sizes: [{ label: 'Doble', extra: 0, stock: 40 }, { label: 'Triple', extra: 3, stock: 40 }] },
      { name: 'Costillas BBQ',           category: 'Parrilla',     price: 12, cost: 5,   image: U('photo-1544025162-d76694265947'), description: 'Costillas de cerdo glaseadas con salsa BBQ.',
        sizes: [{ label: 'Media', extra: 0, stock: 25 }, { label: 'Completa', extra: 8, stock: 25 }] },
      { name: 'Parrillada Mixta',        category: 'Parrilla',     price: 14, cost: 6,   image: U('photo-1504674900247-0877df9cc836'), description: 'Carnes a la parrilla con ensalada y salsas.',
        sizes: [{ label: 'Para 1', extra: 0, stock: 20 }, { label: 'Para 2', extra: 10, stock: 20 }] },
      { name: 'Bowl Fresco de Pollo',    category: 'Ensaladas',    price: 7,  cost: 2.8, image: U('photo-1546069901-ba9599a7e63c'), description: 'Pollo a la plancha, vegetales frescos y huevo.',
        sizes: [{ label: 'Regular', extra: 0, stock: 30 }, { label: 'Grande', extra: 2, stock: 30 }] },
      { name: 'Pizza Criolla',           category: 'Pizzas',       price: 8,  cost: 3,   image: U('photo-1565299624946-b28f40a0ae38'), description: 'Pizza con pollo, cebolla morada y cilantro.',
        sizes: [{ label: 'Personal', extra: 0, stock: 30 }, { label: 'Familiar', extra: 7, stock: 30 }] },
      { name: 'Jugo de Parchita',        category: 'Bebidas',      price: 3,  cost: 1,   stock: 60 },
      { name: 'Papelón con Limón',       category: 'Bebidas',      price: 2.5, cost: 0.8, stock: 60 },
    ],
  },
]

async function ensureProducts(businessId: number, userId: number, specs: ProductSpec[]): Promise<number> {
  const categoryIds = new Map<string, number>()
  let created = 0
  for (const p of specs) {
    let categoryId = categoryIds.get(p.category)
    if (categoryId === undefined) {
      const found = await prisma.category.findFirst({ where: { business_id: businessId, name: p.category } })
      categoryId = found?.id ?? (await prisma.category.create({ data: { business_id: businessId, name: p.category } })).id
      categoryIds.set(p.category, categoryId)
    }
    if (await prisma.product.findFirst({ where: { business_id: businessId, name: p.name }, select: { id: true } })) continue

    await prisma.$transaction(async tx => {
      const product = await tx.product.create({
        data: {
          business_id:        businessId,
          category_id:        categoryId,
          name:               p.name,
          description:        p.description ?? null,
          price_per_unit_usd: p.price,
          ...(p.divisa !== undefined ? { wholesale_price_usd: p.divisa } : {}),
          cost_per_unit_usd:  p.cost,
          images:             p.image ? JSON.stringify([p.image]) : null,
          show_in_catalog:    true,
          catalog_visibility: 'visible',
          available_in_pos:   true,
          is_available:       true,
          has_variants:       (p.sizes?.length ?? 0) > 0,
        },
      })
      if (p.sizes?.length) {
        await tx.productVariant.createMany({
          data: p.sizes.map((s, i) => ({
            product_id: product.id, tipo: 'tamano', valor: s.label,
            precio_extra: s.extra, stock: s.stock, sort_order: i, is_active: true,
          })),
        })
      }
      const entries = p.sizes?.length
        ? p.sizes.map(s => ({ qty: s.stock, note: `Stock inicial — ${s.label}` }))
        : [{ qty: p.stock ?? 0, note: 'Stock inicial — seed demos' }]
      await tx.inventoryEntry.createMany({
        data: entries.filter(e => e.qty > 0).map(e => ({
          business_id: businessId, product_id: product.id, quantity: e.qty, entry_type: 'adjustment', notes: e.note, created_by: userId,
        })),
      })
    })
    created++
  }
  return created
}

async function main(): Promise<void> {
  for (const demo of DEMOS) {
    let business = await prisma.business.findFirst({ where: { catalog_slug: demo.slug }, select: { id: true } })
    let adminId: number | null = null

    if (!business) {
      const password = process.env.DEMO_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url')
      const res = await createTenant({
        ownerName: `Admin ${demo.name}`, businessName: demo.name, slug: demo.slug, email: demo.email, password, businessType: demo.rubro,
        description: demo.desc,
        options: { template: demo.settings.template, settings: buildTenantSettings(demo.settings), catalogActive: true, catalogPlan: 'negocio_activo', withSampleProduct: false },
      })
      if (!res.ok) throw new Error(`${demo.slug}: ${res.error}`)
      business = { id: res.business.id }
      adminId = res.user.id
      await prisma.business.update({ where: { id: business.id }, data: { catalog_title: demo.title } })
      // Medios Divisa = los dos de dólares que ya trae el seed del negocio (solo al crear: no pisa cambios posteriores).
      if (demo.settings.divisa) {
        const usd = await prisma.paymentMethod.findMany({ where: { business_id: business.id, name: { in: ['Efectivo USD', 'Zelle'] } }, select: { id: true } })
        const cur = await prisma.business.findUnique({ where: { id: business.id }, select: { settings: true } })
        await prisma.business.update({ where: { id: business.id }, data: { settings: { ...((cur?.settings ?? {}) as Record<string, string>), catalog_divisa_methods: usd.map(m => m.id) } } })
      }
      console.log(`+ ${demo.slug} creado  → ${publicPath(demo.slug)}  admin: ${demo.email}  contraseña: ${password}`)
    } else {
      console.log(`✓ ${demo.slug} ya existía (id ${business.id})`)
    }

    if (adminId === null) {
      const admin = await prisma.user.findFirst({ where: { business_id: business.id, role: 'admin' }, select: { id: true } })
      if (!admin) throw new Error(`${demo.slug}: no tiene usuario admin para registrar el stock`)
      adminId = admin.id
    }
    const n = await ensureProducts(business.id, adminId, demo.products)
    console.log(`  ${n === 0 ? '✓ productos al día' : `+ ${n} producto(s) creados`}`)
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
