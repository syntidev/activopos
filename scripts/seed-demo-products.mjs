// ponytail: uso único (evaluación visual de diseño, catálogo OnBike) — crea
// 6 categorías fijas (estructura real que OnBike va a usar igual después) +
// ~20 productos de ejemplo repartidos entre las 7 marcas ya cargadas en
// Brand. Los productos SÍ son temporales: quedan marcados con
// notes='DEMO_TEMPORAL' para que scripts/reset-demo-products.mjs los borre
// sin tocar las categorías. Precios y stock son SUPUESTOS de trabajo,
// ajustables por Carlos. Imágenes: URLs directas de Unsplash (verificadas
// con curl antes de sembrar), no se descargan al storage del tenant.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'activopos',
  allowPublicKeyRetrieval: true,
})
const prisma = new PrismaClient({ adapter })

const BUSINESS_SLUG = 'onbike'
const DEMO_MARKER = 'DEMO_TEMPORAL'
const img = id => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`

const CATEGORIES = ['Bicicletas', 'Calzado', 'Óptica', 'Indumentaria', 'Accesorios', 'Repuestos']

// [nombre, categoria, precioUsd, stock, imageId, featured?]
const PRODUCTS = [
  ['Bicicleta Ruta Carbono Pro',        'Bicicletas',   1800, 4,  '1485965120184-e220f721d03e', true],
  ['Bicicleta MTB Aluminio 29"',        'Bicicletas',   850,  6,  '1576435728678-68d0fbf94e91'],
  ['Bicicleta Urbana Aro 26',           'Bicicletas',   420,  8,  '1502744688674-c619d1586c9e'],

  ['On Cloudboom Echo 3',               'Calzado',      220,  15, '1542291026-7eec264c27ff'],
  ['Safetti Zapatilla Ciclismo Carbon', 'Calzado',      180,  12, '1595950653106-6c9ebd614d3a'],
  ['On Cloudmonster',                   'Calzado',      170,  18, '1542291026-7eec264c27ff'],

  ['Oakley Sutro Lens',                 'Óptica',       170,  20, '1572635196237-14b3f281503f', true],
  ['Rudy Project Cutline',              'Óptica',       150,  14, '1508296695146-257a814070b4'],
  ['KOO Open Cube',                     'Óptica',       190,  10, '1572635196237-14b3f281503f'],
  ['Oakley Radar EV Path',              'Óptica',       210,  9,  '1508296695146-257a814070b4'],

  ['Safetti Maillot Aero Pro',          'Indumentaria', 95,   25, '1517649763962-0c623066013b', true],
  ['KOM Bib Short Elite',               'Indumentaria', 110,  20, '1541625602330-2277a4c46182'],
  ['Safetti Chaqueta Térmica',          'Indumentaria', 130,  16, '1551028719-00167b16eac5'],

  ['Garmin Edge 840',                   'Accesorios',   400,  7,  '1523275335684-37898b6baf30', true],
  ['Garmin Forerunner 265',             'Accesorios',   350,  8,  '1508685096489-7aacd43bd3b1'],
  ['KOM Guantes Ciclismo',              'Accesorios',   35,   30, '1541625602330-2277a4c46182'],
  ['Garmin Varia RTL515',               'Accesorios',   180,  11, '1523275335684-37898b6baf30'],

  ['Cadena Shimano 11v',                'Repuestos',    45,   22, '1571188654248-7a89213915f7'],
  ['Pastillas de Freno Disco',          'Repuestos',    18,   40, '1568772585407-9361f9bf3a87'],
  ['Cámara Aro 700c',                   'Repuestos',    8,    50, '1519415943484-9fa1873496d4'],
]

async function main() {
  const business = await prisma.business.findFirstOrThrow({
    where: { catalog_slug: BUSINESS_SLUG },
    select: { id: true },
  })
  const admin = await prisma.user.findFirstOrThrow({
    where: { business_id: business.id, role: 'admin' },
    select: { id: true },
  })

  // Categorías: permanentes, sin marcador demo. Idempotente por si el
  // script corre más de una vez (unique [business_id, name]).
  const categoryIds = {}
  for (const [i, name] of CATEGORIES.entries()) {
    const cat = await prisma.category.upsert({
      where: { name_business: { business_id: business.id, name } },
      update: {},
      create: { business_id: business.id, name, sort_order: i },
      select: { id: true },
    })
    categoryIds[name] = cat.id
  }

  const created = []
  for (const [name, catName, priceUsd, stock, imageId, featured] of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        business_id:         business.id,
        category_id:         categoryIds[catName],
        name,
        sale_mode:            'unit',
        product_type:         'simple',
        unit_type:            'unit',
        price_per_unit_usd:   priceUsd,
        images:               JSON.stringify([img(imageId)]),
        show_in_catalog:      true,
        catalog_visibility:   'visible',
        available_in_pos:     true,
        is_featured:          !!featured,
        active:               true,
        notes:                DEMO_MARKER,
      },
      select: { id: true, name: true },
    })
    await prisma.inventoryEntry.create({
      data: {
        business_id: business.id,
        product_id:  product.id,
        quantity:    stock,
        waste:       0,
        entry_type:  'adjustment',
        notes:       DEMO_MARKER,
        created_by:  admin.id,
      },
    })
    created.push(product)
  }

  console.log(JSON.stringify({ business_id: business.id, categories: categoryIds, products: created }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
