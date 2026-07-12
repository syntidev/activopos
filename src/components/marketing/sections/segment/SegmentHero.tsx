import Link from 'next/link'
import { MessageCircle, UserPlus } from 'lucide-react'
import type { SegmentData } from '@/types/marketing'
import { BILLING_CYCLES } from '@/lib/plan-limits'
import styles from './SegmentHero.module.css'

const FROM_PRICE = Math.round(BILLING_CYCLES.inicio.mensual.monthlyEquivalent)

export default function SegmentHero({ segment }: { segment: SegmentData }) {
  return (
    <section className={styles.hero} data-theme={segment.theme_key}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          {segment.tag_line && <span className={styles.eyebrow}>{segment.tag_line}</span>}
          <h1 className={styles.headline}>{segment.headline}</h1>
          <p className={styles.subheadline}>{segment.subheadline}</p>
          <div className={styles.actions}>
            <Link href="/registro" className={styles.ctaPrimary}>
              <UserPlus size={17} aria-hidden="true" />
              Crear cuenta gratis
            </Link>
            <a
              href="https://wa.me/584222654827?text=Hola%2C+quiero+ver+ActivoPOS+en+acci%C3%B3n"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaGhost}
            >
              <MessageCircle size={16} aria-hidden="true" />
              Ver demostración
            </a>
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
            <div className={styles.mediaFallback} aria-hidden="true" />
          )}

          <div className={styles.mockCard}>
            <span className={styles.mockDot} />
            <span className={styles.mockName}>{segment.name}</span>
            <span className={styles.mockLine} />
            <span className={styles.mockLineShort} />
          </div>

          <span className={styles.priceBadge}>Desde ${FROM_PRICE}/mes</span>
        </div>
      </div>
    </section>
  )
}
