import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
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
      <h2 className={styles.headline}>
        Si produces, vendes o prestas un servicio<br />en Venezuela, esto es para ti.
      </h2>
      {segments.length > 0 && (
        <>
          <div className={styles.grid}>
            {segments.map(seg => (
              <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.card}>
                <SegmentIcon slug={seg.slug} size={28} />
                <span className={styles.name}>{seg.name}</span>
                <span className={styles.tagLine}>{seg.tag_line}</span>
              </Link>
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
    </section>
  )
}
