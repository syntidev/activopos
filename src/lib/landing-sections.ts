import { z } from 'zod'

// Fase 1 de Landing Sections — Disciplinas/Arma-tu-equipo/Barra-de-marcas
// quedan para Fase 2. El layout de cada tipo NO es editable por el usuario,
// solo el contenido de `config` — validado aquí, nunca confiado del cliente.
export const SECTION_TYPES = ['hero', 'event_slider', 'community', 'story', 'collection_grid'] as const
export type SectionType = typeof SECTION_TYPES[number]

const trimmed = (max: number) => z.string().trim().min(1).max(max)

// image_url: solo assets propios (mismo patrón que logo_path en
// config/business/route.ts) — nunca una URL externa, cierra el vector de
// stored-XSS/hotlinking que un string sin validar de esquema dejaba abierto.
const imagePath = () =>
  trimmed(500).refine(
    v => v.startsWith('/uploads/') || v.startsWith('/storage/tenants/'),
    'image_url debe ser una ruta interna (/uploads/... o /storage/tenants/...)',
  )

// cta_link: ruta interna del catálogo o URL externa http(s) (WhatsApp,
// Instagram, etc.) — nunca javascript:/data:/otro esquema ejecutable.
// '//host' explícitamente excluido de la rama "ruta interna": el navegador
// lo resuelve como protocol-relative (sale del sitio), no es lo que
// "ruta interna" promete — hallazgo de revisión automática, cierre real
// aunque no era el vector de XSS que reportó (ese ya estaba bloqueado por
// el whitelist de protocol de abajo).
const linkUrl = (max: number) =>
  trimmed(max).refine(v => {
    if (v.startsWith('/') && !v.startsWith('//')) return true
    try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false }
  }, 'Link inválido: debe ser una ruta interna o una URL http(s)')

const httpUrl = (max: number) =>
  trimmed(max).refine(v => {
    try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false }
  }, 'URL inválida: debe ser http(s)')

const SlideSchema = z.object({
  title:     trimmed(120),
  subtitle:  trimmed(200),
  cta_text:  trimmed(40),
  cta_link:  linkUrl(500),
  image_url: imagePath(),
}).strict()

const CommunityItemSchema = z.object({
  image_url:   imagePath(),
  product_tag: trimmed(80),
}).strict()

// Un schema estricto por tipo — rechaza cualquier campo no declarado (mismo
// patrón de whitelisting que catalog/[slug]/order).
export const CONFIG_SCHEMAS = {
  hero: z.object({
    title:     trimmed(120),
    subtitle:  trimmed(200),
    cta_text:  trimmed(40),
    cta_link:  linkUrl(500),
    image_url: imagePath(),
    video_url: httpUrl(500).optional(),
  }).strict(),
  event_slider: z.object({
    slides: z.array(SlideSchema).min(2).max(5),
  }).strict(),
  community: z.object({
    heading:    trimmed(120),
    subheading: trimmed(200),
    items:      z.array(CommunityItemSchema).min(2).max(4),
  }).strict(),
  story: z.object({
    eyebrow:   trimmed(60),
    title:     trimmed(120),
    body:      trimmed(2000),
    image_url: imagePath(),
  }).strict(),
  // Solo guarda la referencia a la colección — el renderer resuelve nombre y
  // productos server-side vía Prisma directo (ver catalogo-premium/[slug]/page.tsx),
  // igual que el resto del catálogo. Nada de eso se valida ni se guarda acá.
  collection_grid: z.object({
    collection_id: z.number().int().positive(),
  }).strict(),
} satisfies Record<SectionType, z.ZodTypeAny>

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value)
}

// Tipos derivados de los schemas — una sola fuente de verdad para el
// renderer (catálogo público) y el formulario de admin, cero forma duplicada.
export type HeroConfig           = z.infer<typeof CONFIG_SCHEMAS.hero>
export type EventSliderConfig    = z.infer<typeof CONFIG_SCHEMAS.event_slider>
export type CommunityConfig      = z.infer<typeof CONFIG_SCHEMAS.community>
export type StoryConfig          = z.infer<typeof CONFIG_SCHEMAS.story>
export type CollectionGridConfig = z.infer<typeof CONFIG_SCHEMAS.collection_grid>
export type SlideConfig          = EventSliderConfig['slides'][number]
export type CommunityItemConfig  = CommunityConfig['items'][number]

export interface CollectionGridProduct {
  id:        number
  name:      string
  image:     string | null
  priceUsd:  number
  priceBs:   number | null
}

// Config enriquecida solo para el renderer (nunca se guarda así en DB): a
// {collection_id} validado arriba, page.tsx le suma nombre + productos
// resueltos por Prisma server-side antes de pasarlo al client component.
export type CollectionGridRenderConfig = CollectionGridConfig & {
  collection_name: string
  products:        CollectionGridProduct[]
}

export type RenderableLandingSection =
  | { id: number; order: number; type: 'hero';            config: HeroConfig }
  | { id: number; order: number; type: 'event_slider';    config: EventSliderConfig }
  | { id: number; order: number; type: 'community';       config: CommunityConfig }
  | { id: number; order: number; type: 'story';           config: StoryConfig }
  | { id: number; order: number; type: 'collection_grid'; config: CollectionGridRenderConfig }
