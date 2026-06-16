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

  const business = await prisma.business.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      name:                 'Mi Negocio Demo',
      legal_name:           'Mi Negocio Demo C.A.',
      rif:                  'J-000000000',
      city:                 'Caracas',
      state:                'Distrito Capital',
      theme:                'dark',
      ticket_prefix:        'ACT',
      onboarding_completed: true,
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

  // Producto demo con variantes
  const existingPolo = await prisma.product.findFirst({
    where: { business_id: business.id, name: 'Camisa Polo' },
  })

  if (!existingPolo) {
    await prisma.product.create({
      data: {
        business_id:        business.id,
        name:               'Camisa Polo',
        sale_mode:          'unit',
        price_per_unit_usd: 15.00,
        cost_per_unit_usd:  8.00,
        has_variants:       true,
        is_available:       true,
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
  }

  console.log('✅ Seed completado')
  console.log('📧 Admin:  admin@activopos.com  / admin123')
  console.log('📧 Cajero: cajero@activopos.com / cajero123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
