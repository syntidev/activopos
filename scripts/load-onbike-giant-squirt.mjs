// Carga inventario REAL de OnBike: 91 bicicletas Giant (categoría
// "Bicicletas", ya existía) + 19 productos Squirt (categoría nueva
// "Lubricantes y Cuidado", todo junto sin subdividir). NO son demo, sin
// notes='DEMO_TEMPORAL'. product_type=simple, sin variantes.
//
// Precio: sin precio -- price_per_unit_usd queda null. La UI ya muestra
// "Consultar precio" automático cuando priceUsd<=0 (ver CatalogoGrid.tsx),
// no hace falta tocar catalog_visibility ni ningún otro campo.
//
// Stock: bicicletas usan el stock real (columna "TOTAL DE BIC" del listado
// de Carlos) vía InventoryEntry. Squirt entra en 0 -- sin InventoryEntry
// (netQty ausente ya se computa "Sin stock" dinámicamente, mismo criterio
// que el load anterior de precio_cashea).
//
// Un solo duplicado exacto de nombre en el listado de bicicletas
// ("BICICLETA GIANT TALON 4 METALLIC BLACK L MTB 1 SUSPENSION", stock 1 y
// 3 en líneas separadas) -- fusionado acá en una sola fila, stock sumado
// (1+3=4), confirmado con Carlos antes de cargar.
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

// [nombre, stock]
const BIKES = [
  ['BICICLETA GIANT Revolt Advanced 2 PANTHER M GRAVEL', 4],
  ['BICICLETA GIANT Revolt Advanced 2 GOLDEN HAZE S GRAVEL', 3],
  ['BICICLETA GIANT REVOLT I GRENADINE S GRAVEL', 7],
  ['BICICLETA GIANT REVOLT I DEEP LAKE M GRAVEL', 6],
  ['BICICLETA GIANT REVOLT E1 PHANTOM GREEN S GRAVEL', 1],
  ['BICICLETA GIANT REVOLT E1 PHANTOM GREEN ML GRAVEL', 1],
  ['BICICLETA GIANT REVOLT X ADPRO 1 CORDOVAN/COPPER COIN M GRAVEL', 1],
  ['BICICLETA GIANT Revolt Advanced 0 HELIOS ORANGE S GRAVEL', 1],
  ['BICICLETA GIANT REVOLT E+ PRO XR ROSEWOOD S GRAVEL E+', 3],
  ['BICICLETA GIANT REVOLT E+PRO XR ROSEWOOD M GRAVEL E+', 1],
  ['BICICLETA GIANT REVOLT E+PRO XR ROSEWOOD ML GRAVEL E+', 2],
  ['BICICLETA GIANT Fathom 29 2 COLD NIGHT S MTB 1 SUSPENSION', 5],
  ['BICICLETA GIANT Fathom 29 2 COLD NIGHT M MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT FATHOM 29 I AMBER GLOW S MTB 1 SUSPENSION', 2],
  ['BICICLETA GIANT FATHOM 29 I AMBER GLOW M MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT FATHOM 29 2 TERRACOTA S MTB 1 SUSPENSION', 3],
  ['BICICLETA GIANT FATHOM 29 2 BLUE ASHES M MTB 1 SUSPENSION', 3],
  ['BICICLETA GIANT FATHOM 29 2 BLUE ASHES L MTB 1 SUSPENSION', 2],
  ['BICICLETA GIANT TEMPT 0 METAL XS WOMEN MTB 1 SUSPENSION', 4],
  ['BICICLETA GANT TEMPT METAL MX29 MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT Talon 0 SILVER M MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT TALON 29 0 BLUE ASHES S MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 29 0 BLUE ASHES M MTB 1 SUSPENSION', 16],
  ['BICICLETA GIANT TALON 29 0 BLUE ASHES L MTB 1 SUSPENSION', 19],
  ['BICICLETA GIANT TALON 29 0 BLUE ASHES XL MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 29 4 METALLIC BLACK-XL MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 29 4 TREKKING GREEN-XL MTB 1 SUSPENSION', 1],
  // Duplicado exacto en el listado original (stock 1 + stock 3) -- fusionado, ver comentario de cabecera.
  ['BICICLETA GIANT TALON 4 METALLIC BLACK L MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT TALON 29 2 METALLIC BLACK XL MTB 1 SUSPENSION', 2],
  ['BICICLETA GIANT TALON 29 1 BLACK XL MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 29 1 HEMATITE L MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 29 1 HEMATITE XL MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT TALON 4 METAL-L MTB 1 SUSPENSION', 2],
  ['BICICLETA GIANT XTC SLR 29 1 AMBER GLOW S MTB 1 SUSPENSION', 3],
  ['BICICLETA GIANT XTC SLR 29 1 AMBER GLOW M MTB 1 SUSPENSION', 6],
  ['BICICLETA GIANT XTC SLR 29 I METAL BLACK S MTB 1 SUSPENSION', 5],
  ['BICICLETA GIANT XTC SLR 29 I METAL BLACK L MTB 1 SUSPENSION', 4],
  ['BICICLETA GIANT XTC SLR 29 1 METALLIC BLACK XL MTB 1 SUSPENSION', 5],
  ['BICICLETA GIANT XTC SLR 29 2 GRANADINE S MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT XTC SLR 29 2 BLACK M MTB 1 SUSPENSION', 2],
  ['BICICLETA GIANT XTC SLR 29 2 BLACK XL MEN MTB 1 SUSPENSION', 4],
  ['BICICLETA XTC ADV 29 1 S BLACK/BLACK DIAMOND MTB 1 SUSPENSION', 1],
  ['BICICLETA GIANT XTC ADVANCED 29 BLACK / BLACK DIAMOND MTB 1 SUSPENSION', 2],
  ['TALON E+1 29ER32KM BALSAM GREEN TALLA S MTB 1 SUSPENSION E+', 8],
  ['TALON E+1 29ER32KM BALSAM GREEN TALLA M MTB 1 SUSPENSION E+', 3],
  ['TALON E+1 29ER32KM BALSAM GREEN TALLA L MTB 1 SUSPENSION E+', 1],
  ['BICICLETA GIANT Talon E+ 1 29er SHALE GREEN S MTB 1 SUSPENSION E+', 5],
  ['BICICLETA GIANT Talon E+ 1 29er SHALE GREEN M MTB 1 SUSPENSION E+', 3],
  ['BICICLETA GIANT Talon E+ 1 29er SHALE GREEN L MTB 1 SUSPENSION E+', 4],
  ['TALON E+2 29ER32KM BLACK TALLA M MTB 1 SUSPENSION E+', 2],
  ['TALON E+2 29ER32KM BLACK TALLA L MTB 1 SUSPENSION E+', 1],
  ['TALON E+3 29ER32KM BLUE TALLA S MTB 1 SUSPENSION E+', 1],
  ['TALON E+3 29ER32KM BLUE TALLA M MTB 1 SUSPENSION E+', 3],
  ['TALON E+3 29ER32KM BLUE TALLA L MTB 1 SUSPENSION E+', 1],
  ['TEMPT E+ 1 32KM/H VINOTINTO TALLA XS MTB 1 SUSPENSION E+', 3],
  ['TEMPT E+ 1 32KM/H VINOTINTO TALLA S MTB 1 SUSPENSION E+', 3],
  ['TEMPT E+ 1 32KM/H VINOTINTO TALLA M MTB 1 SUSPENSION E+', 1],
  ['TEMPT E+ 2 32KM/H ECLIPSE TALLA XS MTB 1 SUSPENSION E+', 1],
  ['TEMPT E+ 2 32KM/H ECLIPSE TALLA S MTB 1 SUSPENSION E+', 3],
  ['TEMPT E+ 2 32KM/H ECLIPSE TALLA M MTB 1 SUSPENSION E+', 1],
  ['BICICLETA GIANT Tempt E+ 1 COPPER COIN XS MTB 1 SUSPENSION E+', 4],
  ['BICICLETA GIANT Tempt E+ 1 COPPER COIN S MTB 1 SUSPENSION E+', 4],
  ['BICICLETA GIANT Tempt E+ 1 29er COPPER COIN M MTB 1 SUSPENSION E+', 2],
  ['BICICLETA GIANT Explore E+ 2 DD SHALE GREEN M MTB 1 SUSPENSION E+', 1],
  ['BICICLETA STANCE M GUNMETAL BLACK MTB DOBLE SUSPENSION', 4],
  ['BICICLETA GIANT STANCE 29 1 ROSEWOOD-S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE 29 1 ROSEWOOD-M MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE 29 2 GUNMETAL-S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE 29 2 GUN METAL BLACK L MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE 29 2 GUN METAL BLACK XL MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE 29 2 KNIGHT SHIELD M MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT ANTHEM AP 29 1 CHAMELEON SATURN M MTB DOBLE SUSPENSION', 1],
  ['BICILETA GIANT ANTHEM AP 291 BLACK CHAMALEON SATURN L MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT ANTHEM AP 29 2 BLACK DIAMOND M MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT ANTHEM AP 292 BLACK DIAMOND L MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT ANTHEM AP 293 AMBER GLOW M MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT REIGN 29 SX STARRY NIGHT -S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT TRANCE 29 1 PHANTOM GREEN S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT TRANCE 29 1 PHANTOM GREEN M MTB DOBLE SUSPENSION', 3],
  ['BICICLETA GIANT TRANCE X 29 2 AMBER GLOW S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA TRANCE X 2 M HEMATITE MTB DOBLE SUSPENSION', 1],
  ['BICICLETA GIANT STANCE + 1PRO29ER PHANTOM GREEN S MTB DOBLE SUSPENSION', 1],
  ['BICICLETA TRANCE A E+ 1 L PHANTHOM GREEN MTB DOBLE SUSPENSION E+', 3],
  ['BICICLETA GIANT STANCEE+1PRO29ER32 PHANTOM GREEN M MTB DOBLE SUSPENSION E+', 3],
  ['BICICLETA GIANT STANCEE+1PRO29ER32 PHANTOM GREEN L MTB DOBLE SUSPENSION E+', 1],
  ['BICICLETA GIANT REIGN E+3 COBALT L MTB DOBLE SUSPENSION E+', 1],
  ['BICICLETA GIANT TRANCE X ADV E+1 EL GUNMETAL BLACK/BLACK S MTB DOBLE SUSPENSION E+', 1],
  ['BICICLETA GIANT TRANCE X ADV E+1 AIRGLOW M MTB DOBLE SUSPENSION E+', 2],
  ['BICICLETA GIANT TRANCE X ADV E+1 AIRGLOW L MTB DOBLE SUSPENSION E+', 1],
  ['BICICLETA GIANT REIGN E+2 SANGRIA S MTB DOBLE SUSPENSION E+', 1],
  ['BICICLETA GIANT REIGN E+2 SANGRIA L MTB DOBLE SUSPENSION E+', 1],
]

const SQUIRT = [
  'Lubricante de Cadena Squirt Lube Chain 15 ml',
  'Lubricante de Cadena Squirt Lube Chain 120 ml',
  'Lubricante de Cadena Squirt Lube 500 ml (para taller)',
  'Lubricante de Cadena Squirt e-Lube 15 ml',
  'Lubricante de Cadena Squirt e-Lube 120 ml',
  'Lubricante de cadena Squirt lube Low Temperature120ml',
  'Desengrasante Squirt Bike Cleaner 30 ml concentrado',
  'Desengrasante Squirt Bike Cleaner 1.000 ml concentrado',
  'Desengrasante Squirt Bike Cleaner 5.000 ml concentrado',
  'Desengrasante Squirt Bike Cleaner FOAM SPRAY 750ml+3*30ml "SUPER CONCENTRADO"',
  '"SUPER CONCENTRADO" Carton Box 10*30ml',
  '"SUPER CONCENTRADO" caja display 50*30ml',
  'Antipinchazos Squirt SEAL BEADBLOCK 150 ml',
  'Antipinchazos Squirt SEAL BEADBLOCK 1.000 ml',
  'Antipinchazos Squirt SEAL BEADBLOCK 5.000 ml',
  'Barrier Balm Crema Antiroce Squirt 150 ml',
  'Squirt Chamois Cream 100gr',
  'Squirt Chamois Cream 5gr',
  'Squirt EZ-LUBER',
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

  const bicicletasCat = await prisma.category.upsert({
    where:  { name_business: { business_id: business.id, name: 'Bicicletas' } },
    update: {},
    create: { business_id: business.id, name: 'Bicicletas', sort_order: 0 },
    select: { id: true },
  })
  const lubricantesCat = await prisma.category.upsert({
    where:  { name_business: { business_id: business.id, name: 'Lubricantes y Cuidado' } },
    update: {},
    create: { business_id: business.id, name: 'Lubricantes y Cuidado', sort_order: 200 },
    select: { id: true },
  })

  const created = []
  const skipped = []

  for (const [name, stock] of BIKES) {
    const existing = await prisma.product.findFirst({
      where: { business_id: business.id, name },
      select: { id: true },
    })
    if (existing) { skipped.push(name); continue }

    const product = await prisma.product.create({
      data: {
        business_id:       business.id,
        category_id:       bicicletasCat.id,
        name,
        sale_mode:          'unit',
        product_type:       'simple',
        unit_type:           'unit',
        price_per_unit_usd:  null,
        show_in_catalog:     true,
        catalog_visibility:  'visible',
        available_in_pos:    true,
        active:              true,
      },
      select: { id: true, name: true },
    })
    if (stock > 0) {
      await prisma.inventoryEntry.create({
        data: {
          business_id: business.id,
          product_id:  product.id,
          created_by:  admin.id,
          quantity:    stock,
          waste:       0,
          entry_type:  'adjustment',
        },
      })
    }
    created.push(product)
  }

  for (const name of SQUIRT) {
    const existing = await prisma.product.findFirst({
      where: { business_id: business.id, name },
      select: { id: true },
    })
    if (existing) { skipped.push(name); continue }

    // Stock 0 para todos -- sin InventoryEntry, netQty ausente ya se
    // computa "Sin stock" dinámicamente.
    const product = await prisma.product.create({
      data: {
        business_id:       business.id,
        category_id:       lubricantesCat.id,
        name,
        sale_mode:          'unit',
        product_type:       'simple',
        unit_type:           'unit',
        price_per_unit_usd:  null,
        show_in_catalog:     true,
        catalog_visibility:  'visible',
        available_in_pos:    true,
        active:              true,
      },
      select: { id: true, name: true },
    })
    created.push(product)
  }

  console.log(JSON.stringify({
    business_id: business.id,
    categories: { Bicicletas: bicicletasCat.id, 'Lubricantes y Cuidado': lubricantesCat.id },
    created_count: created.length,
    skipped_count: skipped.length,
    skipped_names: skipped,
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
