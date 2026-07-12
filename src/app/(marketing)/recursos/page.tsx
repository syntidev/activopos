import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Recursos y Segmentos | ActivoPOS',
  description: 'Descubre cómo ActivoPOS se adapta a tu negocio venezolano. POS para carnicerías, restaurantes, ferreterías, farmacias y más.',
}

const PLAN_TIERS: Exclude<PlanTier, 'trial'>[] = ['inicio', 'pro', 'business']

export default async function RecursosPage() {
  const segments = await prisma.segment.findMany({
    where: { active: true },
    orderBy: { sort_order: 'asc' },
    select: { slug: true, name: true, tag_line: true, headline: true },
  })

  // Fuente única de verdad de precios — plan-limits.ts, igual que /planes,
  // PricingSection y SegmentPricing. Ya NO se lee la tabla `plans` de la DB
  // (evita que 2 fuentes puedan volver a divergir en el precio real).
  const plans = PLAN_TIERS.map(tier => ({
    key:       tier,
    name:      PLAN_DISPLAY[tier],
    price_usd: BILLING_CYCLES[tier].mensual.monthlyEquivalent,
  }))

  return (
    <div className={styles.page}>

      {/* HERO */}
      <section className={styles.hero}>
        <RevealSection>
          <h1 className={styles.heroTitle}>Todo lo que necesitás saber sobre ActivoPOS</h1>
          <p className={styles.heroSub}>Segmentos, planes y recursos para tu negocio venezolano</p>
        </RevealSection>
      </section>

      {/* SEGMENTOS */}
      <section className={styles.section}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>Por tipo de negocio</h2>
          <div className={styles.segmentGrid}>
            {segments.map(seg => (
              <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.segmentCard}>
                <span className={styles.segName}>{seg.name}</span>
                <span className={styles.segTag}>{seg.tag_line}</span>
                <span className={styles.segHeadline}>{seg.headline}</span>
                <span className={styles.segLink}>Ver más →</span>
              </Link>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* PLANES */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>Planes y precios</h2>
          <div className={styles.planGrid}>
            {plans.map(plan => (
              <Link key={plan.key} href="/planes" className={styles.planCard}>
                <span className={styles.planName}>{plan.name}</span>
                <span className={styles.planPrice}>${plan.price_usd}<span className={styles.planPer}>/mes</span></span>
              </Link>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <RevealSection>
          <h2 className={styles.ctaTitle}>¿Listo para activar tu negocio?</h2>
          <Link href="/registro" className={styles.ctaBtn}>Crear cuenta gratis</Link>
        </RevealSection>
      </section>

    </div>
  )
}
