import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import type { SegmentData, SegmentMode } from '@/types/marketing'
import SegmentHero from '@/components/marketing/sections/segment/SegmentHero'
import SegmentPains from '@/components/marketing/sections/segment/SegmentPains'
import SegmentFeatures from '@/components/marketing/sections/segment/SegmentFeatures'
import SegmentPricing from '@/components/marketing/sections/segment/SegmentPricing'
import SegmentFAQ from '@/components/marketing/sections/segment/SegmentFAQ'
import SegmentCTA from '@/components/marketing/sections/segment/SegmentCTA'
import styles from './page.module.css'

export const revalidate = 3600 // revalida cada hora — segmentos no cambian frecuentemente

// Las URLs son /para-<slug>. Next no permite prefijo dinámico parcial en el nombre
// de carpeta, así que el segmento captura "para-<slug>" y aquí se despega el prefijo.
const PREFIX = 'para-'
const SLUG_RE = /^[a-z0-9-]{3,50}$/

function toSegmentData(raw: {
  id: string; slug: string; name: string; mode: string; theme_key: string; tag_line: string
  headline: string; subheadline: string; meta_title: string; meta_description: string
  hero_image: string | null; pain_1: string; pain_2: string; pain_3: string; active: boolean
  faqs: { id: string; question: string; answer: string; sort_order: number }[]
}): SegmentData {
  return {
    ...raw,
    mode: (['product', 'service', 'hybrid'].includes(raw.mode) ? raw.mode : 'product') as SegmentMode,
    faqs: raw.faqs.map(f => ({ id: f.id, question: f.question, answer: f.answer, sort_order: f.sort_order })),
  }
}

async function getSegment(slug: string): Promise<SegmentData | null> {
  const segment = await prisma.segment.findFirst({
    where:   { slug, active: true },
    include: { faqs: { orderBy: { sort_order: 'asc' } } },
  })
  return segment ? toSegmentData(segment) : null
}

export async function generateMetadata(
  { params }: { params: { segmento: string } },
): Promise<Metadata> {
  if (!params.segmento.startsWith(PREFIX)) return {}
  const slug = params.segmento.slice(PREFIX.length)
  if (!SLUG_RE.test(slug)) return {}
  const segment = await getSegment(slug)
  if (!segment) return {}
  const ogImages = segment.hero_image
    ? [{ url: segment.hero_image, width: 1280, height: 840, alt: `ActivoPOS para ${segment.name}` }]
    : [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ActivoPOS' }]
  return {
    title:       segment.meta_title,
    description: segment.meta_description,
    alternates:  { canonical: `/${params.segmento}` },
    openGraph: {
      title:       segment.meta_title,
      description: segment.meta_description,
      locale:      'es_VE',
      type:        'website',
      images:      ogImages,
    },
    twitter: {
      card:        'summary_large_image',
      title:       segment.meta_title,
      description: segment.meta_description,
      images:      ogImages.map(i => i.url),
    },
  }
}

export default async function SegmentPage(
  { params }: { params: { segmento: string } },
) {
  if (!params.segmento.startsWith(PREFIX)) notFound()
  const slug = params.segmento.slice(PREFIX.length)
  if (!SLUG_RE.test(slug)) notFound()

  const [segment, bcvRate] = await Promise.all([getSegment(slug), getBcvRate()])
  if (!segment) notFound()

  return (
    <div className={styles.page}>
      <SegmentHero segment={segment} />
      <SegmentPains segment={segment} />
      <SegmentFeatures mode={segment.mode} pain1={segment.pain_1} />
      <SegmentPricing bcvRate={bcvRate} />
      <SegmentFAQ faqs={segment.faqs} segmentName={segment.name} />
      <SegmentCTA segmentName={segment.name} />
    </div>
  )
}
