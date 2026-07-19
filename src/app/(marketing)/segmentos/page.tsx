import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Store, LayoutGrid } from 'lucide-react'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
import RevealSection from '@/components/marketing/shared/RevealSection'
import { SEGMENT_ACCENT } from '@/lib/segment-accent'
import styles from './page.module.css'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Segmentos — POS para cada negocio venezolano',
  description: 'Desde carnicerías hasta ferreterías: descubrí cómo ActivoPOS se adapta al rubro de tu negocio en Venezuela.',
  alternates: { canonical: '/segmentos' },
  openGraph: {
    title: 'ActivoPOS para cada negocio venezolano',
    description: 'Desde bodegas hasta ferreterías — un solo sistema.',
    url: '/segmentos',
    type: 'website',
  },
}

interface SegmentListItem {
  slug: string
  name: string
  tag_line: string
}

// Server Components no pueden usar fetch('/ruta-relativa') — arma la URL absoluta
// desde NEXT_PUBLIC_APP_URL. Nunca se deriva del header Host de la request: es
// spoofeable por el cliente y permitiría SSRF.
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

async function getSegments(): Promise<SegmentListItem[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/marketing/segments`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    return await res.json() as SegmentListItem[]
  } catch {
    return []
  }
}

export default async function SegmentosPage() {
  const segments = await getSegments()

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <LayoutGrid className={styles.heroIcon} strokeWidth={1} aria-hidden="true" />
        <RevealSection>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>ActivoPOS para cada negocio venezolano</h1>
            <p className={styles.heroSub}>Desde bodegas hasta ferreterías — un solo sistema</p>
          </div>
        </RevealSection>
      </section>

      <section className={styles.section}>
        <RevealSection>
          <div className={styles.grid}>
            {segments.map(seg => {
              const accent = SEGMENT_ACCENT[seg.slug]
              const cardStyle = accent
                ? ({ '--seg-bg': accent.bg, '--seg-icon': accent.icon } as CSSProperties)
                : undefined
              return (
                <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.card} style={cardStyle}>
                  <span className={styles.iconWrap} aria-hidden="true">
                    <SegmentIcon slug={seg.slug} size={26} />
                  </span>
                  <span className={styles.name}>{seg.name}</span>
                  <span className={styles.tagLine}>{seg.tag_line}</span>
                </Link>
              )
            })}
            <Link href="/registro" className={`${styles.card} ${styles.cardGeneric}`}>
              <span className={styles.iconWrap} aria-hidden="true">
                <Store size={26} strokeWidth={1.5} />
              </span>
              <span className={styles.name}>¿Tu negocio no está aquí?</span>
              <span className={styles.tagLine}>ActivoPOS se adapta a cualquier negocio venezolano</span>
            </Link>
          </div>
        </RevealSection>
      </section>
    </div>
  )
}
