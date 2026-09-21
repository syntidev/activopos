// ponytail: borra SOLO lo que seed-demo-products.mjs marcó con
// notes='DEMO_TEMPORAL' (productos + sus InventoryEntry). Las categorías
// (Bicicletas/Calzado/Óptica/Indumentaria/Accesorios/Repuestos) NO se
// borran -- son estructura fija, quedan vacías y listas para el inventario
// real de OnBike. Corré este script cuando Carlos termine de evaluar el
// diseño con datos poblados.
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

async function main() {
  const business = await prisma.business.findFirstOrThrow({
    where: { catalog_slug: BUSINESS_SLUG },
    select: { id: true },
  })

  const products = await prisma.product.findMany({
    where: { business_id: business.id, notes: DEMO_MARKER },
    select: { id: true, name: true },
  })
  const productIds = products.map(p => p.id)

  const deletedEntries = await prisma.inventoryEntry.deleteMany({
    where: { business_id: business.id, product_id: { in: productIds } },
  })
  const deletedProducts = await prisma.product.deleteMany({
    where: { business_id: business.id, notes: DEMO_MARKER },
  })

  console.log(JSON.stringify({
    business_id: business.id,
    deleted_products: deletedProducts.count,
    deleted_inventory_entries: deletedEntries.count,
    product_names: products.map(p => p.name),
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
