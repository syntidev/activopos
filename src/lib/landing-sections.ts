import { z } from 'zod'

// Fase 1 de Landing Sections — Disciplinas/Arma-tu-equipo/Barra-de-marcas
// quedan para Fase 2. El layout de cada tipo NO es editable por el usuario,
// solo el contenido de `config` — validado aquí, nunca confiado del cliente.
export const SECTION_TYPES = ['hero', 'event_slider', 'community', 'story'] as const
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
const linkUrl = (max: number) =>
  trimmed(max).refine(v => {
    if (v.startsWith('/')) return true
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
} satisfies Record<SectionType, z.ZodTypeAny>

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value)
}
