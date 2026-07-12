import Link from 'next/link'
import { ArrowRight, Receipt } from 'lucide-react'
import type { CSSProperties } from 'react'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './SegmentsSection.module.css'

interface ApiSegment {
  slug:     string
  name:     string
  tag_line: string
}

interface SegmentAccent {
  bg:   string
  icon: string
}

// Acento visual por slug de segmento (mismo slug que usa SegmentIcon),
// no por theme_key — cada segmento necesita su propio color, incluso
// cuando comparte theme_key con otro (ej. ferreterias/repuestos ambos
// "ferreteria"). Vía CSS var inline, mismo patrón que --biz-color en el
// catálogo público.
const SEGMENT_ACCENT: Record<string, SegmentAccent> = {
  carniceria:     { bg: '#FAECE7', icon: '#993C1D' },
  restaurante:    { bg: '#FCEBEB', icon: '#A32D2D' },
  ferreterias:    { bg: '#FAEEDA', icon: '#854F0B' },
  farmacias:      { bg: '#E1F5EE', icon: '#0F6E56' },
  'tiendas-ropa': { bg: '#FBEAF0', icon: '#993556' },
  abastos:        { bg: '#DCE6FF', icon: '#0038BD' },
  tecnologia:     { bg: '#E1F5EE', icon: '#0F6E56' },
  repuestos:      { bg: '#FAEEDA', icon: '#854F0B' },
  servicios:      { bg: '#EEEDFE', icon: '#3C3489' },
}

// Rotación leve por card, sin repetir ángulo entre vecinas (§14, -1.5deg a +1.5deg)
const ROTATE_SEQUENCE = [-1.2, 1, -0.8, 1.4, -1, 0.7, -1.4, 1.1, -0.6, 1.3]

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
  const segments = (await getSegments()).slice(0, 10)

  return (
    <section className={styles.section} id="segmentos">
      <RevealSection>
        <h2 className={styles.headline}>
          Si produces, vendes o prestas un servicio<br />en Venezuela, esto es para ti.
        </h2>
        {segments.length > 0 && (
          <>
            <div className={styles.grid}>
              {segments.map((seg, i) => {
                const accent = SEGMENT_ACCENT[seg.slug]
                const cardStyle = {
                  ...(accent ? { '--seg-bg': accent.bg, '--seg-icon': accent.icon } : {}),
                  rotate: `${ROTATE_SEQUENCE[i % ROTATE_SEQUENCE.length]}deg`,
                } as CSSProperties
                return (
                  <Link
                    key={seg.slug}
                    href={`/para-${seg.slug}`}
                    className={styles.card}
                    style={cardStyle}
                  >
                    <span className={styles.ghostIcon} aria-hidden="true">
                      <SegmentIcon slug={seg.slug} size={72} />
                    </span>
                    <span className={styles.cardIcon}>
                      <SegmentIcon slug={seg.slug} size={22} />
                    </span>
                    <span className={styles.cardName}>{seg.name}</span>
                    <span className={styles.cardTag}>{seg.tag_line}</span>
                  </Link>
                )
              })}

              <div className={styles.featured}>
                <span className={styles.featuredIcon}>
                  <Receipt size={22} aria-hidden="true" />
                </span>
                <span className={styles.featuredTitle}>¿Prestas un servicio profesional?</span>
                <p className={styles.featuredDesc}>
                  Ticket para el mostrador. Carta para tu cotización. Tú eliges el formato — nosotros
                  no generamos tu factura fiscal, te ayudamos a controlar antes de que llegue a tu contador.
                </p>
              </div>
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
