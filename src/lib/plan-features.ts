import type { PlanTier } from './plan-limits'

export interface PlanFeatureRow {
  label:  string
  desc:   string
  values: [boolean | string, boolean | string, boolean | string]
}

// Fuente única de verdad — consumida por PricingSection.tsx (home) y
// /planes/page.tsx (tabla comparativa). Mismo texto en los dos lugares.
export const PLAN_FEATURES: PlanFeatureRow[] = [
  {
    label:  'POS táctil en cualquier pantalla',
    desc:   'Funciona en celular, tablet o computadora — sin instalar nada aparte.',
    values: [true, true, true],
  },
  {
    label:  'BCV automático en cada venta',
    desc:   'La tasa se actualiza sola y se congela en el momento del cobro.',
    values: [true, true, true],
  },
  {
    label:  'Pago Móvil, Zelle, Efectivo, USDT',
    desc:   'Tu cliente paga como ya te paga — sin cambiar su forma de cobrar.',
    values: [true, true, true],
  },
  {
    label:  'Gestión de proveedores',
    desc:   'Registra a quién le compras y qué te falta reponer.',
    values: [true, true, true],
  },
  {
    label:  'Usuarios',
    desc:   'Cada cajero entra con su propio usuario y permisos.',
    values: ['Hasta 3', 'Hasta 10', 'Ilimitados'],
  },
  {
    label:  'Productos',
    desc:   'Tu catálogo completo, con stock actualizado en cada venta.',
    values: ['Hasta 100', 'Hasta 500', 'Ilimitados'],
  },
  {
    label:  'Catálogo digital con pedidos por WhatsApp',
    desc:   'Tu inventario, visible en tutienda.activopos.com, sin que muevas un dedo.',
    values: [false, true, true],
  },
  {
    label:  'Cotizaciones en PDF',
    desc:   'Envía presupuestos profesionales antes de cerrar la venta.',
    values: [false, true, true],
  },
  {
    label:  'Cuentas por cobrar y finanzas completas',
    desc:   'Sabes quién te debe y cuánto ganaste de verdad, sin Excel.',
    values: [false, true, true],
  },
  {
    label:  'Analytics avanzado',
    desc:   'Ve tendencias, mejor hora de venta y qué producto te está dejando más plata.',
    values: [false, false, true],
  },
  {
    label:  'Panel de cocina (KDS)',
    desc:   'Tu cocina ve el pedido armado, en el momento — sin gritar de un lado a otro.',
    values: [false, false, true],
  },
  {
    label:  'Soporte prioritario',
    desc:   'Te respondemos primero, antes que al resto de la fila.',
    values: [false, false, true],
  },
]

export const TIER_INDEX: Record<Exclude<PlanTier, 'trial'>, number> = {
  inicio: 0, pro: 1, business: 2,
}

export interface PlanFeatureLine {
  label: string
  desc:  string
}

// Bullets reales incluidos en un tier, con el valor (si es medible) prefijado
// al label — ej. "Hasta 3 usuarios" en vez de "Usuarios" + "Hasta 3" sueltos.
export function featuresForTier(tier: Exclude<PlanTier, 'trial'>): PlanFeatureLine[] {
  const idx = TIER_INDEX[tier]
  return PLAN_FEATURES
    .filter(row => row.values[idx] !== false)
    .map(row => {
      const v = row.values[idx]
      const label = typeof v === 'string' ? `${v} ${row.label.charAt(0).toLowerCase()}${row.label.slice(1)}` : row.label
      return { label, desc: row.desc }
    })
}
