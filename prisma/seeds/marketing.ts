import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const dbHost     = process.env.DB_HOST ?? '127.0.0.1'
const isLoopback = dbHost === '127.0.0.1' || dbHost === 'localhost'

const adapter = new PrismaMariaDb({
  host:     dbHost,
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'activopos',
  ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
})

const prisma = new PrismaClient({ adapter })

async function seedPlans() {
  const plans = [
    {
      key: 'inicio',
      name: 'Mostrador',
      price_usd: 15,
      description: 'Para el negocio que quiere control real desde el primer día.',
      sort_order: 1,
      features: [
        'POS táctil ilimitado',
        'Inventario en tiempo real',
        'Tasa BCV automática',
        'Pago Móvil, Zelle, Efectivo',
        'Cierre de caja diario',
        'Hasta 2 usuarios',
        'Hasta 200 productos',
      ],
    },
    {
      key: 'pro',
      name: 'Negocio',
      price_usd: 25,
      description: 'Para el negocio que ya vende y quiere vender más.',
      sort_order: 2,
      features: [
        'Todo lo del plan Mostrador',
        'Catálogo digital con pedidos por WhatsApp',
        'Cotizaciones profesionales en PDF',
        'Clientes con historial y CxC',
        'Finanzas y reportes completos',
        'Hasta 5 usuarios',
        'Hasta 500 productos',
      ],
    },
    {
      key: 'business',
      name: 'Pro',
      price_usd: 40,
      description: 'Para el negocio que opera en serio.',
      sort_order: 3,
      features: [
        'Todo lo del plan Negocio',
        'Analytics avanzado',
        'Usuarios ilimitados',
        'Productos ilimitados',
        'KDS (pantalla de cocina)',
        'Soporte prioritario',
        'Acceso anticipado a nuevas funciones',
      ],
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: plan,
      create: plan,
    })
  }
  console.log('✅ Plans seeded')
}

const COMMON_FAQS = [
  {
    question: '¿ActivoPOS reemplaza mi facturación del SENIAT?',
    answer: 'No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Puedes usar ActivoPOS para el control diario y tu sistema fiscal por separado.',
    sort_order: 4,
  },
  {
    question: '¿Necesito instalar algo en mi computadora o teléfono?',
    answer: 'No. ActivoPOS corre completamente en el navegador — Chrome, Safari o cualquier browser moderno. Sin instalación, sin actualizaciones manuales. Funciona en teléfono, tablet o computadora.',
    sort_order: 5,
  },
  {
    question: '¿Cómo se actualiza la tasa del dólar?',
    answer: 'Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día. Tú defines el precio en USD una sola vez y el sistema calcula los bolívares en tiempo real en cada cobro.',
    sort_order: 6,
  },
  {
    question: '¿Qué métodos de pago acepta ActivoPOS?',
    answer: 'Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia bancaria y USDT. Un mismo cobro puede mezclar varios métodos.',
    sort_order: 7,
  },
  {
    question: '¿Cuánto cuesta ActivoPOS?',
    answer: 'El plan Mostrador arranca desde $15/mes. El plan Negocio con catálogo digital es $25/mes. El plan Pro con usuarios ilimitados es $40/mes. Sin contrato anual — pagas mes a mes.',
    sort_order: 8,
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer: 'Sí. No hay contrato anual ni penalización por cancelar. Cancelas cuando quieras y tu cuenta queda activa hasta el final del período pagado.',
    sort_order: 9,
  },
  {
    question: '¿Funciona desde el teléfono?',
    answer: 'Sí. ActivoPOS está diseñado mobile-first. El POS, el inventario, los reportes y el catálogo funcionan perfectamente desde cualquier teléfono Android o iPhone.',
    sort_order: 10,
  },
  {
    question: '¿Puedo tener varios usuarios con diferentes permisos?',
    answer: 'Sí. Puedes crear usuarios con rol de cajero — solo ven el POS y la caja — o de administrador — acceso completo. Cada uno entra con su propio usuario y contraseña.',
    sort_order: 11,
  },
  {
    question: '¿Qué pasa si se va la luz o el internet?',
    answer: 'Las ventas que ya procesaste quedan guardadas. Para nuevas ventas necesitas conexión — ActivoPOS es 100% en la nube. Recomendamos tener el hotspot del teléfono como respaldo.',
    sort_order: 12,
  },
]

async function seedSegments() {
  const segments = [
    {
      slug: 'carniceria',
      tag_line: 'Res · Cerdo · Aves',
      name: 'Carnicería',
      mode: 'product',
      theme_key: 'calle',
      sort_order: 1,
      active: true,
      headline: 'Vendés al kilo. Cobrás en dólares y Bs.',
      subheadline: 'Sin calculadora, sin libreta, sin sorpresas al cerrar.',
      meta_title: 'Sistema POS para Carnicerías en Venezuela | ActivoPOS',
      meta_description: 'Controla ventas por kilo, inventario de cortes y precios en USD y Bs automáticos. El POS diseñado para carnicerías venezolanas.',
      pain_1: 'Llevas el control de los cortes en libreta — y siempre falta algo al cerrar',
      pain_2: 'El precio del dólar cambia y tienes que recalcular todo a mano',
      pain_3: 'No sabes cuánto de res, cerdo y pollo te queda sin contar físicamente',
      faqs: {
        create: [
          { question: '¿Puedo vender por kilo y por pieza en el mismo sistema?', answer: 'Sí. Cada producto tiene su modo de venta: peso (kg con decimales) o unidad. Los puedes mezclar en el mismo ticket.', sort_order: 1 },
          { question: '¿Cómo maneja ActivoPOS la tasa del dólar en la carnicería?', answer: 'La tasa BCV se actualiza automáticamente. Tú pones el precio en USD y el sistema calcula los bolívares en tiempo real al momento del cobro.', sort_order: 2 },
          { question: '¿Puedo saber cuánto de cada corte me queda?', answer: 'Sí. El inventario descuenta automáticamente con cada venta. Ves el stock en tiempo real sin tener que contar.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'restaurante',
      tag_line: 'Mesas · Cocina · Delivery',
      name: 'Restaurante',
      mode: 'hybrid',
      theme_key: 'restaurante',
      sort_order: 2,
      active: true,
      headline: 'La comanda en papel se pierde. El dinero también.',
      subheadline: 'POS para restaurantes que necesitan control real de mesa a cocina.',
      meta_title: 'Sistema POS para Restaurantes en Venezuela | ActivoPOS',
      meta_description: 'Gestiona mesas, comandas, inventario y cobros en USD y Bs. El POS que entiende cómo trabaja un restaurante venezolano.',
      pain_1: 'Las comandas en papel se pierden, se confunden o llegan tarde a la cocina',
      pain_2: 'Al cerrar el día no sabes si lo que vendiste coincide con lo que ingresó',
      pain_3: 'Los meseros no saben los precios actualizados cuando el dólar sube',
      faqs: {
        create: [
          { question: '¿ActivoPOS maneja mesas y comandas?', answer: 'Sí. Puedes tener tickets abiertos por mesa, agregar productos, modificar y cobrar cuando el cliente pida la cuenta.', sort_order: 1 },
          { question: '¿Funciona con pantalla de cocina (KDS)?', answer: 'Sí, en el plan Pro tienes acceso al módulo KDS — una pantalla donde la cocina ve los pedidos en tiempo real sin papel.', sort_order: 2 },
          { question: '¿Puedo tener varios cajeros trabajando al mismo tiempo?', answer: 'Sí. Cada usuario tiene su acceso. Los cajeros ven el POS y los pedidos; el admin ve todo incluyendo reportes y finanzas.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'ferreterias',
      tag_line: 'Materiales · Construcción',
      name: 'Ferretería',
      mode: 'product',
      theme_key: 'ferreteria',
      sort_order: 3,
      active: true,
      headline: 'Miles de referencias. Un solo sistema para controlarlas.',
      subheadline: 'Inventario real, precios en dólares y búsqueda por código en segundos.',
      meta_title: 'Sistema POS para Ferreterías en Venezuela | ActivoPOS',
      meta_description: 'Controla miles de referencias, precios en USD y Bs, y ventas al mayor y detal. El POS para ferreterías venezolanas.',
      pain_1: 'Tienes miles de referencias y no sabes qué tienes stock sin ir a buscar',
      pain_2: 'Los precios en dólares cambian y actualizar todo toma horas',
      pain_3: 'Las ventas al mayor no tienen el mismo precio que al detal y eso genera errores',
      faqs: {
        create: [
          { question: '¿Puedo buscar productos por código o referencia?', answer: 'Sí. El POS tiene búsqueda por nombre, SKU y código de barras. También puedes usar la cámara del teléfono como escáner.', sort_order: 1 },
          { question: '¿ActivoPOS maneja precios al mayor y al detal?', answer: 'Puedes tener listas de precio por cliente. Un cliente mayorista ve sus precios, uno al detal ve los suyos.', sort_order: 2 },
          { question: '¿Puedo actualizar precios masivamente cuando sube el dólar?', answer: 'Sí. Puedes actualizar el costo y el margen de categorías completas. El sistema recalcula los precios automáticamente.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'farmacias',
      tag_line: 'Medicamentos · Salud',
      name: 'Farmacia',
      mode: 'product',
      theme_key: 'farmacia',
      sort_order: 4,
      active: true,
      headline: 'Vence el medicamento antes de que sepas que está vencido.',
      subheadline: 'Control de inventario, lotes y precios regulados en un solo lugar.',
      meta_title: 'Sistema POS para Farmacias en Venezuela | ActivoPOS',
      meta_description: 'Controla medicamentos, lotes, precios en USD y Bs, y evita ventas de productos vencidos. El POS para farmacias venezolanas.',
      pain_1: 'No sabes qué medicamentos están por vencer hasta que ya es tarde',
      pain_2: 'Los precios regulados cambian y no siempre tienes la lista actualizada',
      pain_3: 'El inventario en papel no te dice cuánto tienes de cada presentación',
      faqs: {
        create: [
          { question: '¿ActivoPOS maneja fechas de vencimiento?', answer: 'Puedes registrar lotes con fecha de vencimiento. El sistema te alerta cuando un producto está próximo a vencer.', sort_order: 1 },
          { question: '¿Cómo manejo los precios regulados?', answer: 'Cada producto tiene su precio en USD que tú defines. Si hay precio regulado, lo ingresas manualmente y el sistema lo respeta en el cobro.', sort_order: 2 },
          { question: '¿Puedo vender con Pago Móvil y efectivo en el mismo ticket?', answer: 'Sí. Un mismo ticket puede tener múltiples métodos de pago: Pago Móvil, Zelle, efectivo USD, efectivo Bs o cualquier combinación.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'tiendas-ropa',
      tag_line: 'Tallas · Colores · Apartados',
      name: 'Tienda de Ropa',
      mode: 'product',
      theme_key: 'joyeria',
      sort_order: 5,
      active: true,
      headline: 'Tallas, colores, variantes. Sin enredarte.',
      subheadline: 'Inventario por variante, catálogo digital y ventas por WhatsApp.',
      meta_title: 'Sistema POS para Tiendas de Ropa en Venezuela | ActivoPOS',
      meta_description: 'Gestiona tallas, colores y variantes de ropa con inventario real. Catálogo digital para vender por WhatsApp. POS para tiendas venezolanas.',
      pain_1: 'No sabes qué talla o color te queda de cada prenda sin revisar el depósito',
      pain_2: 'Tus clientes preguntan por WhatsApp y tienes que ir a buscar si hay stock',
      pain_3: 'Las ventas al crédito o apartados no las llevas con control real',
      faqs: {
        create: [
          { question: '¿Puedo manejar tallas y colores como variantes?', answer: 'Sí. Cada producto puede tener variantes (talla S, M, L / color rojo, azul). El inventario lleva el stock de cada combinación por separado.', sort_order: 1 },
          { question: '¿Puedo publicar mi catálogo para que clientes vean qué hay?', answer: 'Sí. ActivoPOS te da un catálogo digital en tutienda.activopos.com. Los clientes ven los productos disponibles y pueden pedir por WhatsApp.', sort_order: 2 },
          { question: '¿Maneja ventas a crédito o apartados?', answer: 'Sí. Puedes registrar ventas a crédito, llevar el saldo del cliente y registrar abonos parciales. Todo queda en el historial.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'abastos',
      tag_line: 'Bodega · Víveres · Fiaos',
      name: 'Abasto / Bodega',
      mode: 'product',
      theme_key: 'calle',
      sort_order: 6,
      active: true,
      headline: 'La bolsa de harina que no sabías que ya se acabó.',
      subheadline: 'Inventario en tiempo real para bodegas que venden de todo.',
      meta_title: 'Sistema POS para Abastos y Bodegas en Venezuela | ActivoPOS',
      meta_description: 'Controla el inventario de tu bodega o abasto, ventas en USD y Bs, y cierre de caja diario. El POS para abastos venezolanos.',
      pain_1: 'Se te acaban productos sin darte cuenta y pierdes ventas',
      pain_2: 'Al final del día no sabes exactamente cuánto entraste ni si cuadra',
      pain_3: 'Los fiaditos y ventas a crédito los llevas en libreta y se confunden',
      faqs: {
        create: [
          { question: '¿ActivoPOS funciona para bodegas con muchos productos?', answer: 'Sí. No hay límite de productos en los planes Negocio y Pro. Puedes tener cientos de referencias con su stock individual.', sort_order: 1 },
          { question: '¿Cómo manejo los fiaditos o ventas a crédito?', answer: 'Registras al cliente y sus ventas a crédito quedan en su cuenta. Ves cuánto te debe y registras los pagos cuando lleguen.', sort_order: 2 },
          { question: '¿Funciona con caja registradora o lector de código de barras?', answer: 'ActivoPOS funciona en cualquier dispositivo con navegador — tablet, teléfono, computador. Puedes usar la cámara como escáner de código de barras.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'tecnologia',
      tag_line: 'Equipos · Garantías · Reparación',
      name: 'Tecnología / Electrónicos',
      mode: 'hybrid',
      theme_key: 'tropical',
      sort_order: 7,
      active: true,
      headline: 'Seriales, garantías y reparaciones. Todo controlado.',
      subheadline: 'Para tiendas de electrónicos y servicios técnicos que venden y reparan.',
      meta_title: 'Sistema POS para Tiendas de Tecnología y Electrónicos en Venezuela | ActivoPOS',
      meta_description: 'Gestiona ventas de equipos, seriales, garantías y órdenes de reparación. POS para tiendas de tecnología venezolanas.',
      pain_1: 'No llevas control de seriales y cuando hay garantía no sabes a quién le vendiste',
      pain_2: 'Las reparaciones y servicios técnicos no tienen un flujo de seguimiento',
      pain_3: 'Los accesorios y equipos tienen precios en dólares que cambian constantemente',
      faqs: {
        create: [
          { question: '¿Puedo registrar el serial de cada equipo vendido?', answer: 'Sí. Puedes agregar notas y especificaciones a cada producto vendido. El historial del cliente guarda todos sus equipos.', sort_order: 1 },
          { question: '¿ActivoPOS maneja órdenes de servicio técnico?', answer: 'Sí, con el módulo de cotizaciones y servicios. Creas la orden, le das seguimiento y cobras al cerrar.', sort_order: 2 },
          { question: '¿Cómo mantengo los precios actualizados en dólares?', answer: 'Defines el precio en USD. La tasa BCV se actualiza automáticamente. Nunca más calcular bolívares a mano.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'repuestos',
      tag_line: 'Mecánica · Repuestos · Mayor',
      name: 'Tienda de Repuestos',
      mode: 'product',
      theme_key: 'ferreteria',
      sort_order: 8,
      active: true,
      headline: 'El repuesto que el cliente necesita. Tú sabes si lo tienes.',
      subheadline: 'Miles de referencias, búsqueda rápida y precios en dólares actualizados.',
      meta_title: 'Sistema POS para Tiendas de Repuestos en Venezuela | ActivoPOS',
      meta_description: 'Controla miles de referencias de repuestos, precios en USD y Bs, y ventas al mayor y detal. El POS para repuesteras venezolanas.',
      pain_1: 'Tienes miles de referencias y encontrar el repuesto toma demasiado tiempo',
      pain_2: 'Los precios en dólares cambian y no siempre están actualizados cuando el cliente pregunta',
      pain_3: 'No sabes qué referencias se mueven y cuáles llevan meses sin venderse',
      faqs: {
        create: [
          { question: '¿Puedo buscar repuestos por código o referencia del fabricante?', answer: 'Sí. La búsqueda del POS funciona por nombre, SKU y código de barras. Encuentra cualquier referencia en segundos.', sort_order: 1 },
          { question: '¿ActivoPOS maneja precios al mayor y al detal?', answer: 'Sí. Puedes asignar listas de precio por tipo de cliente. Los mayoristas ven sus precios y los detallistas los suyos.', sort_order: 2 },
          { question: '¿Puedo ver qué referencias se venden más?', answer: 'Sí. Los reportes muestran los productos más vendidos por período. Ves qué referencias se mueven y cuáles están quietas.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'joyerias',
      tag_line: 'Joyas · Apartados · Divisas',
      name: 'Joyería',
      mode: 'product',
      theme_key: 'joyeria',
      sort_order: 9,
      active: false,
      headline: 'Cada pieza tiene su historia. Y su precio exacto.',
      subheadline: 'Control de inventario, cotizaciones y ventas en dólares para joyerías.',
      meta_title: 'Sistema POS para Joyerías en Venezuela | ActivoPOS',
      meta_description: 'Gestiona el inventario de joyas, cotizaciones y ventas en USD y Bs. El POS para joyerías venezolanas.',
      pain_1: 'Llevar el control de cada pieza de manera individual es difícil con papel o Excel',
      pain_2: 'Las cotizaciones para piezas especiales no tienen un flujo profesional',
      pain_3: 'Los pagos en divisas, Bs y transferencias se mezclan sin control',
      faqs: {
        create: [
          { question: '¿Puedo asignar un precio individual a cada pieza?', answer: 'Sí. Cada producto tiene su precio propio. Puedes tener piezas únicas con fotos, descripción y precio en USD.', sort_order: 1 },
          { question: '¿ActivoPOS genera cotizaciones formales?', answer: 'Sí. El módulo de cotizaciones genera un PDF con los datos del negocio, la descripción de las piezas y el total en USD y Bs.', sort_order: 2 },
          { question: '¿Maneja ventas a crédito o apartados?', answer: 'Sí. Registras el apartado, el cliente queda en el sistema y los abonos se registran hasta completar el pago.', sort_order: 3 },
        ],
      },
    },
    {
      slug: 'servicios',
      tag_line: 'Servicios · Cotización · CxC',
      name: 'Servicios y Oficina',
      mode: 'service',
      theme_key: 'oficina',
      sort_order: 10,
      active: true,
      headline: 'Cobras por lo que haces. No por lo que vendes.',
      subheadline: 'Cotizaciones, facturación de servicios y control de clientes para empresas de servicios.',
      meta_title: 'Sistema de Gestión para Empresas de Servicios en Venezuela | ActivoPOS',
      meta_description: 'Gestiona cotizaciones, cobros por servicios, clientes con CxC y reportes financieros. Para gestorías, consultoras y empresas de servicios venezolanas.',
      pain_1: 'Las cotizaciones las haces en Word y no llevas un historial de cuáles se aprobaron',
      pain_2: 'Los clientes te deben y no tienes un sistema que te diga cuánto y desde cuándo',
      pain_3: 'Al final del mes no sabes exactamente cuánto facturaste ni tu rentabilidad real',
      faqs: {
        create: [
          { question: '¿ActivoPOS funciona para servicios sin inventario físico?', answer: 'Sí. Puedes crear servicios como productos sin stock. El POS los agrega al ticket igual que cualquier artículo.', sort_order: 1 },
          { question: '¿Genera cotizaciones profesionales en PDF?', answer: 'Sí. Las cotizaciones incluyen los datos de tu empresa, el detalle de servicios, total en USD y Bs, y condiciones de pago.', sort_order: 2 },
          { question: '¿Cómo llevo el control de clientes que me deben?', answer: 'Cada cliente tiene su cuenta. Las ventas a crédito quedan registradas y ves el saldo pendiente, los abonos y el historial completo.', sort_order: 3 },
          ...COMMON_FAQS,
        ],
      },
    },
    {
      slug: 'clinicas',
      tag_line: 'Consultas · Insumos · Salud',
      name: 'Clínica / Consultorio',
      mode: 'hybrid',
      theme_key: 'clinica',
      sort_order: 11,
      active: false,
      headline: 'La consulta cobrada. El medicamento controlado.',
      subheadline: 'Para clínicas, consultorios y centros de salud que venden y atienden.',
      meta_title: 'Sistema POS para Clínicas y Consultorios en Venezuela | ActivoPOS',
      meta_description: 'Gestiona cobros de consultas, medicamentos e inventario médico en USD y Bs. El POS para clínicas y consultorios venezolanos.',
      pain_1: 'Los cobros de consultas y medicamentos no están integrados en un solo sistema',
      pain_2: 'El inventario de insumos médicos no se lleva con control real',
      pain_3: 'Los pacientes con deuda no tienen un seguimiento formal',
      faqs: {
        create: [
          { question: '¿ActivoPOS separa cobros de consulta de venta de medicamentos?', answer: 'Puedes crear servicios (consulta, procedimiento) y productos (medicamentos, insumos) en el mismo sistema. El ticket los agrupa según corresponda.', sort_order: 1 },
          { question: '¿Funciona para cobrar con divisas y Bs?', answer: 'Sí. Todos los métodos de pago venezolanos están integrados: Pago Móvil, Zelle, efectivo USD, efectivo Bs.', sort_order: 2 },
          { question: '¿Puedo llevar el historial de pagos de un paciente?', answer: 'Sí. Cada cliente tiene su historial de visitas, cobros y deuda pendiente si aplica.', sort_order: 3 },
        ],
      },
    },
    {
      slug: 'gestoria-tramites',
      tag_line: 'Trámites · Legal · Gestión',
      name: 'Gestoría y Trámites',
      mode: 'service',
      theme_key: 'oficina',
      sort_order: 12,
      active: false,
      headline: 'Cada trámite tiene su precio. Y su cliente que lo paga.',
      subheadline: 'Para gestorías, abogados y tramitadores que cobran por servicios profesionales.',
      meta_title: 'Sistema de Gestión para Gestorías y Trámites en Venezuela | ActivoPOS',
      meta_description: 'Gestiona cobros por trámites, cotizaciones profesionales y clientes con cuentas por cobrar. Para gestorías venezolanas.',
      pain_1: 'No tienes un sistema para cotizar servicios con precios en dólares de forma profesional',
      pain_2: 'Los clientes que pagan en partes no tienen un control formal de lo que deben',
      pain_3: 'Al final del mes no sabes cuánto facturaste ni qué trámites están pendientes de cobro',
      faqs: {
        create: [
          { question: '¿ActivoPOS genera cotizaciones para servicios de gestoría?', answer: 'Sí. Creas cada trámite como un servicio, el sistema genera una cotización en PDF con todos los detalles y el total en USD y Bs.', sort_order: 1 },
          { question: '¿Puedo registrar pagos parciales?', answer: 'Sí. Los clientes pueden pagar en partes. El sistema lleva el saldo pendiente y el historial de abonos.', sort_order: 2 },
          { question: '¿Funciona para gestorías con varios empleados?', answer: 'Sí. Puedes tener múltiples usuarios con diferentes roles. Los empleados registran trámites y el admin ve los reportes completos.', sort_order: 3 },
        ],
      },
    },
  ]

  for (const { faqs, ...segmentData } of segments) {
    await prisma.segment.upsert({
      where: { slug: segmentData.slug },
      update: {
        ...segmentData,
        faqs: {
          deleteMany: {},
          create: faqs.create,
        },
      },
      create: {
        ...segmentData,
        faqs,
      },
    })
  }
  console.log('✅ Segments seeded (12)')
}

async function main() {
  console.log('🌱 Seeding marketing data...')
  await seedPlans()
  await seedSegments()
  console.log('✅ Marketing seed completo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
