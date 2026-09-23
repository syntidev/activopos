// Crea (si faltan) los 3 productos reales de franela suelta del showroom
// /kit-200k -- Damas/Caballeros/Niños -- con categoría, variantes de talla,
// precio y asociación a la Collection "Línea 200K". Idempotente: busca por
// nombre exacto antes de crear, seguro de correr más de una vez.
//
// Uso: node --env-file=.env.production scripts/seed-kit200k-franelas.mjs
// (o .env en local). NO imprime credenciales, solo usa las variables DB_*
// ya presentes en el entorno del proceso.
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

const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
const TALLAS_NINOS = ['4', '6', '8', '10', '12', '14']

async function main() {
  const business = await prisma.business.findFirst({ where: { catalog_slug: 'onbike' }, select: { id: true } })
  if (!business) throw new Error('Business onbike no encontrado')

  const collection = await prisma.collection.findFirst({
    where: { business_id: business.id, name: 'Línea 200K' },
    select: { id: true },
  })
  if (!collection) throw new Error('Collection "Línea 200K" no existe en esta DB -- no se asume, se crea a mano primero')

  const category = await prisma.category.upsert({
    where: { name_business: { business_id: business.id, name: 'Indumentaria' } },
    update: {},
    create: { business_id: business.id, name: 'Indumentaria' },
  })

  const franelasSpec = [
    { name: 'Franela 200K 2027 Damas', price: 5, tallas: TALLAS_ROPA },
    { name: 'Franela 200K 2027 Caballeros', price: 5, tallas: TALLAS_ROPA },
    { name: 'Franela 200K 2027 Niños', price: 4, tallas: TALLAS_NINOS },
  ]

  for (const spec of franelasSpec) {
    let p = await prisma.product.findFirst({ where: { business_id: business.id, name: spec.name } })
    if (!p) {
      p = await prisma.product.create({
        data: {
          business_id: business.id,
          category_id: category.id,
          name: spec.name,
          product_type: 'simple',
          price_per_unit_usd: spec.price,
          has_variants: true,
        },
      })
      await prisma.productVariant.createMany({
        data: spec.tallas.map(t => ({ product_id: p.id, tipo: 'talla', valor: t, stock: 10 })),
      })
      console.log('creado:', spec.name, p.id)
    } else {
      console.log('ya existe, sin tocar:', spec.name, p.id)
    }
    await prisma.productCollection.upsert({
      where: { product_id_collection_id: { product_id: p.id, collection_id: collection.id } },
      update: {},
      create: { product_id: p.id, collection_id: collection.id },
    })
  }

  const check = await prisma.product.findMany({
    where: { business_id: business.id, name: { in: franelasSpec.map(f => f.name) } },
    select: { id: true, name: true },
  })
  console.log('VERIFICACIÓN:', check)
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
