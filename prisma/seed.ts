import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bcrypt from 'bcryptjs'

const dbHost      = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback  = dbHost === '127.0.0.1' || dbHost === 'localhost'

const adapter = new PrismaMariaDb({
  host:     dbHost,
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'activopos',
  ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding ActivoPOS...')

  const catalogFields = {
    catalog_slug:   'demo',
    catalog_active: true,
    catalog_plan:   'pro',
    catalog_title:  'Tienda Demo',
    catalog_desc:   'Catálogo de prueba de ActivoPOS — explora nuestros productos',
    segment:        'retail',
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

  // ── Expense Categories (DT-023) ──────────────────────────────────────
  const expenseCategoryDefs = [
    { name: 'Alquiler',           color: '#6366f1', is_system: true  },
    { name: 'Servicios públicos', color: '#0ea5e9', is_system: true  },
    { name: 'Nómina',             color: '#f59e0b', is_system: true  },
    { name: 'Insumos',            color: '#10b981', is_system: true  },
    { name: 'Marketing',          color: '#ec4899', is_system: true  },
    { name: 'Otros',              color: '#94a3b8', is_system: true  },
  ]

  for (const def of expenseCategoryDefs) {
    await prisma.expenseCategory.upsert({
      where:  { business_id_name: { business_id: business.id, name: def.name } },
      update: { color: def.color },
      create: { business_id: business.id, ...def },
    })
  }
  console.log('✅ Expense Categories: Alquiler, Servicios públicos, Nómina, Insumos, Marketing, Otros')

  // ── Categorías ──────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Ropa',       color: '#2563EB', sort_order: 0 },
    { name: 'Alimentos',  color: '#16A34A', sort_order: 1 },
    { name: 'Tecnología', color: '#7C3AED', sort_order: 2 },
    { name: 'Servicios',  color: '#D97706', sort_order: 3 },
  ]

  const catIds: Record<string, number> = {}
  for (const def of categoryDefs) {
    const cat = await prisma.category.upsert({
      where:  { name_business: { business_id: business.id, name: def.name } },
      update: { color: def.color, sort_order: def.sort_order },
      create: { business_id: business.id, ...def },
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
        badge:              'popular',
        is_featured:        true,
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
  } else {
    await prisma.product.update({
      where: { id: existingPolo.id },
      data:  { category_id: catIds['Ropa'], badge: 'popular', is_featured: true },
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
    { name: 'Arepa con Pollo',      cat: 'Alimentos',  price:  3.50, cost:  1.50, desc: 'Arepa rellena de pollo mechado con guasacaca',         badge: 'recomendado', is_featured: true },
    { name: 'Jugo Natural',         cat: 'Alimentos',  price:  2.00, cost:  0.80, desc: 'Jugo fresco del día: parchita, guayaba o naranja' },
    { name: 'Torta de Chocolate',   cat: 'Alimentos',  price: 15.00, cost:  7.00, desc: 'Torta húmeda de chocolate con ganache artesanal',      badge: 'promo' },
    { name: 'Café Espresso',        cat: 'Alimentos',  price:  1.50, cost:  0.50, desc: 'Espresso doble de granos venezolanos seleccionados' },
    // Tecnología
    { name: 'Audífonos Bluetooth',  cat: 'Tecnología', price: 35.00, cost: 18.00, desc: 'Audífonos inalámbricos con cancelación de ruido',     badge: 'nuevo' },
    { name: 'Cable USB-C',          cat: 'Tecnología', price:  8.00, cost:  3.00, desc: 'Cable USB-C 3A para carga rápida, 1 metro' },
    { name: 'Funda iPhone',         cat: 'Tecnología', price: 12.00, cost:  5.00, desc: 'Funda de silicona premium, varios modelos disponibles' },
    { name: 'Cargador Inalámbrico', cat: 'Tecnología', price: 25.00, cost: 12.00, desc: 'Cargador Qi 15W compatible con iPhone y Android' },
    // Servicios
    { name: 'Corte de Cabello',     cat: 'Servicios',  price:  8.00, cost:  2.00, desc: 'Corte clásico o moderno con lavado incluido',         svc: true },
    { name: 'Manicure',             cat: 'Servicios',  price: 12.00, cost:  4.00, desc: 'Manicure completo con esmaltado semipermanente',       svc: true },
    { name: 'Delivery Express',     cat: 'Servicios',  price:  5.00, cost:  2.00, desc: 'Entrega a domicilio en radio de 5 km',                 svc: true },
  ] as Array<{
    name: string; cat: string; price: number; cost: number; desc: string;
    svc?: boolean; badge?: string; is_featured?: boolean
  }>

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
          product_type:       'simple',
          price_per_unit_usd: p.price,
          cost_per_unit_usd:  p.cost,
          is_available:       true,
          available_in_pos:   true,
          show_in_catalog:    true,
          min_stock:          p.svc ? 0 : 3,
          badge:              p.badge ?? 'none',
          is_featured:        p.is_featured ?? false,
        },
      })
      console.log(`✅ ${p.name}`)
    } else {
      const badgeUpdate = p.badge !== undefined || p.is_featured !== undefined
      await prisma.product.update({
        where: { id: exists.id },
        data:  {
          category_id: catIds[p.cat],
          ...(badgeUpdate ? { badge: p.badge ?? 'none', is_featured: p.is_featured ?? false } : {}),
        },
      })
    }
  }

  // ── Datos demo: clientes, ventas, gastos, tasa ───────────────────────
  // Idempotente por prefijo de ticket propio (el negocio demo ya tenía 344 ventas
  // de pruebas previas, todas anteriores a julio — sin esto el dashboard "hoy/7
  // días" y el P&L "mes" se ven vacíos frente al cliente).
  const demoSalesCount = await prisma.sale.count({
    where: { business_id: business.id, ticket_number: { startsWith: 'DEMO-' } },
  })

  if (demoSalesCount === 0) {
    const DEMO_RATE = 45.00
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
    const pick = <T,>(arr: T[]): T => arr[randomInt(0, arr.length - 1)]

    const clientDefs = [
      { name: 'Ferretería El Tornillo', phone: '04141234567', email: 'tornillo@example.com' },
      { name: 'Panadería Doña Rosa',    phone: '04241234567', email: null },
      { name: 'Distribuidora JM',       phone: '04121234567', email: 'jm@example.com' },
    ]
    const clients = []
    for (const c of clientDefs) {
      const existing = await prisma.client.findFirst({ where: { business_id: business.id, name: c.name } })
      clients.push(existing ?? await prisma.client.create({ data: { business_id: business.id, ...c } }))
    }

    // Solo el catálogo demo real — business_id=1 acumuló cientos de productos de
    // prueba de otras sesiones (CLIC21_VA01_Base, etc.) sin cost_per_unit_usd.
    const catalogNames = ['Camisa Polo', ...seedProducts.map(p => p.name)]
    const allProducts  = await prisma.product.findMany({
      where: { business_id: business.id, name: { in: catalogNames } },
    })
    const paidMethods  = await prisma.paymentMethod.findMany({
      where: { business_id: business.id, name: { in: ['Efectivo USD', 'Pago Móvil', 'Zelle'] } },
    })
    // Los roles pueden derivar con el uso (p. ej. impersonación) — el email es el identificador estable.
    const cashierUser = await prisma.user.findFirstOrThrow({ where: { business_id: business.id, email: 'cajero@activopos.com' } })
    const adminUser   = await prisma.user.findFirstOrThrow({ where: { business_id: business.id, email: 'admin@activopos.com' } })

    const TOTAL_SALES  = 50
    const CREDIT_COUNT = 10 // 20%
    const statuses: Array<'paid' | 'credit'> = [
      ...Array(TOTAL_SALES - CREDIT_COUNT).fill('paid' as const),
      ...Array(CREDIT_COUNT).fill('credit' as const),
    ]
    for (let i = statuses.length - 1; i > 0; i--) {
      const j = randomInt(0, i)
      ;[statuses[i], statuses[j]] = [statuses[j], statuses[i]]
    }

    for (let i = 0; i < TOTAL_SALES; i++) {
      const status  = statuses[i]
      const daysAgo = i < 5 ? 0 : i < 15 ? randomInt(1, 6) : randomInt(7, 29)
      const soldAt  = new Date(Date.now() - daysAgo * 86_400_000)
      soldAt.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0)

      const itemCount     = randomInt(1, 3)
      const lineItems     = Array.from({ length: itemCount }, () => {
        const product = pick(allProducts)
        const qty     = Number(product.price_per_unit_usd) > 20 ? randomInt(1, 2) : randomInt(1, 3)
        return { product, qty }
      })

      let totalUsd = lineItems.reduce((sum, li) => sum + Number(li.product.price_per_unit_usd ?? 0) * li.qty, 0)
      if (totalUsd < 5) totalUsd += 5
      if (totalUsd > 150) lineItems.length = 1
      totalUsd = lineItems.reduce((sum, li) => sum + Number(li.product.price_per_unit_usd ?? 0) * li.qty, 0)
      const totalBs = totalUsd * DEMO_RATE

      const client = status === 'credit'
        ? pick(clients)
        : (randomInt(0, 2) === 0 ? pick(clients) : null)

      let dueDate: Date | null    = null
      let creditDays: number | null = null
      if (status === 'credit') {
        creditDays = randomInt(5, 30)
        dueDate    = new Date(soldAt.getTime() + creditDays * 86_400_000)
      }

      const sale = await prisma.sale.create({
        data: {
          business_id:   business.id,
          cashier_id:    cashierUser.id,
          ticket_number: `DEMO-${String(1000 + i)}`,
          status,
          origin:        status === 'credit' ? 'credit' : 'pos',
          total_usd:     totalUsd,
          total_bs:      totalBs,
          rate_used:     DEMO_RATE,
          client_id:     client?.id,
          client_name:   client?.name,
          sold_at:       status === 'paid' ? soldAt : null,
          due_date:      dueDate,
          credit_days:   creditDays,
          created_at:    soldAt,
          items: {
            create: lineItems.map(li => ({
              product_id:         li.product.id,
              product_name:       li.product.name,
              sale_mode:          li.product.sale_mode,
              unit_label:         li.product.unit_label,
              quantity:           li.qty,
              price_per_unit_usd: li.product.price_per_unit_usd ?? 0,
              cost_per_unit_usd:  li.product.cost_per_unit_usd ?? 0,
              subtotal_usd:       Number(li.product.price_per_unit_usd ?? 0) * li.qty,
              subtotal_bs:        Number(li.product.price_per_unit_usd ?? 0) * li.qty * DEMO_RATE,
              rate_used:          DEMO_RATE,
            })),
          },
        },
      })

      if (status === 'paid') {
        await prisma.salePayment.create({
          data: {
            sale_id:           sale.id,
            payment_method_id: pick(paidMethods).id,
            amount_usd:        totalUsd,
            amount_bs:         totalBs,
            rate_used:         DEMO_RATE,
          },
        })
      }
    }
    console.log(`✅ ${TOTAL_SALES} ventas demo creadas (${TOTAL_SALES - CREDIT_COUNT} pagadas, ${CREDIT_COUNT} a crédito, 3 clientes con CxC)`)

    // ── Gastos operativos del mes ────────────────────────────────────────
    const now          = new Date()
    const daysElapsed   = now.getDate()
    const expenseCats  = await prisma.expenseCategory.findMany({ where: { business_id: business.id } })
    const gastoDefs = [
      { concepto: 'Alquiler del local',   monto: 300.00, categoria: 'Alquiler',           dia: 1  },
      { concepto: 'Electricidad y agua',  monto:  45.00, categoria: 'Servicios públicos', dia: 3  },
      { concepto: 'Nómina quincenal',     monto: 250.00, categoria: 'Nómina',             dia: 5  },
      { concepto: 'Compra de insumos',    monto: 120.00, categoria: 'Insumos',             dia: 8  },
      { concepto: 'Publicidad en redes',  monto:  60.00, categoria: 'Marketing',           dia: 10 },
    ]
    for (const g of gastoDefs) {
      const existingGasto = await prisma.gasto.findFirst({ where: { business_id: business.id, concepto: g.concepto } })
      if (existingGasto) continue
      const dia   = Math.min(g.dia, daysElapsed)
      const fecha = new Date(now.getFullYear(), now.getMonth(), dia)
      await prisma.gasto.create({
        data: {
          business_id: business.id,
          concepto:    g.concepto,
          monto_usd:   g.monto,
          categoria:   g.categoria,
          category_id: expenseCats.find(c => c.name === g.categoria)?.id,
          fecha,
          is_paid:     true,
          paid_at:     fecha,
          created_by:  adminUser.id,
        },
      })
    }
    console.log('✅ 5 gastos operativos del mes creados')

    // ── Tasa BCV demo (fallback si la API externa falla) ─────────────────
    const existingDemoRate = await prisma.dollarRate.findFirst({ where: { business_id: business.id, source: 'bcv-demo' } })
    if (!existingDemoRate) {
      await prisma.dollarRate.create({
        data: { business_id: business.id, rate: DEMO_RATE, source: 'bcv-demo' },
      })
      console.log(`✅ Tasa BCV demo: ${DEMO_RATE}`)
    }
  }

  console.log('✅ Seed completado')
  console.log('📧 Admin:  admin@activopos.com  / admin123')
  console.log('📧 Cajero: cajero@activopos.com / cajero123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
