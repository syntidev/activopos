import { z } from 'zod'

// Fuente única de tipos para business.kit200k_config (Json? en Prisma).
// Vive en src/lib/ -- igual que CobroDataSchema (cobro-data.ts): un route.ts
// no puede exportar un schema extra sin romper la verificación de tipos de
// rutas de Next.js.
//
// Config editable del microsite /kit-200k sin tocar código: textos de evento,
// SEO y 2 toggles. Las imágenes de los componentes NO van aquí -- salen de
// Product.images (ver api/public/kit-200k/[slug]/route.ts).
export const KitConfigSchema = z.object({
  nombre_evento:     z.string().trim().max(120),
  fecha_texto:       z.string().trim().max(60),
  badge_hero:        z.string().trim().max(160),
  seo_title:         z.string().trim().max(160),
  seo_description:   z.string().trim().max(300),
  activo:            z.boolean(),
  mostrar_en_header: z.boolean(),
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
}
