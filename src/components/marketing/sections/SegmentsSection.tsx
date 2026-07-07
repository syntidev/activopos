import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
import styles from './SegmentsSection.module.css'

export default async function SegmentsSection() {
  const segments = await prisma.segment.findMany({
    where:   { active: true },
    orderBy: { sort_order: 'asc' },
    select:  { slug: true, name: true, tag_line: true },
  })

  return (
    <section className={styles.section} id="segmentos">
      <div className={styles.inner}>
        <h2 className={styles.title} data-reveal>
          Si produces, vendes o prestas un servicio<br />
          en Venezuela, esto es para ti.
        </h2>

        <div className={styles.grid} aria-label="Tipos de negocio compatibles">
          {segments.map(seg => (
            <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.item}>
              <SegmentIcon slug={seg.slug} size={28} />
              <span className={styles.itemName}>{seg.name}</span>
              <span className={styles.itemSub}>{seg.tag_line}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
