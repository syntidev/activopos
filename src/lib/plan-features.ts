import type { PlanTier } from './plan-limits'

// Fuente única de copy de features para la vitrina pública. Curado desde el
// INVENTARIO_FUNCIONES (17 jul 2026, barrido de código) — sólo funciones reales
// y conectadas. NO incluye: KDS, Analytics avanzado, PDF de reportes (DT-11).
// Consumido por PricingSection.tsx (home + /planes), SegmentPricing.tsx y la
// comparativa de /planes.

// Gratis — lista corta (card + comparativa). 6 líneas, sólo el qué.
export const GRATIS_FEATURES: string[] = [
  'POS táctil en cualquier pantalla',
  'BCV automático en cada venta',
  'Pago Móvil, Zelle, Efectivo, USDT',
  'Código de barras con la cámara del celular — no necesitas pistola lectora',
  'Hasta 40 productos',
  '1 usuario',
]

// Negocio Activo — highlights de conversión para la card (5 líneas). El detalle
// completo NO se repite aquí: vive en la comparativa por categoría (abajo).
export const NEGOCIO_HIGHLIGHTS: string[] = [
  'Todo lo del Gratis, sin límites',
  'Catálogo digital con checkout WhatsApp',
  'Multi-ticket, pago mixto y venta a crédito',
  'Finanzas completas y punto de equilibrio',
  'Hasta 10 usuarios, productos ilimitados',
]

// Lista de features de una card por tier (label-only, cards compactas y parejas).
export function featuresForTier(tier: PlanTier): string[] {
  return tier === 'gratis' ? GRATIS_FEATURES : NEGOCIO_HIGHLIGHTS
}

// ── Comparativa por categoría (Negocio Activo, grid de 2 columnas) ──
export type FeatureCategory = 'venta' | 'catalogo' | 'clientes' | 'proveedores' | 'finanzas' | 'equipo'

export const FEATURE_CATEGORY_LABEL: Record<FeatureCategory, string> = {
  venta:       'Venta',
  catalogo:    'Catálogo',
  clientes:    'Clientes',
  proveedores: 'Proveedores',
  finanzas:    'Finanzas',
  equipo:      'Equipo',
}

export interface FeatureCategoryGroup {
  category: FeatureCategory
  label:    string
  items:    string[]
}

// El detalle completo de Negocio Activo, agrupado por categoría. Curado desde el
// INVENTARIO_FUNCIONES — cada línea traza a una función real y conectada.
export const NEGOCIO_CATEGORIES: FeatureCategoryGroup[] = [
  {
    category: 'venta',
    label:    FEATURE_CATEGORY_LABEL.venta,
    items: [
      'Multi-ticket (hasta 5 a la vez)',
      'Variantes combinadas (talla + color)',
      'Venta por peso (kg)',
      'Pago mixto (varios métodos)',
      'Venta a crédito con plazos',
      'Descuento y cargo con PIN',
      'Cotizaciones con PDF descargable',
      'Devoluciones con reintegro de stock',
    ],
  },
  {
    category: 'catalogo',
    label:    FEATURE_CATEGORY_LABEL.catalogo,
    items: [
      'Vitrina digital pública con QR',
      'Checkout por WhatsApp',
      'Pedidos en tablero Kanban',
      'Tema visual: 10 colores + modo oscuro/claro',
    ],
  },
  {
    category: 'clientes',
    label:    FEATURE_CATEGORY_LABEL.clientes,
    items: [
      'Historial y cuentas por cobrar',
      'Precio mayorista por cliente',
    ],
  },
  {
    category: 'proveedores',
    label:    FEATURE_CATEGORY_LABEL.proveedores,
    items: [
      'Compras con reversión automática de stock',
      'Cuentas por pagar',
    ],
  },
  {
    category: 'finanzas',
    label:    FEATURE_CATEGORY_LABEL.finanzas,
    items: [
      'Estado de resultados',
      'Punto de equilibrio con proyección',
      'Gastos por categoría',
      'Exportar a Excel',
    ],
  },
  {
    category: 'equipo',
    label:    FEATURE_CATEGORY_LABEL.equipo,
    items: [
      'Hasta 10 usuarios',
      'Roles y permisos diferenciados',
      'PIN de seguridad',
    ],
  },
]

// Categorías incluidas en un tier. Sólo Negocio Activo tiene el grid; Gratis
// muestra su lista corta y no la comparativa por categoría.
export function featuresByCategoryForTier(tier: PlanTier): FeatureCategoryGroup[] {
  return tier === 'negocio_activo' ? NEGOCIO_CATEGORIES : []
}
