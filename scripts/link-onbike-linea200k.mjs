// Agrega 3 productos nuevos KOM a la colección "Línea 200K" (ya existe,
// no se crea) + asocia la Franela 200K 2027 original (id del showroom de
// /kit-200k, componente del Kit -- distinta de las Franela 200K 2027
// Damas/Caballeros/Niños que CLI-C ya asoció hoy con su propio script) a
// esa misma colección, donde hoy no vive.
//
// Precio $1.00 simbólico, stock 0 -- mismo criterio de hoy (referencia
// visual, sin venta real todavía).
//
// Idempotente: product.findFirst por nombre antes de crear, productCollection
// vía upsert (no falla si ya está asociado).
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
const COLLECTION_NAME = 'Línea 200K'
// El componente de kit original (showroom /kit-200k), NO las Damas/
// Caballeros/Niños (esas ya están en la colección, script aparte de hoy).
const EXISTING_FRANELA_NAME = 'Franela 200K 2027'

// [nombre, categoria]
const NEW_PRODUCTS = [
  ['Morral 200K', 'Bolsos'],
  ['Forro Cubre Polvo Bicicleta 200K', 'Forros'],
  ['Media 200K', 'Medias'],
]

async function main() {
  const business = await prisma.business.findFirstOrThrow({
    where: { catalog_slug: BUSINESS_SLUG },
    select: { id: true },
  })
  const collection = await prisma.collection.findFirstOrThrow({
    where: { business_id: business.id, name: COLLECTION_NAME },
    select: { id: true },
  })

  const categoryIds = {}
  for (const [i, catName] of [...new Set(NEW_PRODUCTS.map(p => p[1]))].entries()) {
    const cat = await prisma.category.upsert({
      where:  { name_business: { business_id: business.id, name: catName } },
      update: {},
      create: { business_id: business.id, name: catName, sort_order: 300 + i },
      select: { id: true },
    })
    categoryIds[catName] = cat.id
  }

  const created = []
  const skipped = []
  for (const [name, catName] of NEW_PRODUCTS) {
    let product = await prisma.product.findFirst({
      where: { business_id: business.id, name: `KOM ${name}` },
      select: { id: true },
    })
    if (product) {
      skipped.push(name)
    } else {
      product = await prisma.product.create({
        data: {
          business_id:        business.id,
          category_id:        categoryIds[catName],
          name:                `KOM ${name}`,
          sale_mode:           'unit',
          product_type:        'simple',
          unit_type:            'unit',
          price_per_unit_usd:   1.00,
          show_in_catalog:      true,
          catalog_visibility:   'visible',
          available_in_pos:     true,
          active:               true,
        },
        select: { id: true },
      })
      created.push(name)
    }
    await prisma.productCollection.upsert({
      where:  { product_id_collection_id: { product_id: product.id, collection_id: collection.id } },
      update: {},
      create: { product_id: product.id, collection_id: collection.id },
    })
  }

  // Franela 200K 2027 original (componente de kit, showroom /kit-200k) --
  // solo se asocia a la colección, no se crea ni se modifica el producto.
  const existingFranela = await prisma.product.findFirstOrThrow({
    where: { business_id: business.id, name: EXISTING_FRANELA_NAME },
    select: { id: true },
  })
  await prisma.productCollection.upsert({
    where:  { product_id_collection_id: { product_id: existingFranela.id, collection_id: collection.id } },
    update: {},
    create: { product_id: existingFranela.id, collection_id: collection.id },
  })

  const finalMembers = await prisma.productCollection.findMany({
    where:  { collection_id: collection.id },
    select: { product: { select: { id: true, name: true } } },
  })

  console.log(JSON.stringify({
    business_id: business.id,
    collection_id: collection.id,
    created_products: created,
    skipped_products: skipped,
    franela_id_linked: existingFranela.id,
    linea_200k_members: finalMembers.map(m => m.product),
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
