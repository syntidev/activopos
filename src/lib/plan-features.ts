import type { PlanTier } from './plan-limits'

export interface PlanFeatureRow {
  label:  string
  desc:   string
  // [gratis, negocio_activo]
  values: [boolean | string, boolean | string]
}

// Fuente única de verdad — consumida por PricingSection.tsx (home),
// /planes/page.tsx (tabla comparativa) y SegmentPricing.tsx. Modelo de 2 planes.
export const PLAN_FEATURES: PlanFeatureRow[] = [
  {
    label:  'POS táctil en cualquier pantalla',
    desc:   'Funciona en celular, tablet o computadora — sin instalar nada aparte.',
    values: [true, true],
  },
  {
    label:  'BCV automático en cada venta',
    desc:   'La tasa se actualiza sola y se congela en el momento del cobro.',
    values: [true, true],
  },
  {
    label:  'Pago Móvil, Zelle, Efectivo, USDT',
    desc:   'Tu cliente paga como ya te paga — sin cambiar su forma de cobrar.',
    values: [true, true],
  },
  {
    label:  'Usuarios',
    desc:   'Cada cajero entra con su propio usuario y permisos.',
    values: ['1', 'Hasta 10'],
  },
  {
    label:  'Productos',
    desc:   'Tu catálogo completo, con stock actualizado en cada venta.',
    values: ['Hasta 40', 'Ilimitados'],
  },
  {
    label:  'Gestión de proveedores',
    desc:   'Registra a quién le compras y qué te falta reponer.',
    values: [false, true],
  },
  {
    label:  'Catálogo digital con pedidos por WhatsApp',
    desc:   'Tu inventario, visible en tutienda.activopos.com, sin que muevas un dedo.',
    values: [false, true],
  },
  {
    label:  'Cotizaciones en PDF',
    desc:   'Envía presupuestos profesionales antes de cerrar la venta.',
    values: [false, true],
  },
  {
    label:  'Cuentas por cobrar y finanzas completas',
    desc:   'Sabes quién te debe y cuánto ganaste de verdad, sin Excel.',
    values: [false, true],
  },
  {
    label:  'Reportes en Excel',
    desc:   'Exporta tus ventas y finanzas para tu contador o tu banco.',
    values: [false, true],
  },
  {
    label:  'Tema visual del catálogo',
    desc:   '9 colores curados + modo claro/oscuro para tu tienda pública.',
    values: [false, true],
  },
  {
    label:  'Analytics avanzado',
    desc:   'Ve tendencias, mejor hora de venta y qué producto te está dejando más plata.',
    values: [false, true],
  },
  {
    label:  'Panel de cocina (KDS)',
    desc:   'Tu cocina ve el pedido armado, en el momento — sin gritar de un lado a otro.',
    values: [false, true],
  },
  {
    label:  'Soporte prioritario',
    desc:   'Te respondemos primero, antes que al resto de la fila.',
    values: [false, true],
  },
]

export const TIER_INDEX: Record<PlanTier, number> = {
  gratis: 0, negocio_activo: 1,
}

export interface PlanFeatureLine {
  label: string
  desc:  string
}

// Bullets reales incluidos en un tier, con el valor (si es medible) prefijado
// al label — ej. "Hasta 10 usuarios" en vez de "Usuarios" + "Hasta 10" sueltos.
export function featuresForTier(tier: PlanTier): PlanFeatureLine[] {
  const idx = TIER_INDEX[tier]
  return PLAN_FEATURES
    .filter(row => row.values[idx] !== false)
    .map(row => formatFeatureLine(row, idx))
}

const TIER_ORDER: PlanTier[] = ['gratis', 'negocio_activo']

function formatFeatureLine(row: PlanFeatureRow, idx: number): PlanFeatureLine {
  const v = row.values[idx]
  const label = typeof v === 'string' ? `${v} ${row.label.charAt(0).toLowerCase()}${row.label.slice(1)}` : row.label
  return { label, desc: row.desc }
}

// Solo los features que ESTE tier agrega o mejora sobre el tier anterior —
// para mostrar "Todo lo de Gratis, más:" sin repetir la lista heredada.
export function exclusiveFeaturesForTier(tier: PlanTier): PlanFeatureLine[] {
  const idx = TIER_INDEX[tier]
  const prevIdx = TIER_ORDER.indexOf(tier) - 1
  return PLAN_FEATURES
    .filter(row => {
      const v = row.values[idx]
      if (v === false) return false
      if (prevIdx < 0) return true
      return row.values[prevIdx] !== v
    })
    .map(row => formatFeatureLine(row, idx))
}
