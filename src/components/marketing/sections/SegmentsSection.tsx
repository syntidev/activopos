import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SegmentPill from '@/components/marketing/shared/SegmentPill'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './SegmentsSection.module.css'

interface ApiSegment {
  slug:     string
  name:     string
  tag_line: string
}

// Server Component — fetch al propio endpoint público en vez de Prisma directo
// (pedido explícito del sprint: reusar el mismo contrato que /segmentos y el
// nav dropdown consumen, no duplicar la query).
async function getSegments(): Promise<ApiSegment[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/marketing/segments`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    return await res.json() as ApiSegment[]
  } catch {
    return []
  }
}

export default async function SegmentsSection() {
  const segments = (await getSegments()).slice(0, 8)

  return (
    <section className={styles.section} id="segmentos">
      <RevealSection>
        <h2 className={styles.headline}>
          Si produces, vendes o prestas un servicio<br />en Venezuela, esto es para ti.
        </h2>
        {segments.length > 0 && (
          <>
            <div className={styles.grid}>
              {segments.map((seg, i) => (
                <SegmentPill key={seg.slug} slug={seg.slug} name={seg.name} tagLine={seg.tag_line} delay={i * 0.08} />
              ))}
            </div>
            <div className={styles.moreWrap}>
              <Link href="/segmentos" className={styles.moreLink}>
                Ver todos los segmentos
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </RevealSection>
    </section>
  )
}
