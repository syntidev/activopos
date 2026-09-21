// ponytail: uso único (sprint Kits 200K 2027) — crea los 4 componentes base +
// 2 kits combo y los liga a la Collection 200k existente. Sin variantes de
// talla: ProductComponent no soporta variant_id hoy (ver hallazgo del sprint),
// así que el stock por talla queda fuera hasta que se extienda ese mecanismo.
// Precios y nombres son SUPUESTOS de trabajo, ajustables por Carlos.
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
const COLLECTION_SLUG = '200k' // "200k-2027" del sprint no existe -- esta es la real (Línea 200K)
const STOCK_INICIAL = 1000

async function main() {
  const business = await prisma.business.findFirstOrThrow({
    where: { catalog_slug: BUSINESS_SLUG },
    select: { id: true },
  })
  const collection = await prisma.collection.findFirstOrThrow({
    where: { business_id: business.id, slug: COLLECTION_SLUG },
    select: { id: true, name: true },
  })
  const admin = await prisma.user.findFirstOrThrow({
    where: { business_id: business.id, role: 'admin' },
    select: { id: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    async function createSimple(name, priceUsd) {
      const product = await tx.product.create({
        data: {
          business_id: business.id,
          name,
          sale_mode: 'unit',
          product_type: 'simple',
          unit_type: 'unit',
          price_per_unit_usd: priceUsd,
          show_in_catalog: false,
          catalog_visibility: 'hidden',
          available_in_pos: true,
          active: true,
        },
        select: { id: true, name: true },
      })
      await tx.inventoryEntry.create({
        data: {
          business_id: business.id,
          product_id: product.id,
          quantity: STOCK_INICIAL,
          waste: 0,
          entry_type: 'adjustment',
          notes: 'Stock inicial de prueba — sprint Kits 200K 2027',
          created_by: admin.id,
        },
      })
      return product
    }

    const maillot = await createSimple('Maillot 200K 2027', 3)
    const franela = await createSimple('Franela 200K 2027', 3)
    const medalla = await createSimple('Medalla 200K 2027', 2)
    const media   = await createSimple('Media 200K 2027', 2)

    async function createKit(name, priceUsd, componentIds) {
      const kit = await tx.product.create({
        data: {
          business_id: business.id,
          name,
          sale_mode: 'unit',
          product_type: 'combo',
          unit_type: 'unit',
          price_per_unit_usd: priceUsd,
          show_in_catalog: true,
          catalog_visibility: 'visible',
          available_in_pos: true,
          active: true,
        },
        select: { id: true, name: true },
      })
      await tx.productComponent.createMany({
        data: componentIds.map((component_id) => ({
          business_id: business.id,
          parent_id: kit.id,
          component_id,
          quantity: 1,
          unit_label: 'und',
        })),
      })
      await tx.productCollection.create({
        data: { product_id: kit.id, collection_id: collection.id },
      })
      return kit
    }

    const kitCompleto = await createKit('Kit 200K Completo', 8, [
      maillot.id, franela.id, medalla.id, media.id,
    ])
    const kitBasico = await createKit('Kit 200K Básico', 6, [
      maillot.id, franela.id, medalla.id,
    ])

    return { maillot, franela, medalla, media, kitCompleto, kitBasico }
  })

  console.log(JSON.stringify({ business_id: business.id, collection: collection.name, ...result }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
