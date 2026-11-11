import { z } from 'zod'

// Fuente única de tipos para business.kit200k_config (Json? en Prisma).
// Vive en src/lib/ -- igual que CobroDataSchema (cobro-data.ts): un route.ts
// no puede exportar un schema extra sin romper la verificación de tipos de
// rutas de Next.js.
//
// Config editable del microsite /kit-200k sin tocar código: textos de evento,
// SEO y 2 toggles. Las imágenes de los componentes NO van aquí -- salen de
// Product.images (ver api/public/kit-200k/[slug]/route.ts).
// Cortes de la franela del kit (Dama / Caballero…): nombre + tallas, configurables por edición. La clave que se guarda en
// componentes_tallas es "franela_" + slug del nombre (franela_dama), así demanda agrupa por corte sin tocar su lógica.
export const MAX_CORTES = 4
export const MAX_TALLAS_CORTE = 10

export const slugCorte = (nombre: string): string =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
export const franelaKey = (nombre: string): string => 'franela_' + slugCorte(nombre)

const FranelaCorteSchema = z.object({
  nombre: z.string().trim().min(1).max(30).refine(n => slugCorte(n) !== '', 'Nombre de corte inválido'),
  tallas: z.array(z.string().trim().min(1).max(20)).min(1).max(MAX_TALLAS_CORTE)
    .refine(a => new Set(a.map(t => t.toUpperCase())).size === a.length, 'Tallas repetidas en un corte'),
}).strict()
export type FranelaCorte = z.infer<typeof FranelaCorteSchema>

export const DEFAULT_FRANELA_CORTES: FranelaCorte[] = [
  { nombre: 'Dama',      tallas: ['S', 'M', 'L'] },
  { nombre: 'Caballero', tallas: ['S', 'M', 'L', 'XL', 'XXL'] },
]

export const KitConfigSchema = z.object({
  nombre_evento:     z.string().trim().max(120),
  fecha_texto:       z.string().trim().max(60),
  badge_hero:        z.string().trim().max(160),
  seo_title:         z.string().trim().max(160),
  seo_description:   z.string().trim().max(300),
  activo:            z.boolean(),
  mostrar_en_header: z.boolean(),
  // OPCIONAL con default: la config ya guardada en producción no trae este campo y el schema es .strict(): nunca debe quedar inválida.
  franela_cortes:    z.array(FranelaCorteSchema).min(1).max(MAX_CORTES)
    .refine(a => new Set(a.map(c => slugCorte(c.nombre))).size === a.length, 'Cortes repetidos')
    .default(DEFAULT_FRANELA_CORTES),
}).strict()
export type KitConfig = z.infer<typeof KitConfigSchema>

// Valores por defecto si el negocio no sembró su kit200k_config todavía --
// nunca null hacia afuera (evita que el consumidor público tenga que manejar
// el caso "sin config" como un estado distinto de "config vacía").
export const EMPTY_KIT_CONFIG: KitConfig = {
  nombre_evento:     '',
  fecha_texto:       '',
  badge_hero:        '',
  seo_title:         '',
  seo_description:   '',
  activo:            false,
  mostrar_en_header: false,
  franela_cortes:    DEFAULT_FRANELA_CORTES,
}

// Mismo criterio que las rutas (api/public/kit-200k, api/config/kit200k) para
// páginas server que leen la columna directo: inválido o sin sembrar -> vacío.
export function parseKitConfig(stored: unknown): KitConfig {
  const parsed = KitConfigSchema.safeParse(stored)
  return parsed.success ? parsed.data : EMPTY_KIT_CONFIG
}

/** Etiqueta visible de una clave de componentes_tallas: "franela_dama" → "Franela Dama" (con el nombre real del corte si está en config); "franela" (reservas viejas) → "Franela (sin corte)"; otra clave, tal cual. */
export function componenteLabel(key: string, cortes: readonly FranelaCorte[] = []): string {
  if (key === 'franela') return 'Franela (sin corte)'
  if (!key.startsWith('franela_')) return key
  const corte = cortes.find(c => franelaKey(c.nombre) === key)
  if (corte) return 'Franela ' + corte.nombre
  return 'Franela ' + key.slice('franela_'.length).replace(/_/g, ' ').replace(/(^|\s)\S/g, ch => ch.toUpperCase())
}

/** Valida el componentes_tallas de UN kit: exactamente un corte de franela que exista en config y una talla de ese corte. Devuelve el mensaje o null. */
export function validateFranelaCorte(componentes: Record<string, string>, cortes: readonly FranelaCorte[]): string | null {
  const keys = Object.keys(componentes).filter(k => k === 'franela' || k.startsWith('franela_'))
  if (keys.length !== 1) return 'Elige un corte de franela (uno solo por kit).'
  const corte = cortes.find(c => franelaKey(c.nombre) === keys[0])
  if (!corte) return 'El corte de franela elegido no existe. Recarga la página.'
  if (!corte.tallas.some(t => t.toUpperCase() === componentes[keys[0]].toUpperCase())) return 'La talla ' + componentes[keys[0]] + ' no existe en el corte ' + corte.nombre + '.'
  return null
}
