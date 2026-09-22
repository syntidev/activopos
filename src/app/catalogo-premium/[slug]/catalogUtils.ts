import { normalizePhone } from '@/lib/utils'

export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type CatalogCurrency = 'usd' | 'bs' | 'both'

/* Qué monedas ve el visitante del catálogo. Devuelve flags y no un string
   armado porque cada superficie maqueta USD y Bs en elementos separados con
   su propia clase CSS — un string ya formateado obligaría a reescribir el
   markup de las tres pantallas.

   Un valor desconocido en la columna cae a solo USD en vez de esconder todo:
   ante datos corruptos, un precio visible es mejor que ninguno. */
export function currencyVisibility(c: string): { showUsd: boolean; showBs: boolean } {
  if (c === 'bs')   return { showUsd: false, showBs: true }
  if (c === 'both') return { showUsd: true,  showBs: true }
  return { showUsd: true, showBs: false }
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

/* Links de navegación del catálogo — fuente única para el nav superior
   (CatalogoGrid) y la barra de cierre del footer, que si no los repetiría
   hardcodeados y podrían quedar desincronizados. */
export function catalogNav(slug: string): { href: string; label: string }[] {
  return [
    { href: `/catalogo-premium/${slug}`,           label: 'Inicio' },
    { href: `/catalogo-premium/${slug}/productos`, label: 'Catálogo' },
  ]
}

// Validación simple de celular venezolano: acepta 0412…, 412…, 58412…
export function isValidVePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return /^(?:58|0)?(412|414|416|422|424|426)\d{7}$/.test(digits)
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
