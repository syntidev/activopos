// Carga el inventario REAL de OnBike (74 productos, precios reales de Carlos)
// -- NO son datos de demo, sin notes='DEMO_TEMPORAL'. Sin variantes (ninguno
// lleva talla), sin InventoryEntry (stock inicial 0 -- Carlos confirma
// cantidades reales después; netQty ausente ya se computa como "Sin stock"
// dinámicamente, ver computeAvailability en lib/catalog.ts).
//
// Precios: 3 por producto, solo 2 públicos.
//   Divisa -> precio_divisa (ya existía de un sprint anterior)
//   BCV    -> price_per_unit_usd (campo de precio normal ya existente)
//   Cashea -> precio_cashea (uso interno, nunca se lee en el catálogo público)
//
// Categorías: se crean las que no existen. ACCESORIOS y LENTE reusan
// categorías reales ya existentes (Accesorios exacto; Óptica -- match
// semántico real para lentes/gafas, no un genérico forzado). EQUINO y PESCA
// son líneas de producto Garmin reales fuera de ciclismo, se crean nuevas.
//
// Idempotente: si un producto con el mismo nombre ya existe en el negocio,
// se salta (no duplica) y lo reporta.
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

const CATEGORY_MAP = {
  'CASCO':           'Casco',
  'RELOJ':           'Reloj',
  'CICLOCOMPUTADOR': 'Ciclocomputador',
  'CORREAS RELOJ':   'Correas Reloj',
  'BANDA DE PECHO':  'Banda de Pecho',
  'LENTE':           'Óptica',       // reuso -- match semántico real (lentes/gafas)
  'EQUINO':          'Equino',
  'PESCA':           'Pesca',
  'LUCES':           'Luces',
  'PEDALES':         'Pedales',
  'TRABAS':          'Trabas',
  'ACCESORIOS':      'Accesorios',   // reuso -- nombre exacto ya existe
  'DISCOS':          'Discos',
  'TERMOS':          'Termos',
  'GELES':           'Geles',
  'BOLSOS':          'Bolsos',
  'FORROS':          'Forros',
  'TRIPAS':          'Tripas',
  'INFLADOR':        'Infladores',
  'AUDIFONOS':       'Audífonos',
}

// [categoriaRaw, marca, descripcion, divisa, bcv, cashea]
const PRODUCTS = [
  ['CASCO', 'Kask', 'Protone Icon', 300.00, 345.00, 373.00],
  ['CASCO', 'Kask', 'Elemento', 400.00, 460.00, 497.00],
  ['CASCO', 'Kask', 'Nirvana', 400.00, 460.00, 497.00],
  ['CASCO', 'Rudy Project', 'Sinergy', 90.00, 104.00, 112.00],
  ['RELOJ', 'Garmin', 'Forerunner 165', 275.00, 316.00, 341.00],
  ['RELOJ', 'Garmin', 'Forerunner 165 Music', 330.00, 380.00, 410.00],
  ['RELOJ', 'Garmin', 'Forerunner 570 47mm', 605.00, 696.00, 752.00],
  ['RELOJ', 'Garmin', 'Forerunner 570 42mm', 605.00, 696.00, 752.00],
  ['RELOJ', 'Garmin', 'Forerunner 970', 825.00, 949.00, 1025.00],
  ['RELOJ', 'Garmin', 'Vivoactive 6', 330.00, 380.00, 410.00],
  ['CICLOCOMPUTADOR', 'Garmin', 'Edge 550', 550.00, 633.00, 684.00],
  ['CICLOCOMPUTADOR', 'Garmin', 'Edge 850', 660.00, 759.00, 820.00],
  ['CICLOCOMPUTADOR', 'Garmin', 'Edge 1050', 770.00, 886.00, 957.00],
  ['RELOJ', 'Garmin', 'Venu X1', 770.00, 886.00, 957.00],
  ['RELOJ', 'Garmin', 'Instinct 3 45mm', 385.00, 443.00, 478.00],
  ['RELOJ', 'Garmin', 'Instinct Crossover Standard Edition', 440.00, 506.00, 546.00],
  ['RELOJ', 'Garmin', 'Instinct Crossover Amoled', 715.00, 822.00, 888.00],
  ['RELOJ', 'Garmin', 'Instinct Crossover Amoled Tactical Edition', 825.00, 949.00, 1025.00],
  ['BANDA DE PECHO', 'Garmin', 'HRM 200', 90.00, 104.00, 112.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Release Silicone 20mm', 45.00, 52.00, 56.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Release Fabric 20mm', 55.00, 63.00, 68.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Fit Silicone 20mm', 55.00, 63.00, 68.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Fit Fabric 20mm', 66.00, 76.00, 82.00],
  ['CORREAS RELOJ', 'Garmin', 'Ultra Fit Fabric 20mm', 45.00, 52.00, 56.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Release Silicone 22mm', 45.00, 52.00, 56.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Release Fabric 22mm', 55.00, 63.00, 68.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Fit Silicone 22mm', 55.00, 63.00, 68.00],
  ['CORREAS RELOJ', 'Garmin', 'Ultra Fit Fabric 22mm', 45.00, 52.00, 56.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Fit Silicone 26mm', 55.00, 63.00, 68.00],
  ['CORREAS RELOJ', 'Garmin', 'Quick Fit Fabric 26mm', 66.00, 76.00, 82.00],
  ['CORREAS RELOJ', 'Garmin', 'Ultra Fit Fabric 26mm', 45.00, 52.00, 56.00],
  ['CASCO', 'Rudy Project', 'Strym Z', 100.00, 115.00, 124.00],
  ['LENTE', 'Oakley | Meta', 'Vanguard', 650.00, 748.00, 808.00],
  ['EQUINO', 'Garmin', 'Blaze', 660.00, 759.00, 820.00],
  ['PESCA', 'Garmin', 'Striker 4', 185.00, 213.00, 230.00],
  ['PESCA', 'Garmin', 'Striker Plus 4 + Transducer', 220.00, 253.00, 273.00],
  ['PESCA', 'Garmin', 'EchoMap UHD 72cv + Transducer', 800.00, 920.00, 994.00],
  ['LUCES', 'Garmin', 'Varia RCT715', 440.00, 506.00, 546.00],
  ['PEDALES', 'Garmin', 'Rally RK210', 990.00, 1139.00, 1230.00],
  ['TRABAS', 'Look', 'Kéo Grip', 30.00, 35.00, 38.00],
  ['PEDALES', 'Look', 'Kéo Classic 3', 80.00, 92.00, 99.00],
  ['PEDALES', 'Look', 'Kéo Sprint', 90.00, 104.00, 112.00],
  ['PEDALES', 'Look', 'Kéo Blade Carbon Ceramic 16', 370.00, 426.00, 460.00],
  ['PEDALES', 'Look', 'Kéo 2 Max Carbon', 130.00, 150.00, 162.00],
  ['LUCES', 'Zefal', 'Vision R20', 25.00, 29.00, 31.00],
  ['LUCES', 'Nite Rider', 'Vmax+ 180 Alto', 45.00, 52.00, 56.00],
  ['LUCES', 'Nite Rider', 'Sentry 260 Aero', 50.00, 58.00, 63.00],
  ['LUCES', 'Nite Rider', 'Lumina Max 2500', 220.00, 253.00, 273.00],
  ['LUCES', 'Nite Rider', 'Lumina Boost 1250', 100.00, 115.00, 124.00],
  ['TRABAS', 'Promend', 'MTB PDZ-M06', 28.00, 32.00, 35.00],
  ['TRABAS', 'Promend', 'Ruta Look PDZ-R09', 28.00, 32.00, 35.00],
  ['LUCES', 'Look', 'Keo Blade Vision Upgrade Kit', 95.00, 109.00, 118.00],
  ['PEDALES', 'Look', 'Keo Blade Ceramic Vision', 460.00, 529.00, 571.00],
  ['LUCES', 'Zefal', 'Supervision F1500', 130.00, 150.00, 162.00],
  ['ACCESORIOS', 'Zefal', 'Z Adventure T1', 42.00, 48.00, 52.00],
  ['DISCOS', 'Galfer Bike', 'Disc Wave Brake Rotor DB102WCL', 58.00, 67.00, 72.00],
  ['DISCOS', 'Galfer Bike', 'Disc Wave Brake Rotor DB101WCL', 60.00, 69.00, 75.00],
  ['TERMOS', 'Camelback', 'Podium Chill 21oz', 15.00, 17.00, 18.00],
  ['TERMOS', 'Camelback', 'Podium Chill 24oz', 20.00, 23.00, 25.00],
  ['GELES', 'Maurten', 'Gel 100', 6.00, 7.00, 8.00],
  ['GELES', 'Carbs Fuel', 'Original 50g', 4.00, 5.00, 5.00],
  ['GELES', 'SIS', 'Go Isotonic Energy', 3.00, 3.00, 3.00],
  ['GELES', 'SIS', 'Go Energy + Caffeine', 4.00, 5.00, 5.00],
  ['BOLSOS', 'KOM', 'Bolso KOM Portalaptop', 100.00, 115.00, 124.00],
  ['FORROS', 'KOM', 'Cover Full Bicicleta', 100.00, 115.00, 124.00],
  ['FORROS', 'KOM', 'Cover Semi Abierto Bicicleta', 80.00, 92.00, 99.00],
  ['BOLSOS', 'KOM', 'Chaleco de Hidratación 1L', 50.00, 58.00, 63.00],
  ['TRIPAS', 'Vittoria', '700 x 20/28c 80mm FV Presta', 10.00, 12.00, 13.00],
  ['TRIPAS', 'Continental', 'MTB 26 x 1.75/x2.5 42mm FV Presta', 10.00, 12.00, 13.00],
  ['INFLADOR', 'Cyplus', 'AS2', 90.00, 104.00, 112.00],
  ['INFLADOR', 'Cyplus', 'AS2 Pro', 120.00, 138.00, 149.00],
  ['AUDIFONOS', 'Shokz', 'OpenRun Pro 2', 190.00, 219.00, 237.00],
  ['AUDIFONOS', 'Shokz', 'OpenRun Pro 2 Mini', 190.00, 219.00, 237.00],
  ['AUDIFONOS', 'Shokz', 'OpenDots Air', 145.00, 167.00, 180.00],
]

async function main() {
  const business = await prisma.business.findFirstOrThrow({
    where: { catalog_slug: BUSINESS_SLUG },
    select: { id: true },
  })

  const categoryIds = {}
  const realCategoryNames = [...new Set(Object.values(CATEGORY_MAP))]
  for (const [i, name] of realCategoryNames.entries()) {
    const cat = await prisma.category.upsert({
      where:  { name_business: { business_id: business.id, name } },
      update: {},
      create: { business_id: business.id, name, sort_order: 100 + i },
      select: { id: true },
    })
    categoryIds[name] = cat.id
  }

  const created = []
  const skipped = []
  for (const [catRaw, marca, descripcion, divisa, bcv, cashea] of PRODUCTS) {
    const name = `${marca} ${descripcion}`
    const categoryName = CATEGORY_MAP[catRaw]
    if (!categoryName) throw new Error(`Categoría sin mapear: ${catRaw}`)

    const existing = await prisma.product.findFirst({
      where: { business_id: business.id, name },
      select: { id: true },
    })
    if (existing) { skipped.push(name); continue }

    const product = await prisma.product.create({
      data: {
        business_id:        business.id,
        category_id:        categoryIds[categoryName],
        name,
        sale_mode:           'unit',
        product_type:        'simple',
        unit_type:            'unit',
        price_per_unit_usd:   bcv,
        precio_divisa:        divisa,
        precio_cashea:        cashea,
        show_in_catalog:      true,
        catalog_visibility:   'visible',
        available_in_pos:     true,
        active:               true,
      },
      select: { id: true, name: true },
    })
    created.push(product)
  }

  console.log(JSON.stringify({
    business_id: business.id,
    categories: categoryIds,
    created_count: created.length,
    skipped_count: skipped.length,
    skipped_names: skipped,
    created,
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
