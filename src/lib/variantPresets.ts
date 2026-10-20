import type { SizeType } from '@/types/variantForm'

// Presets de talla/color para el flujo de variantes de una sola dimensión.
// Fuente única — consumida por ProductFormLayout.tsx (formulario completo) y
// ProductModal.tsx (modal rápido de productos/page.tsx). Antes vivían
// duplicados y el de ProductModal quedó desactualizado (5 grupos viejos,
// sin variant_group) — ver commit c5532e2.

export const PRESET_GROUPS = [
  { id: 'zap-dama',       label: 'Zapato Dama',      values: ['35','36','37','38','39','40','41','42'] },
  { id: 'zap-caballero',  label: 'Zapato Caballero', values: ['39','40','41','42','43','44','45','46','47','48','49','50','51'] },
  { id: 'zap-nino',       label: 'Zapato Niño',      values: ['28','29','30','31','32','33','34','35','36','37','38'] },
  { id: 'zap-nina',       label: 'Zapato Niña',      values: ['28','29','30','31','32','33','34','35','36','37','38'] },
  { id: 'ropa-dama',      label: 'Ropa Dama',        values: ['XS','S','M','L','XL','2XL'] },
  { id: 'ropa-caballero', label: 'Ropa Caballero',   values: ['XS','S','M','L','XL','2XL','3XL','4XL'] },
  { id: 'ropa-nino',      label: 'Ropa Niño',        values: ['2','4','6','8','10','12','14'] },
  { id: 'ropa-nina',      label: 'Ropa Niña',        values: ['2','4','6','8','10','12','14'] },
  { id: 'colores',        label: 'Colores',          values: ['Negro','Blanco','Rojo','Azul','Verde','Amarillo','Naranja','Rosado','Gris','Morado'] },
] as const

// ── Paso 1 del editor de variantes: tipos de talla (botones grandes) ──
// Los grupos 'zap-*' y 'ropa-caballero' coinciden con SIZE_GUIDES (src/lib/size-guide.ts):
// guardan variant_group para que el catálogo siga mostrando su guía de tallas.
const byId = (id: string) => PRESET_GROUPS.find(g => g.id === id)?.values ?? []

export const SIZE_TYPES: readonly SizeType[] = [
  { id: 'ropa',          label: 'Ropa',           hint: 'XXS a 4XL y Única',      tipo: 'talla', group: 'ropa-caballero',
    values: ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Única'] },
  { id: 'zap-caballero', label: 'Calzado hombre', hint: 'Talla 39 al 51',          tipo: 'talla', group: 'zap-caballero', values: byId('zap-caballero') },
  { id: 'zap-dama',      label: 'Calzado mujer',  hint: 'Talla 35 al 42',          tipo: 'talla', group: 'zap-dama',      values: byId('zap-dama') },
  { id: 'zap-nino',      label: 'Calzado niño',   hint: 'Talla 28 al 38',          tipo: 'talla', group: 'zap-nino',      values: byId('zap-nino') },
  { id: 'zap-nina',      label: 'Calzado niña',   hint: 'Talla 28 al 38',          tipo: 'talla', group: 'zap-nina',      values: byId('zap-nina') },
  { id: 'numerica',      label: 'Numérica',       hint: 'Pantalones y niños por edad', tipo: 'talla', group: null,
    values: ['2', '4', '6', '8', '10', '12', '14', '16', '28', '30', '32', '34', '36', '38', '40', '42', '44'] },
  { id: 'colores',       label: 'Colores',        hint: 'Negro, Blanco, Rojo…',    tipo: 'color', group: 'colores', values: byId('colores') },
  { id: 'personalizada', label: 'Personalizada',  hint: 'Escribe tus propios nombres', tipo: 'personalizado', group: null, values: [], custom: true },
]

/** Tipo de talla que corresponde a variantes ya guardadas (por su variant_group). */
export function sizeTypeForGroup(group: string | null | undefined): SizeType {
  const found = group ? SIZE_TYPES.find(t => t.group === group) : undefined
  return found ?? SIZE_TYPES[SIZE_TYPES.length - 1]
}

// Presets de calzado -> muestran el input de equivalencia opcional junto al chip.
export const SHOE_GROUP_IDS = ['zap-dama', 'zap-caballero', 'zap-nino', 'zap-nina'] as const

// Categorías que "requieren talla" -- heurística por nombre (sin campo real
// en Category, ver auditoría 2026-09-22), mismo criterio que Brand.search_term
// ya usa en este proyecto para matching blando. Funciona en TODOS los
// tenants sin depender de un ID fijo, pero es un heurístico de texto, no una
// regla estructurada: si Carlos confirma la lista exacta de categorías o
// pide algo más preciso, la extensión correcta es un campo real
// `requires_variant` en Category (migración), no ampliar este arreglo.
const REQUIRES_VARIANT_KEYWORDS = ['calzado', 'ropa', 'indumentaria', 'zapato', 'zapatilla', 'vestimenta']

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function categoryRequiresVariant(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false
  const n = normalize(categoryName)
  return REQUIRES_VARIANT_KEYWORDS.some(k => n.includes(k))
}
