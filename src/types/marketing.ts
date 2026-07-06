// Tipos de la capa de marketing SEO — reflejan los modelos Segment/SegmentFaq/Plan
// de prisma/schema.prisma. Consumidos por las páginas /para-[segmento] y sus secciones.

export type SegmentMode = 'product' | 'service' | 'hybrid'

export interface SegmentFaq {
  id:         string
  question:   string
  answer:     string
  sort_order: number
}

export interface SegmentData {
  id:               string
  slug:             string
  name:             string
  mode:             SegmentMode
  theme_key:        string
  headline:         string
  subheadline:      string
  meta_title:       string
  meta_description: string
  hero_image:       string | null
  pain_1:           string
  pain_2:           string
  pain_3:           string
  active:           boolean
  faqs:             SegmentFaq[]
}

export interface PlanData {
  id:          string
  key:         string
  name:        string
  price_usd:   number
  description: string | null
  features:    string[]
  sort_order:  number
}
