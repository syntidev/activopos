import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bcrypt from 'bcryptjs'

const adapter = new PrismaMariaDb({
  host:     process.env.DB_HOST     ?? '127.0.0.1',
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'activopos',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding ActivoPOS...')

  const catalogFields = {
    catalog_slug:   'demo',
    catalog_active: true,
    catalog_title:  'Tienda Demo',
    catalog_desc:   'Catálogo de prueba de ActivoPOS — explora nuestros productos',
  }

  const business = await prisma.business.upsert({
    where:  { id: 1 },
    update: catalogFields,
    create: {
      name:                 'Mi Negocio Demo',
      legal_name:           'Mi Negocio Demo C.A.',
      rif:                  'J-000000000',
      city:                 'Caracas',
      state:                'Distrito Capital',
      phone:                '04120000000',
      theme:                'dark',
      ticket_prefix:        'ACT',
      onboarding_completed: true,
      ...catalogFields,
    },
  })

  const paymentMethods = [
    { name: 'Efectivo Bs',   type: 'cash'     as const, sort_order: 1 },
    { name: 'Efectivo USD',  type: 'cash'     as const, sort_order: 2 },
    { name: 'Pago Móvil',   type: 'transfer' as const, sort_order: 3 },
    { name: 'Zelle',         type: 'zelle'    as const, sort_order: 4 },
    { name: 'Transferencia', type: 'transfer' as const, sort_order: 5 },
    { name: 'Binance USDT',  type: 'binance'  as const, sort_order: 6 },
  ]

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where:  { id: pm.sort_order },
      update: {},
      create: { business_id: business.id, ...pm },
    })
  }

  const hashedAdmin = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where:  { business_id_email: { business_id: business.id, email: 'admin@activopos.com' } },
    update: {},
    create: {
      business_id: business.id,
      name:        'Administrador',
      email:       'admin@activopos.com',
      password:    hashedAdmin,
      role:        'admin',
    },
  })

  const hashedCashier = await bcrypt.hash('cajero123', 12)

  await prisma.user.upsert({
    where:  { business_id_email: { business_id: business.id, email: 'cajero@activopos.com' } },
    update: {},
    create: {
      business_id: business.id,
      name:        'Cajero Demo',
      email:       'cajero@activopos.com',
      password:    hashedCashier,
      role:        'cashier',
    },
  })

  // ── Categorías ──────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Ropa',       color: '#2563EB', sort_order: 0 },
    { name: 'Alimentos',  color: '#16A34A', sort_order: 1 },
    { name: 'Tecnología', color: '#7C3AED', sort_order: 2 },
    { name: 'Servicios',  color: '#D97706', sort_order: 3 },
  ]

  const catIds: Record<string, number> = {}
  for (const def of categoryDefs) {
    const existing = await prisma.category.findFirst({
      where: { business_id: business.id, name: def.name },
    })
    const cat = existing ?? await prisma.category.create({
      data: { business_id: business.id, ...def },
    })
    catIds[def.name] = cat.id
  }
  console.log('✅ Categorías: Ropa, Alimentos, Tecnología, Servicios')

  // ── Ropa — Camisa Polo (con variantes) ──────────────────────────────
  const existingPolo = await prisma.product.findFirst({
    where: { business_id: business.id, name: 'Camisa Polo' },
  })

  if (!existingPolo) {
    await prisma.product.create({
      data: {
        business_id:        business.id,
        category_id:        catIds['Ropa'],
        name:               'Camisa Polo',
        description:        'Camisa polo de algodón, disponible en varias tallas y colores',
        sale_mode:          'unit',
        price_per_unit_usd: 15.00,
        cost_per_unit_usd:  8.00,
        has_variants:       true,
        is_available:       true,
        available_in_pos:   true,
        show_in_catalog:    true,
        min_stock:          5,
        variants: {
          create: [
            { tipo: 'talla', valor: 'S',      sort_order: 0 },
            { tipo: 'talla', valor: 'M',      sort_order: 1 },
            { tipo: 'talla', valor: 'L',      sort_order: 2 },
            { tipo: 'color', valor: 'Azul',   color_hex: '#1E40AF', sort_order: 3 },
            { tipo: 'color', valor: 'Rojo',   color_hex: '#DC2626', sort_order: 4 },
            { tipo: 'color', valor: 'Negro',  color_hex: '#171717', sort_order: 5 },
          ],
        },
      },
    })
    console.log('✅ Camisa Polo con variantes creada')
  } else if (!existingPolo.category_id) {
    await prisma.product.update({
      where: { id: existingPolo.id },
      data:  { category_id: catIds['Ropa'] },
    })
  }

  // ── Resto de productos por categoría (idempotente) ───────────────────
  const seedProducts = [
    // Ropa
    { name: 'Pantalón Jean',        cat: 'Ropa',       price: 22.00, cost: 12.00, desc: 'Jean de mezclilla corte slim, resistente y cómodo' },
    { name: 'Zapatos Deportivos',   cat: 'Ropa',       price: 35.00, cost: 18.00, desc: 'Calzado deportivo con suela antideslizante' },
    { name: 'Vestido Casual',       cat: 'Ropa',       price: 25.00, cost: 13.00, desc: 'Vestido de tela liviana, ideal para el día a día' },
    { name: 'Chaqueta de Cuero',    cat: 'Ropa',       price: 89.00, cost: 45.00, desc: 'Chaqueta de cuero genuino con forro interior' },
    { name: 'Gorra Cap',            cat: 'Ropa',       price: 12.00, cost:  6.00, desc: 'Gorra estilo cap ajustable con visera plana' },
    // Alimentos
    { name: 'Arepa con Pollo',      cat: 'Alimentos',  price:  3.50, cost:  1.50, desc: 'Arepa rellena de pollo mechado con guasacaca' },
    { name: 'Jugo Natural',         cat: 'Alimentos',  price:  2.00, cost:  0.80, desc: 'Jugo fresco del día: parchita, guayaba o naranja' },
    { name: 'Torta de Chocolate',   cat: 'Alimentos',  price: 15.00, cost:  7.00, desc: 'Torta húmeda de chocolate con ganache artesanal' },
    { name: 'Café Espresso',        cat: 'Alimentos',  price:  1.50, cost:  0.50, desc: 'Espresso doble de granos venezolanos seleccionados' },
    // Tecnología
    { name: 'Audífonos Bluetooth',  cat: 'Tecnología', price: 35.00, cost: 18.00, desc: 'Audífonos inalámbricos con cancelación de ruido' },
    { name: 'Cable USB-C',          cat: 'Tecnología', price:  8.00, cost:  3.00, desc: 'Cable USB-C 3A para carga rápida, 1 metro' },
    { name: 'Funda iPhone',         cat: 'Tecnología', price: 12.00, cost:  5.00, desc: 'Funda de silicona premium, varios modelos disponibles' },
    { name: 'Cargador Inalámbrico', cat: 'Tecnología', price: 25.00, cost: 12.00, desc: 'Cargador Qi 15W compatible con iPhone y Android' },
    // Servicios
    { name: 'Corte de Cabello',     cat: 'Servicios',  price:  8.00, cost:  2.00, desc: 'Corte clásico o moderno con lavado incluido',         svc: true },
    { name: 'Manicure',             cat: 'Servicios',  price: 12.00, cost:  4.00, desc: 'Manicure completo con esmaltado semipermanente',       svc: true },
    { name: 'Delivery Express',     cat: 'Servicios',  price:  5.00, cost:  2.00, desc: 'Entrega a domicilio en radio de 5 km',                 svc: true },
  ]

  for (const p of seedProducts) {
    const exists = await prisma.product.findFirst({
      where: { business_id: business.id, name: p.name },
    })
    if (!exists) {
      await prisma.product.create({
        data: {
          business_id:        business.id,
          category_id:        catIds[p.cat],
          name:               p.name,
          description:        p.desc,
          sale_mode:          p.svc ? 'service' : 'unit',
          product_type:       p.svc ? 'service'  : 'physical',
          price_per_unit_usd: p.price,
          cost_per_unit_usd:  p.cost,
          is_available:       true,
          available_in_pos:   true,
          show_in_catalog:    true,
          min_stock:          p.svc ? 0 : 3,
        },
      })
      console.log(`✅ ${p.name}`)
    } else if (!exists.category_id) {
      await prisma.product.update({
        where: { id: exists.id },
        data:  { category_id: catIds[p.cat] },
      })
    }
  }

  console.log('✅ Seed completado')
  console.log('📧 Admin:  admin@activopos.com  / admin123')
  console.log('📧 Cajero: cajero@activopos.com / cajero123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
