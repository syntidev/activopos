import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Store } from 'lucide-react'
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
      <h2 className={styles.headline}>
        Si produces, vendes o prestas un servicio<br />en Venezuela, esto es para ti.
      </h2>
      <div className={styles.grid}>
        {segments.map(seg => (
          <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.card}>
            <SegmentIcon slug={seg.slug} size={28} />
            <span className={styles.name}>{seg.name}</span>
            <span className={styles.tagLine}>{seg.tag_line}</span>
          </Link>
        ))}
        <Link href="/registro" className={`${styles.card} ${styles.cardGeneric}`}>
          <span className={styles.iconWrap} aria-hidden="true">
            <Store size={22} strokeWidth={1.5} />
          </span>
          <span className={styles.name}>¿Tu negocio no está aquí?</span>
          <span className={styles.tagLine}>ActivoPOS se adapta a cualquier negocio venezolano</span>
        </Link>
      </div>
    </section>
  )
}
