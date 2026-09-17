import { z } from 'zod'

// Fase 1 de Landing Sections — Disciplinas/Arma-tu-equipo/Barra-de-marcas
// quedan para Fase 2. El layout de cada tipo NO es editable por el usuario,
// solo el contenido de `config` — validado aquí, nunca confiado del cliente.
export const SECTION_TYPES = ['hero', 'event_slider', 'community', 'story'] as const
export type SectionType = typeof SECTION_TYPES[number]

const trimmed = (max: number) => z.string().trim().min(1).max(max)

const SlideSchema = z.object({
  title:     trimmed(120),
  subtitle:  trimmed(200),
  cta_text:  trimmed(40),
  cta_link:  trimmed(500),
  image_url: trimmed(500),
}).strict()

const CommunityItemSchema = z.object({
  image_url:   trimmed(500),
  product_tag: trimmed(80),
}).strict()

// Un schema estricto por tipo — rechaza cualquier campo no declarado (mismo
// patrón de whitelisting que catalog/[slug]/order).
export const CONFIG_SCHEMAS = {
  hero: z.object({
    title:     trimmed(120),
    subtitle:  trimmed(200),
    cta_text:  trimmed(40),
    cta_link:  trimmed(500),
    image_url: trimmed(500),
    video_url: z.string().trim().max(500).optional(),
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
    image_url: trimmed(500),
  }).strict(),
} satisfies Record<SectionType, z.ZodTypeAny>

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value)
}
