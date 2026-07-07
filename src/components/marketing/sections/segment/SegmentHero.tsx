import Link from 'next/link'
import type { SegmentData } from '@/types/marketing'
import RotatingBadge from '@/components/marketing/shared/RotatingBadge'
import styles from './SegmentHero.module.css'

export default function SegmentHero({ segment }: { segment: SegmentData }) {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <RotatingBadge />
          <h1 className={styles.headline}>
            {segment.headline}
            <span className={styles.headlineAccent}>Para tu {segment.name}.</span>
          </h1>
          <p className={styles.subheadline}>{segment.subheadline}</p>
          <div className={styles.actions}>
            <Link href="/registro" className={styles.ctaPrimary}>
              Crear cuenta gratis
            </Link>
            <Link href="/catalogo/demo" className={styles.ctaGhost}>
              Ver demostración
            </Link>
          </div>
        </div>

        <div className={styles.media}>
          {segment.hero_image ? (
            <img
              src={segment.hero_image}
              alt={`ActivoPOS para ${segment.name}`}
              className={styles.mediaImg}
              width={640}
              height={420}
            />
          ) : (
            <div className={styles.mediaPlaceholder} aria-hidden="true">
              <span className={styles.mediaMark}>ActivoPOS</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
