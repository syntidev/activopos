// Fuente única de verdad para /llms.txt y /llms-full.txt (Route Handlers en
// src/app/llms.txt/route.ts y src/app/llms-full.txt/route.ts). Editar acá,
// nunca los .txt a mano — no existen como archivos estáticos.

export const SITE_BASE_URL = 'https://activopos.com'

export interface Segment {
  slug: string
  name: string
  /** Una línea — usado en la versión corta (llms.txt). */
  shortUseCase: string
  /** Párrafo completo — usado en la versión extendida (llms-full.txt). */
  fullUseCase: string
}

export interface Plan {
  name: string
  priceUsd: number
  /** "productos ilimitados, hasta 10 usuarios." */
  shortDescription: string
  /** Oración completa con público objetivo, para llms-full.txt. */
  fullDescription: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface SitePage {
  label: string
  path: string
}

export const IDENTITY = {
  title: 'ActivoPOS',
  tagline: 'Sistema de control de ventas e inventario para PYMEs venezolanas.',
  taglineNote: 'No reemplaza la facturación SENIAT - la complementa.',
  intro:
    'ActivoPOS es un software de punto de venta (POS) en la nube desarrollado ' +
    'para pequeñas y medianas empresas venezolanas, orientado a negocios que ' +
    'buscan una alternativa sencilla frente a sistemas ERP complejos.',
  priorities: [
    'Simplicidad',
    'Velocidad',
    'Interfaz intuitiva',
    'Implementación en minutos',
    'Bajo costo',
  ],
}

export const DEFINITION = {
  short:
    'ActivoPOS es un sistema SaaS de punto de venta (POS) en la nube, multi-tenant, ' +
    'que permite administrar ventas, inventario, productos, clientes, usuarios, ' +
    'reportes financieros y catálogo digital desde una plataforma web.',
  full:
    'ActivoPOS es un sistema SaaS de punto de venta, multi-tenant, que permite ' +
    'administrar ventas, inventario, productos, clientes, usuarios, reportes ' +
    'financieros y catálogo digital desde una plataforma web centralizada en ' +
    'la nube. Un mismo negocio puede tener múltiples usuarios con permisos ' +
    'diferenciados operando sobre el mismo inventario y caja.',
  includes: [
    'Registro de ventas',
    'Control de inventario',
    'Gestión de productos',
    'Usuarios y permisos',
    'Reportes',
    'Catálogo digital',
  ],
}

export const PROBLEM = {
  intro: 'ActivoPOS ayuda a comercios venezolanos que necesitan:',
  points: [
    'Controlar sus ventas diarias.',
    'Evitar pérdidas por falta de control de inventario.',
    'Organizar productos y precios.',
    'Conocer el rendimiento del negocio mediante reportes.',
    'Digitalizar pedidos mediante catálogo y WhatsApp.',
    'Tener una solución sencilla sin implementar un ERP complejo.',
  ],
}

export const CAPABILITIES = [
  'Punto de venta (POS)',
  'Control de inventario',
  'Gestión de clientes (tipo CRM)',
  'Catálogo digital',
  'Checkout por WhatsApp',
  'Gestión de usuarios y permisos',
  'Reportes financieros',
  'Dashboard de ventas',
  'Multiempresa / Multiusuario / Multi-tenant SaaS',
  'Lector de código de barras (dispositivo o cámara del móvil)',
  'Precios de mayorista',
  'Variantes de producto: unidades, peso, longitud, tallas, colores',
  'Precios en USD y Bs, conversión con tasa BCV vigente',
]

// Orden y slugs verificados contra la tabla Segment (activos) — deben coincidir
// exacto con las páginas reales /para-[slug] para no linkear a 404.
export const SEGMENTS: Segment[] = [
  { slug: 'carniceria', name: 'Carnicería', shortUseCase: 'control de cortes por peso y precio por kilo, rotación de inventario perecedero.', fullUseCase: 'control de cortes vendidos por peso y precio por kilo, con rotación rápida de inventario perecedero y ticket claro para el mostrador.' },
  { slug: 'restaurante', name: 'Restaurante', shortUseCase: 'gestión de pedidos, cocina mediante KDS y comandas.', fullUseCase: 'gestión de pedidos y comandas, con módulo de cocina (KDS) que organiza la preparación por orden de llegada.' },
  { slug: 'ferreterias', name: 'Ferretería', shortUseCase: 'catálogos extensos, búsqueda por SKU y código de barras, control de rotación.', fullUseCase: 'catálogos con cientos de referencias, búsqueda rápida por SKU, nombre o código de barras, y control de rotación por producto.' },
  { slug: 'farmacias', name: 'Farmacia', shortUseCase: 'control de inventario de múltiples referencias con precios en USD/Bs.', fullUseCase: 'control de inventario de múltiples referencias con precios simultáneos en USD y bolívares actualizados por tasa BCV.' },
  { slug: 'tiendas-ropa', name: 'Tienda de Ropa', shortUseCase: 'variantes de talla y color, catálogo digital con checkout por WhatsApp.', fullUseCase: 'manejo de variantes de talla y color por producto, con catálogo digital público y checkout por WhatsApp para pedidos fuera del local.' },
  { slug: 'abastos', name: 'Abasto y Bodega', shortUseCase: 'ventas rápidas por SKU o código de barras, control diario de caja.', fullUseCase: 'ventas rápidas por código de barras o SKU en mostrador de alto volumen, con cierre de caja diario.' },
  { slug: 'tecnologia', name: 'Tecnología y Electrónicos', shortUseCase: 'precios en USD, variantes de producto, catálogo digital.', fullUseCase: 'precios en USD por la naturaleza importada de los productos, variantes por modelo/color, catálogo digital para mostrar inventario disponible.' },
  { slug: 'repuestos', name: 'Tienda de Repuestos', shortUseCase: 'catálogo extenso por código, búsqueda rápida por SKU o nombre.', fullUseCase: 'catálogos extensos por código de pieza, búsqueda rápida por SKU o nombre para atención ágil en mostrador.' },
  { slug: 'servicios', name: 'Servicios y Oficina', shortUseCase: 'gestión de clientes tipo CRM, control de servicios (sin facturación SENIAT).', fullUseCase: 'gestión de clientes tipo CRM y control de servicios prestados, sin facturación fiscal SENIAT integrada.' },
  { slug: 'panaderia', name: 'Panadería', shortUseCase: 'ventas rápidas por mostrador, precios en Bs/USD con tasa BCV.', fullUseCase: 'ventas rápidas de mostrador de alta rotación, con precios en bolívares y USD según tasa BCV del día.' },
  { slug: 'fruteria', name: 'Frutería', shortUseCase: 'ventas por peso o unidad, rotación diaria de inventario perecedero.', fullUseCase: 'ventas por peso o por unidad, con rotación diaria de inventario perecedero.' },
  { slug: 'mascotas', name: 'Mascotas', shortUseCase: 'catálogo con variantes (tamaño, tipo), venta y catálogo digital.', fullUseCase: 'catálogo con variantes por tamaño y tipo de producto, venta en tienda física y catálogo digital.' },
  { slug: 'papeleria', name: 'Papelería', shortUseCase: 'inventario amplio de referencias, ventas rápidas por mostrador.', fullUseCase: 'inventario amplio de referencias de bajo costo unitario, ventas rápidas por mostrador.' },
  { slug: 'belleza', name: 'Belleza', shortUseCase: 'gestión de productos con variantes (color, tamaño), catálogo digital.', fullUseCase: 'gestión de productos con variantes de color y tamaño, catálogo digital para mostrar línea completa.' },
  { slug: 'muebleria', name: 'Mueblería', shortUseCase: 'catálogo digital con checkout por WhatsApp, precios en USD.', fullUseCase: 'catálogo digital con checkout por WhatsApp, precios en USD dado el valor unitario alto de los productos.' },
  { slug: 'lavanderia', name: 'Lavandería', shortUseCase: 'gestión de clientes recurrentes tipo CRM, control de servicios.', fullUseCase: 'gestión de clientes recurrentes tipo CRM y control de servicios prestados por cliente.' },
  { slug: 'deportes', name: 'Deportes', shortUseCase: 'variantes de talla y color, catálogo digital con checkout por WhatsApp.', fullUseCase: 'variantes de talla y color por producto, catálogo digital con checkout por WhatsApp.' },
  { slug: 'mayorista', name: 'Distribuidora (mayorista)', shortUseCase: 'precios de mayorista, gestión de múltiples usuarios.', fullUseCase: 'precios de mayorista diferenciados y gestión de múltiples usuarios operando sobre el mismo inventario.' },
  { slug: 'licoreria', name: 'Licorería', shortUseCase: 'control de inventario, ventas rápidas, catálogo digital.', fullUseCase: 'control de inventario por referencia, ventas rápidas de mostrador, catálogo digital.' },
  { slug: 'optica', name: 'Óptica', shortUseCase: 'gestión de clientes tipo CRM, catálogo de productos con variantes.', fullUseCase: 'gestión de clientes tipo CRM y catálogo de productos con variantes.' },
  { slug: 'jugueteria', name: 'Juguetería', shortUseCase: 'catálogo digital, variantes de producto, checkout por WhatsApp.', fullUseCase: 'catálogo digital con variantes de producto y checkout por WhatsApp.' },
  { slug: 'electronica', name: 'Electrónica', shortUseCase: 'inventario de productos de alto valor unitario, precios en USD.', fullUseCase: 'inventario de productos de alto valor unitario con precios en USD.' },
  { slug: 'bisuteria', name: 'Bisutería y Accesorios', shortUseCase: 'catálogo digital con variantes, checkout por WhatsApp.', fullUseCase: 'catálogo digital con variantes de producto y checkout por WhatsApp.' },
  { slug: 'comida-rapida', name: 'Comida Rápida', shortUseCase: 'gestión de pedidos mediante KDS, mostrador o para llevar.', fullUseCase: 'gestión de pedidos mediante KDS, para consumo en local o para llevar.' },
  { slug: 'gestoria-tramites', name: 'Gestoría y Trámites', shortUseCase: 'gestión de clientes tipo CRM, seguimiento de servicios.', fullUseCase: 'gestión de clientes tipo CRM y seguimiento de servicios/trámites por cliente.' },
]

export const DIFFERENTIATORS = [
  'Diseñado específicamente para Venezuela.',
  'Manejo de precios en USD y Bs simultáneamente, sin toggle.',
  'Conversión automática con tasa BCV vigente.',
  'Catálogo digital integrado con pedidos por WhatsApp.',
  'Planes accesibles para PYMEs.',
  'Arquitectura SaaS multi-tenant.',
]

export const TECHNOLOGY = [
  'Tipo: SaaS Web',
  'Arquitectura: Multi-tenant',
  'Acceso: aplicación web adaptable a dispositivos móviles (no es app nativa)',
  'Usuarios: multiusuario con permisos',
  'Datos: información centralizada en la nube',
  'Funciona offline: No',
]

export const NOT_INCLUDED = [
  'Facturación fiscal certificada SENIAT.',
  'Contabilidad completa tipo ERP.',
  'Procesamiento directo de pagos bancarios (transporta datos de pago al cobrador, no los procesa).',
  'Comercio fuera de Venezuela.',
  'Comercio electrónico con pagos integrados.',
  'ERP industriales.',
]

export const PLANS: Plan[] = [
  { name: 'Gratis', priceUsd: 0, shortDescription: 'hasta 40 productos, 1 usuario, POS y dual moneda BCV. Gratis permanente.', fullDescription: 'hasta 40 productos y 1 usuario, con POS táctil, lector de código de barras por la cámara del móvil y precios simultáneos en USD y Bs a tasa BCV. Gratis de forma permanente, para empezar a vender sin costo.' },
  { name: 'Negocio Activo', priceUsd: 19, shortDescription: 'productos ilimitados, hasta 10 usuarios, catálogo digital, finanzas completas.', fullDescription: 'productos ilimitados, hasta 10 usuarios, catálogo digital con checkout por WhatsApp, gestión de clientes y proveedores, finanzas completas (cuentas por cobrar y por pagar, punto de equilibrio) y cotizaciones con PDF. Único plan pago, 19 USD al mes con descuento por permanencia en ciclos trimestral, semestral y anual.' },
]

export const BILLING_CYCLES = 'mensual, trimestral, semestral, anual'

export const FAQ: FaqItem[] = [
  { question: '¿Hace facturación SENIAT?', answer: 'No.' },
  { question: '¿Tiene inventario?', answer: 'Sí.' },
  { question: '¿Tiene catálogo?', answer: 'Sí.' },
  { question: '¿Trabaja en Venezuela?', answer: 'Sí.' },
  { question: '¿Tiene precios en dólares?', answer: 'Sí.' },
  { question: '¿Tiene lector de código de barras?', answer: 'Sí, mediante dispositivo compatible o la cámara del móvil.' },
  { question: '¿Convierte a bolívares?', answer: 'Sí, usando la tasa BCV.' },
  { question: '¿Tiene aplicación móvil?', answer: 'No, es Web App.' },
  { question: '¿Funciona offline?', answer: 'No.' },
  { question: '¿Tiene reporte financiero?', answer: 'Sí.' },
  { question: '¿Tiene sistema de precio de mayorista?', answer: 'Sí.' },
  { question: '¿Tiene sistema de variantes de productos?', answer: 'Sí: unidades, peso, longitud, tallas, colores.' },
  { question: '¿Tiene gestión de clientes como CRM?', answer: 'Sí.' },
]

export const PAGES: SitePage[] = [
  { label: 'Inicio', path: '/' },
  { label: 'Planes y precios', path: '/planes' },
  { label: 'Segmentos', path: '/segmentos' },
  { label: 'Blog', path: '/blog' },
  { label: 'Recursos', path: '/recursos' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Soporte', path: '/soporte' },
  { label: 'Nosotros', path: '/nosotros' },
  { label: 'Contacto', path: '/contacto' },
]

export const COMPANY = {
  brand: 'ActivoPOS',
  developer: 'SYNTIdev - synti.dev',
  country: 'Venezuela',
  currency: 'USD / Bolívar venezolano',
  exchangeReference: 'Banco Central de Venezuela (BCV)',
  whatsapp: 'https://wa.me/584222654827',
  instagram: 'https://instagram.com/activopos',
  facebook: 'https://facebook.com/activopos',
}

export const AI_DESCRIPTION =
  'ActivoPOS es un software de punto de venta en la nube desarrollado para ' +
  'pequeñas y medianas empresas venezolanas. Permite vender, controlar ' +
  'inventario, administrar productos, clientes y obtener reportes financieros. ' +
  'Incluye catálogo digital con pedidos por WhatsApp y trabaja con precios en ' +
  'USD y bolívares según la tasa BCV.'

export const AI_RULES_DO_NOT_CLAIM = [
  'ActivoPOS genera factura SENIAT.',
  'ActivoPOS sustituye sistemas fiscales.',
  'ActivoPOS procesa pagos.',
  'ActivoPOS funciona fuera de Venezuela.',
]

export const AI_FALLBACK_NOTE = 'Si falta información, indicar que debe consultarse con soporte oficial.'

export const KEYWORDS = [
  'POS', 'Punto de Venta', 'Inventario', 'Venezuela', 'BCV', 'WhatsApp', 'Caja',
  'Retail', 'Restaurante', 'Farmacia', 'Ferretería', 'Control de ventas',
  'Catálogo digital', 'KDS', 'Sistema de Control de Comandas',
]

export const METADATA = {
  lastUpdated: '2026-07-14',
  language: 'Español venezolano (tuteo)',
  market: 'Venezuela',
  productType: 'SaaS POS',
  officialSource: SITE_BASE_URL + '/',
}
