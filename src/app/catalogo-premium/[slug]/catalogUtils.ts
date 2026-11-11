import { hasUsablePhone } from '@/lib/customer-identity'
import { normalizePhone } from '@/lib/utils'

export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type CatalogCurrency = 'usd' | 'bs' | 'both'

/* REGLA SELLADA (CLAUDE.md, Monetario): todo precio del catálogo muestra USD
   Y Bs simultáneamente, sin toggle. Por eso esto devuelve siempre ambos y
   catalog_default_currency queda SIN efecto visible (decisión de Carlos,
   2026-09-24). Reactivar un ajuste de moneda es una decisión nueva que se
   discute aparte -- no se vuelve a leer el parámetro por accidente.
   Se conserva la firma para no tocar las superficies que lo consumen. */
export function currencyVisibility(_c: string): { showUsd: boolean; showBs: boolean } {
  return { showUsd: true, showBs: true }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Movido de CatalogoGrid.tsx -- ahora también lo usa CatalogHeader.tsx
// (compartido con kit-200k), fuente única.
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

// Teléfono del checkout: 10-11 dígitos (con o sin el 0 inicial o el 58); la misma regla que aplica el servidor.
export function isValidVePhone(raw: string): boolean {
  return hasUsablePhone(raw)
}

// Paleta EXACTA de src/components/products/CategoryModal.tsx (las 8 opciones que
// el admin puede elegir para una categoría) -- reusada acá solo como FALLBACK
// determinista cuando Category.color es null (hoy: todas las de OnBike lo son),
// para que el badge de categoría siempre se vea distinto por categoría aunque
// nadie lo haya configurado. Un color explícito del admin siempre gana.
const CATEGORY_FALLBACK_COLORS = ['#0038BD', '#16A34A', '#FBBF24', '#EF4444', '#7C3AED', '#EC4899', '#0891B2', '#64748B']

export function categoryBadgeColor(name: string, configured: string | null | undefined): string {
  if (configured) return configured
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return CATEGORY_FALLBACK_COLORS[Math.abs(hash) % CATEGORY_FALLBACK_COLORS.length]
}

// Mensaje de WhatsApp para "consultar" un producto -- botón directo en la ficha
// (junto a Agregar al carrito) y en los estados sin precio/bajo pedido.
export function getConsultarWaUrl(phone: string, productName: string): string {
  if (!phone) return '#'
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(`Hola, quiero consultar disponibilidad de: ${productName}`)}`
}
